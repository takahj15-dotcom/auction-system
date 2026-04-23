import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import * as db from "../db";
import { createAuditLog } from "../db";
import { storagePut } from "../storage";

export const registerRouter = router({
  // レジ取引記録一覧（イベントごと）
  list: protectedProcedure
    .input(z.object({ eventId: z.number() }))
    .query(async ({ input }) => {
      return db.listRegisterTransactions(input.eventId);
    }),

  // レジ精算完了を記録（お預かり・お釣り・サイン含む）
  complete: adminProcedure
    .input(z.object({
      settlementId: z.number(),
      receivedAmount: z.number().min(0),
      changeAmount: z.number().min(0),
      signatureBase64: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const settlement = await db.getSettlementById(input.settlementId);
      if (!settlement) throw new TRPCError({ code: "NOT_FOUND", message: "精算データが見つかりません。" });

      const member = await db.getMemberById(settlement.memberId);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "会員が見つかりません。" });

      // Check if already has register transaction
      const existing = await db.getRegisterTransactionBySettlement(input.settlementId);
      if (existing) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "このレジ取引は既に記録済みです。" });
      }

      // Upload signature to S3 if provided
      let signatureUrl: string | null = null;
      if (input.signatureBase64) {
        try {
          const base64Data = input.signatureBase64.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const fileKey = `signatures/sign-${settlement.eventId}-${member.memberNumber}-${timestamp}-${randomSuffix}.png`;
          const { url } = await storagePut(fileKey, buffer, "image/png");
          signatureUrl = url;
        } catch (error) {
          console.error("Signature upload error:", error);
          // Continue without signature if upload fails
        }
      }

      // Determine deposit/payment amounts
      // settlementAmount の意味（請求書視点）:
      //   > 0 : お客様から会社がいただく金額（買い主）→ depositAmount
      //   < 0 : 会社からお客様にお支払いする金額（売り主）→ paymentAmount
      const settlementAmount = settlement.settlementAmount;
      const depositAmount = settlementAmount > 0 ? settlementAmount : 0;
      const paymentAmount = settlementAmount < 0 ? Math.abs(settlementAmount) : 0;

      const insertId = await db.createRegisterTransaction({
        eventId: settlement.eventId,
        settlementId: settlement.id,
        memberId: settlement.memberId,
        memberNumber: member.memberNumber,
        memberName: member.displayName,
        depositAmount,
        paymentAmount,
        receivedAmount: input.receivedAmount,
        changeAmount: input.changeAmount,
        settlementAmount,
        signatureUrl,
        processedAt: new Date(),
      });

      // Mark settlement as settled
      if (!settlement.isSettled) {
        await db.updateSettlement(settlement.id, {
          isSettled: true,
          settledAt: new Date(),
        });
      }

      await createAuditLog({
        userId: ctx.user.id,
        action: "register_complete",
        tableName: "register_transactions",
        recordId: insertId,
        newValue: {
          settlementId: settlement.id,
          memberId: settlement.memberId,
          depositAmount,
          paymentAmount,
          receivedAmount: input.receivedAmount,
          changeAmount: input.changeAmount,
        },
      });

      return { success: true, id: insertId };
    }),

  // レジ精算取り消し（管理者のみ）
  cancelComplete: adminProcedure
    .input(z.object({
      settlementId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const settlement = await db.getSettlementById(input.settlementId);
      if (!settlement) throw new TRPCError({ code: "NOT_FOUND", message: "精算データが見つかりません。" });

      // レジ取引記録を検索
      const regTxn = await db.getRegisterTransactionBySettlement(input.settlementId);

      // レジ取引記録があれば削除
      if (regTxn) {
        await db.deleteRegisterTransaction(regTxn.id);
      }

      // 精算のisSettledをfalseに戻す（regTxnがなくても実行）
      await db.updateSettlement(input.settlementId, {
        isSettled: false,
        settledAt: null,
      });

      const member = await db.getMemberById(settlement.memberId);

      await createAuditLog({
        userId: ctx.user.id,
        action: "register_cancel",
        tableName: "register_transactions",
        recordId: regTxn?.id ?? 0,
        oldValue: {
          settlementId: settlement.id,
          memberId: settlement.memberId,
          memberName: member?.displayName,
          depositAmount: regTxn?.depositAmount ?? 0,
          paymentAmount: regTxn?.paymentAmount ?? 0,
          receivedAmount: regTxn?.receivedAmount ?? 0,
          changeAmount: regTxn?.changeAmount ?? 0,
          note: regTxn ? undefined : "レジ取引記録が見つからないため、isSettledのみリセット",
        },
      });

      return { success: true };
    }),

  // レジ締めサマリー取得
  closingSummary: protectedProcedure
    .input(z.object({ eventId: z.number() }))
    .query(async ({ input }) => {
      const regTxns = await db.listRegisterTransactions(input.eventId);
      const initialFundSetting = await db.getSetting("register_initial_fund");
      const initialFund = parseInt(initialFundSetting?.settingValue || "50000", 10);

      // 精算データを取得して全員精算完了かチェック
      const settlements = await db.listSettlements(input.eventId);
      const totalSettlements = settlements.length;
      const settledCount = settlements.filter(s => s.isSettled).length;
      const unsettledCount = totalSettlements - settledCount;
      const allSettled = totalSettlements > 0 && unsettledCount === 0;

      // 未精算会員の情報（最大10名まで）
      const unsettledMembers: Array<{ memberNumber: number; displayName: string }> = [];
      for (const s of settlements.filter(s => !s.isSettled).slice(0, 10)) {
        const m = await db.getMemberById(s.memberId);
        if (m) unsettledMembers.push({ memberNumber: m.memberNumber, displayName: m.displayName });
      }

      // 計算
      let totalDeposits = 0;   // お客様からの入金合計
      let totalPayments = 0;   // お客様への支払い合計
      let totalReceived = 0;   // お預かり合計
      let totalChange = 0;     // お釣り合計

      for (const tx of regTxns) {
        totalDeposits += tx.depositAmount;
        totalPayments += tx.paymentAmount;
        totalReceived += tx.receivedAmount;
        totalChange += tx.changeAmount;
      }

      // 理論残高 = 準備金 + お客様からの入金合計 - お客様への支払い合計
      // ただし、お預かりとお釣りも考慮:
      // 実際のレジの動き: 準備金 + 預かり金合計 - お釣り合計 - 支払い合計
      const theoreticalBalance = initialFund + totalReceived - totalChange - totalPayments;

      return {
        initialFund,
        transactions: regTxns,
        totalDeposits,
        totalPayments,
        totalReceived,
        totalChange,
        theoreticalBalance,
        transactionCount: regTxns.length,
        // 精算状況
        totalSettlements,
        settledCount,
        unsettledCount,
        allSettled,
        unsettledMembers,
      };
    }),
});
