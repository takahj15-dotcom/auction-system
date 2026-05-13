import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, adminProcedure } from "../_core/trpc";
import * as db from "../db";
import { createAuditLog } from "../db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ENV } from "../_core/env";

// Member authentication for customer portal
export const portalRouter = router({
  // Member login with member number + password
  login: publicProcedure
    .input(z.object({
      memberNumber: z.number(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getMemberByNumber(input.memberNumber);
      if (!member) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "会員番号またはパスワードが正しくありません。" });
      }
      if (!member.password) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "パスワードが設定されていません。管理者にお問い合わせください。" });
      }

      const isValid = await bcrypt.compare(input.password, member.password);
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "会員番号またはパスワードが正しくありません。" });
      }

      // Generate JWT token for member
      const token = jwt.sign(
        { memberId: member.id, memberNumber: member.memberNumber, type: "member" },
        ENV.cookieSecret,
        { expiresIn: "7d" }
      );

      return {
        token,
        member: {
          id: member.id,
          memberNumber: member.memberNumber,
          displayName: member.displayName,
          requirePasswordChange: member.requirePasswordChange,
        },
      };
    }),

  // 管理者による会員ポータルへのなりすましログイン（サポート用途）
  // 会員パスワードを要求せずに、管理者権限でポータルトークンを発行する
  adminImpersonate: adminProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getMemberById(input.memberId);
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "会員が見つかりません。" });
      }

      // 会員と同じ形式のポータルトークンを発行（有効期限は短めの1時間）
      const token = jwt.sign(
        {
          memberId: member.id,
          memberNumber: member.memberNumber,
          type: "member",
          impersonatedBy: ctx.user.id,
        },
        ENV.cookieSecret,
        { expiresIn: "1h" }
      );

      await createAuditLog({
        userId: ctx.user.id,
        action: "admin_impersonate_portal",
        tableName: "members",
        recordId: member.id,
        newValue: { memberNumber: member.memberNumber, displayName: member.displayName },
      });

      return {
        token,
        member: {
          id: member.id,
          memberNumber: member.memberNumber,
          displayName: member.displayName,
          requirePasswordChange: false,
        },
      };
    }),

  // Change password
  changePassword: publicProcedure
    .input(z.object({
      token: z.string(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(4),
    }))
    .mutation(async ({ input }) => {
      const decoded = verifyMemberToken(input.token);
      const member = await db.getMemberById(decoded.memberId);
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      if (!member.requirePasswordChange) {
        if (!input.currentPassword) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "現在のパスワードを入力してください。" });
        }
        if (!member.password) throw new TRPCError({ code: "BAD_REQUEST" });
        const isValid = await bcrypt.compare(input.currentPassword, member.password);
        if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "現在のパスワードが正しくありません。" });
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 10);
      await db.updateMember(decoded.memberId, {
        password: hashedPassword,
        requirePasswordChange: false,
      });

      return { success: true };
    }),

  // Get member's own settlements
  mySettlements: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const decoded = verifyMemberToken(input.token);
      const settlements = await db.getSettlementsByMember(decoded.memberId);
      return settlements;
    }),

  // Get member profile
  myProfile: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const decoded = verifyMemberToken(input.token);
      const member = await db.getMemberById(decoded.memberId);
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      const activity = await db.getMemberActivityStatus(decoded.memberId);
      return {
        id: member.id,
        memberNumber: member.memberNumber,
        displayName: member.displayName,
        tradeName: member.tradeName,
        invoiceNumber: member.invoiceNumber,
        phone: member.phone,
        email: member.email,
        requirePasswordChange: member.requirePasswordChange,
        lastActivityAt: activity.lastActivityAt,
        isExpired: activity.isExpired,
      };
    }),

  // ─── 精算書詳細データ取得（ポータル専用） ───
  getSettlementDetail: publicProcedure
    .input(z.object({ token: z.string(), settlementId: z.number() }))
    .query(async ({ input }) => {
      const decoded = verifyMemberToken(input.token);
      const s = await db.getSettlementById(input.settlementId);
      if (!s) throw new TRPCError({ code: "NOT_FOUND", message: "精算データが見つかりません" });
      // Verify this settlement belongs to the logged-in member
      if (s.memberId !== decoded.memberId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "アクセス権がありません" });
      }
      const member = await db.getMemberById(s.memberId);
      const event = await db.getEventById(s.eventId);
      const txns = await db.listTransactions(s.eventId);
      const allMembers = await db.listMembers();
      const memberMap = new Map(allMembers.map((m: any) => [m.id, m]));
      const sealImageUrl = (await db.getSetting("seal_image_url"))?.settingValue || null;

      // 伝票分割（A/B/C）対応: settlement.suffix と一致する取引のみ抽出
      const targetSuffix = (s as any).suffix ?? null;
      const matchSeller = (t: any) =>
        t.sellerMemberId === s.memberId && ((t.sellerSuffix ?? null) === targetSuffix);
      const matchBuyer = (t: any) =>
        t.buyerMemberId === s.memberId && ((t.buyerSuffix ?? null) === targetSuffix);

      // Separate normal and return transactions
      const normalTxns = txns.filter((t: any) => t.transactionType !== "return");
      const returnTxns = txns.filter((t: any) => t.transactionType === "return");

      const salesTransactions = normalTxns
        .filter(matchSeller)
        .map((t: any) => {
          const buyer = memberMap.get(t.buyerMemberId);
          return {
            id: t.id, itemName: t.itemName, quantity: t.quantity, totalPrice: t.totalPrice,
            buyerMemberNumber: buyer?.memberNumber ?? "", buyerName: buyer?.displayName ?? "",
            buyerInvoiceNumber: buyer?.invoiceNumber ?? "",
          };
        });

      const purchaseTransactions = normalTxns
        .filter(matchBuyer)
        .map((t: any) => {
          const seller = memberMap.get(t.sellerMemberId);
          return {
            id: t.id, itemName: t.itemName, quantity: t.quantity, totalPrice: t.totalPrice,
            sellerMemberNumber: seller?.memberNumber ?? "", sellerName: seller?.displayName ?? "",
            sellerInvoiceNumber: seller?.invoiceNumber ?? "",
          };
        });

      // Return transactions (seller side = 売返品, buyer side = 買返品)
      const salesReturnTransactions = returnTxns
        .filter(matchSeller)
        .map((t: any) => {
          const buyer = memberMap.get(t.buyerMemberId);
          return {
            id: t.id, itemName: t.itemName, quantity: t.quantity, totalPrice: t.totalPrice,
            buyerMemberNumber: buyer?.memberNumber ?? "", buyerName: buyer?.displayName ?? "",
            buyerInvoiceNumber: buyer?.invoiceNumber ?? "",
          };
        });

      const purchaseReturnTransactions = returnTxns
        .filter(matchBuyer)
        .map((t: any) => {
          const seller = memberMap.get(t.sellerMemberId);
          return {
            id: t.id, itemName: t.itemName, quantity: t.quantity, totalPrice: t.totalPrice,
            sellerMemberNumber: seller?.memberNumber ?? "", sellerName: seller?.displayName ?? "",
            sellerInvoiceNumber: seller?.invoiceNumber ?? "",
          };
        });

      // Calculate breakdown
      const salesTotalTaxable = salesTransactions
        .filter((t: any) => { const seller = memberMap.get(s.memberId); return seller?.invoiceNumber; })
        .reduce((sum: number, t: any) => sum + t.totalPrice, 0);
      const salesTotalNonTaxable = s.salesTotal - salesTotalTaxable;
      const purchaseTotalTaxable = purchaseTransactions
        .filter((t: any) => { const seller = memberMap.get(txns.find((tx: any) => tx.id === t.id)?.sellerMemberId); return seller?.invoiceNumber; })
        .reduce((sum: number, t: any) => sum + t.totalPrice, 0);
      const purchaseTotalNonTaxable = s.purchaseTotal - purchaseTotalTaxable;

      const salesCommissionRate = s.salesTotal > 0 ? s.salesCommission / s.salesTotal : 0;
      const purchaseCommissionRate = s.purchaseTotal > 0 ? s.purchaseCommission / s.purchaseTotal : 0;
      const salesCommissionTax = Math.floor(s.salesCommission * 0.1);
      const purchaseCommissionTax = Math.floor(s.purchaseCommission * 0.1);

      // 受付情報から参加費ステータスを取得
      const attendance = await db.getAttendance(s.eventId, s.memberId);
      let participationFeeStatus: "collected" | "uncollected" | "exempt" | "absent" = "absent";
      if (attendance?.isPresent && attendance?.isFeeExempt) {
        participationFeeStatus = "exempt";
      } else if (attendance?.isPresent && attendance?.feeCollected) {
        participationFeeStatus = "collected";
      } else if (attendance?.isPresent && !attendance?.feeCollected) {
        participationFeeStatus = "uncollected";
      }

      return {
        settlement: s,
        member,
        event,
        salesTransactions,
        purchaseTransactions,
        salesReturnTransactions,
        purchaseReturnTransactions,
        sealImageUrl,
        participationFeeStatus,
        breakdown: {
          salesTotalTaxable,
          salesTotalNonTaxable,
          purchaseTotalTaxable,
          purchaseTotalNonTaxable,
          salesCommissionRate,
          purchaseCommissionRate,
          salesCommissionTax,
          purchaseCommissionTax,
          salesReturnTotal: s.salesReturnTotal ?? 0,
          purchaseReturnTotal: s.purchaseReturnTotal ?? 0,
        },
      };
    }),

  // ─── リアルタイム取引確認 ───
  myLiveTransactions: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const decoded = verifyMemberToken(input.token);
      const memberId = decoded.memberId;

      // 開催中（open）のイベントを取得
      const allEvents = await db.listEvents();
      const openEvents = allEvents.filter((e: any) => e.status === "open");

      if (openEvents.length === 0) {
        return { events: [], totalSales: 0, totalPurchases: 0, netAmount: 0 };
      }

      const allMembers = await db.listMembers();
      const memberMap = new Map(allMembers.map((m: any) => [m.id, m]));

      const eventResults = [];
      let grandTotalSales = 0;
      let grandTotalPurchases = 0;

      for (const event of openEvents) {
        const txns = await db.listTransactions(event.id);

        const salesTxns = txns
          .filter((t: any) => t.sellerMemberId === memberId && !t.isDeleted)
          .map((t: any) => {
            const buyer = memberMap.get(t.buyerMemberId);
            return {
              id: t.id,
              itemName: t.itemName,
              quantity: t.quantity,
              totalPrice: t.totalPrice,
              transactionType: t.transactionType,
              counterpartNumber: buyer?.memberNumber ?? 0,
              counterpartName: buyer?.displayName ?? "",
              createdAt: t.createdAt,
            };
          });

        const purchaseTxns = txns
          .filter((t: any) => t.buyerMemberId === memberId && !t.isDeleted)
          .map((t: any) => {
            const seller = memberMap.get(t.sellerMemberId);
            return {
              id: t.id,
              itemName: t.itemName,
              quantity: t.quantity,
              totalPrice: t.totalPrice,
              transactionType: t.transactionType,
              counterpartNumber: seller?.memberNumber ?? 0,
              counterpartName: seller?.displayName ?? "",
              createdAt: t.createdAt,
            };
          });

        const salesTotal = salesTxns.reduce((sum: number, t: any) => {
          return t.transactionType === "return" ? sum - t.totalPrice : sum + t.totalPrice;
        }, 0);
        const purchaseTotal = purchaseTxns.reduce((sum: number, t: any) => {
          return t.transactionType === "return" ? sum - t.totalPrice : sum + t.totalPrice;
        }, 0);

        grandTotalSales += salesTotal;
        grandTotalPurchases += purchaseTotal;

        eventResults.push({
          eventId: event.id,
          eventDate: event.eventDate,
          eventTitle: event.title ?? "",
          salesTransactions: salesTxns,
          purchaseTransactions: purchaseTxns,
          salesTotal,
          purchaseTotal,
        });
      }

      return {
        events: eventResults,
        totalSales: grandTotalSales,
        totalPurchases: grandTotalPurchases,
        netAmount: grandTotalSales - grandTotalPurchases,
      };
    }),

  // ─── 通知API ───
  // 通知一覧取得
  myNotifications: publicProcedure
    .input(z.object({ token: z.string(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      const decoded = verifyMemberToken(input.token);
      return db.listMemberNotifications(decoded.memberId, input.limit ?? 50);
    }),

  // 未読通知数
  unreadNotificationCount: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const decoded = verifyMemberToken(input.token);
      const count = await db.countUnreadNotifications(decoded.memberId);
      return { count };
    }),

  // 通知を既読にする
  markNotificationRead: publicProcedure
    .input(z.object({ token: z.string(), notificationId: z.number() }))
    .mutation(async ({ input }) => {
      const decoded = verifyMemberToken(input.token);
      await db.markNotificationRead(input.notificationId, decoded.memberId);
      return { success: true };
    }),

  // 全通知を既読にする
  markAllNotificationsRead: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const decoded = verifyMemberToken(input.token);
      await db.markAllNotificationsRead(decoded.memberId);
      return { success: true };
    }),
});

function verifyMemberToken(token: string): { memberId: number; memberNumber: number; type: string } {
  try {
    const decoded = jwt.verify(token, ENV.cookieSecret) as any;
    if (decoded.type !== "member") {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "無効なトークンです。" });
    }
    return decoded;
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "セッションが期限切れです。再度ログインしてください。" });
  }
}
