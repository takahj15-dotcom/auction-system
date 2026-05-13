import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import * as db from "../db";
import { createAuditLog } from "../db";

/**
 * Helper: create notifications for members when settlements are generated
 */
async function notifyMembersSettlementCreated(
  eventId: number,
  memberIds: number[],
  eventDate: string,
  eventTitle: string | null,
) {
  if (memberIds.length === 0) return;
  const eventLabel = eventTitle ? `${eventDate} ${eventTitle}` : eventDate;
  const notifications = memberIds.map(memberId => ({
    memberId,
    title: "新しい精算書が作成されました",
    message: `${eventLabel} の精算書が作成されました。ポータルからご確認ください。`,
    type: "settlement" as const,
    linkUrl: `/portal`,
  }));
  try {
    await db.bulkCreateMemberNotifications(notifications);
  } catch (err) {
    console.error("[Notifications] Failed to create settlement notifications:", err);
  }
}

/**
 * Helper: determine sell/buy commission rates for a member in an event
 * based on attendance (present → event rates, absent → event absent rates)
 */
async function getMemberCommissionRates(eventId: number, memberId: number, event: any) {
  const attendance = await db.getAttendance(eventId, memberId);
  const isPresent = attendance?.isPresent ?? false;

  // 会員個別の歩合が設定されている場合はそちらを優先適用
  const member = await db.getMemberById(memberId);
  if (member?.useCustomCommission) {
    return {
      sellRate: parseFloat(member.sellCommissionRate) / 100,
      buyRate: parseFloat(member.buyCommissionRate) / 100,
      isPresent,
      isCustomRate: true,
    };
  }

  if (isPresent) {
    return {
      sellRate: parseFloat(event.sellCommissionRate) / 100,
      buyRate: parseFloat(event.buyCommissionRate) / 100,
      isPresent: true,
      isCustomRate: false,
    };
  } else {
    return {
      sellRate: parseFloat(event.absentSellCommissionRate) / 100,
      buyRate: parseFloat(event.absentBuyCommissionRate) / 100,
      isPresent: false,
      isCustomRate: false,
    };
  }
}

/**
 * Calculate settlement data for a single member (with optional suffix for slip-split)
 *
 * suffix=null   → 取引のうち sellerSuffix/buyerSuffix が null のものを集計
 * suffix='A/B/C' → 該当 suffix の取引のみ集計
 *
 * options.includeFee=false の場合、参加費を 0 にして「他の伝票で計上済み」扱いにする。
 * （参加費は会員1人あたり1回のみ計上するため）
 */
async function calculateMemberSettlement(
  eventId: number,
  memberId: number,
  event: any,
  txns: any[],
  suffix: string | null = null,
  options: { includeFee?: boolean } = { includeFee: true },
) {
  const member = await db.getMemberById(memberId);
  if (!member) return null;

  const { sellRate, buyRate } = await getMemberCommissionRates(eventId, memberId, event);

  const matchSeller = (t: any) =>
    t.sellerMemberId === memberId && ((t.sellerSuffix ?? null) === (suffix ?? null));
  const matchBuyer = (t: any) =>
    t.buyerMemberId === memberId && ((t.buyerSuffix ?? null) === (suffix ?? null));

  // 通常取引と返品取引を分離
  let salesTotal = 0;
  let purchaseTotal = 0;
  let salesReturnTotal = 0;   // 売返品合計（金額のみ）
  let purchaseReturnTotal = 0; // 買返品合計（金額 + 手数料税込）

  txns.forEach(t => {
    if (t.transactionType === "return") {
      // 返品取引: 通常合計には含めず、別途計算
      if (matchSeller(t)) {
        // 売返品: 金額のみ（手数料・消費税なし）
        salesReturnTotal += t.totalPrice;
      }
      if (matchBuyer(t)) {
        // 買返品: 金額 + 手数料(税込) = 金額 + Math.floor(金額 × 買歩合率 × 1.1)
        const returnCommission = Math.floor(t.totalPrice * buyRate);
        const returnCommissionTax = Math.floor(returnCommission * 0.1);
        purchaseReturnTotal += t.totalPrice + returnCommission + returnCommissionTax;
      }
    } else {
      if (matchSeller(t)) salesTotal += t.totalPrice;
      if (matchBuyer(t)) purchaseTotal += t.totalPrice;
    }
  });

  // 通常取引の手数料（返品を含まない）
  const salesCommission = Math.floor(salesTotal * sellRate);
  const purchaseCommission = Math.floor(purchaseTotal * buyRate);

  // 受付情報に基づく参加費処理:
  // - 参加・徴収済み → 精算書に「領収済」と表示、差引かない
  // - 参加・未徴収 → 精算書から参加費として徴収
  // - 参加・参加費免除 → 精算書に何も書かない
  // - 不参加 → 精算書に何も書かない
  const attendance = await db.getAttendance(eventId, memberId);
  const companionCount = attendance?.companionCount ?? 0;
  const isPresent = attendance?.isPresent ?? false;
  const isFeeExempt = attendance?.isFeeExempt ?? false;
  const isFeeCollected = attendance?.feeCollected ?? false;

  // 参加費の精算書への反映ロジック
  // 伝票分割（A/B/C）時は会員あたり1回のみ計上するため、includeFee=false の場合は0に
  let participationFee = 0;
  let participationFeeStatus: "collected" | "uncollected" | "exempt" | "absent" = "absent";

  if (!options.includeFee) {
    // 別の伝票で参加費を計上済み → この伝票では0
    participationFeeStatus = "absent";
    participationFee = 0;
  } else if (isPresent && isFeeExempt) {
    // 免除: 精算書に何も書かない
    participationFeeStatus = "exempt";
    participationFee = 0;
  } else if (isPresent && isFeeCollected) {
    // 徴収済み: 精算書に「領収済」と表示、差引かない
    participationFeeStatus = "collected";
    participationFee = 0;
  } else if (isPresent && !isFeeCollected) {
    // 未徴収: 精算書から参加費として徴収
    participationFeeStatus = "uncollected";
    participationFee = event.participationFee ?? 0;
  } else {
    // 不参加: 精算書に何も書かない
    participationFeeStatus = "absent";
    participationFee = 0;
  }

  const companionFee = 0; // 同伴者料金は事前徴収済

  // 全会員一律で手数料に消費税10%を適用
  const salesCommissionTax = Math.floor(salesCommission * 0.1);
  const purchaseCommissionTax = Math.floor(purchaseCommission * 0.1);
  const taxAmount = salesCommissionTax + purchaseCommissionTax;

  // 精算金額（請求書視点）:
  //   正の値 ( > 0 ) = 会員が会社へ支払う金額（買い主優勢）
  //   負の値 ( < 0 ) = 会社が会員へ支払う金額（売り主優勢、返金）
  // 計算式:
  //   買い側: 買合計 + 買手数料 + 買手数料消費税 - 買返品 + 参加費
  //   売り側: 売合計 - 売手数料 - 売手数料消費税 - 売返品
  const settlementAmount = (purchaseTotal + purchaseCommission + purchaseCommissionTax - purchaseReturnTotal) - (salesTotal - salesCommission - salesCommissionTax - salesReturnTotal) + participationFee;

  return {
    eventId,
    memberId,
    salesTotal,
    salesCommission,
    purchaseTotal,
    purchaseCommission,
    participationFee,
    participationFeeStatus,
    companionCount,
    companionFee,
    taxAmount,
    salesReturnTotal,
    purchaseReturnTotal,
    settlementAmount,
  };
}

/**
 * Core settlement generation logic for ALL members (used for full batch)
 * Now respects already-settled interim settlements
 */
async function generateSettlementData(eventId: number, excludeSettledInterim: boolean = false) {
  const event = await db.getEventById(eventId);
  if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "イベントが見つかりません。" });

  const txns = await db.listTransactions(eventId);
  if (txns.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "取引データがありません。" });
  }

  // 取引から (memberId, suffix) ペアをすべて収集（伝票分割対応）
  const pairKey = (memberId: number, suffix: string | null) => `${memberId}|${suffix ?? ""}`;
  const memberSuffixPairs = new Map<string, { memberId: number; suffix: string | null }>();
  for (const t of txns) {
    const sKey = pairKey(t.sellerMemberId, t.sellerSuffix ?? null);
    const bKey = pairKey(t.buyerMemberId, t.buyerSuffix ?? null);
    memberSuffixPairs.set(sKey, { memberId: t.sellerMemberId, suffix: t.sellerSuffix ?? null });
    memberSuffixPairs.set(bKey, { memberId: t.buyerMemberId, suffix: t.buyerSuffix ?? null });
  }

  // ロック条件: isSettled=true OR レジ取引記録(署名)が存在
  const existingSettlements = await db.listSettlements(eventId);
  const regTxnsForEvent = await db.listRegisterTransactions(eventId);
  const lockedBySettlementId = new Set<number>(
    regTxnsForEvent.map(rt => rt.settlementId)
  );

  const isLocked = (s: typeof existingSettlements[number]) =>
    s.isSettled || lockedBySettlementId.has(s.id);

  // ロック済みの (memberId, suffix) ペア
  const lockedPairKeys = new Set<string>();
  if (excludeSettledInterim) {
    existingSettlements
      .filter(isLocked)
      .forEach(s => lockedPairKeys.add(pairKey(s.memberId, s.suffix ?? null)));
  }

  // 既に参加費を計上済みの会員（ロック済み伝票で計上された会員はそれを尊重）
  const memberFeeAssigned = new Set<number>();
  existingSettlements
    .filter(isLocked)
    .filter(s => (s.participationFee ?? 0) > 0)
    .forEach(s => memberFeeAssigned.add(s.memberId));

  // ロック外の精算書を削除し、ロック中で isSettled=0 の不整合は修復
  for (const s of existingSettlements) {
    if (isLocked(s)) {
      if (!s.isSettled && lockedBySettlementId.has(s.id)) {
        await db.updateSettlement(s.id, {
          isSettled: true,
          settledAt: s.settledAt ?? new Date(),
        });
      }
      continue;
    }
    await db.deleteSettlement(s.id);
  }

  // 並び順: memberId 昇順 → 枝番（null < A < B < C）昇順
  const suffixOrder = (s: string | null) => (s === null ? 0 : (s === "A" ? 1 : s === "B" ? 2 : s === "C" ? 3 : 99));
  const pairs = Array.from(memberSuffixPairs.values()).sort((a, b) => {
    if (a.memberId !== b.memberId) return a.memberId - b.memberId;
    return suffixOrder(a.suffix) - suffixOrder(b.suffix);
  });

  const settlementData: Array<any> = [];
  let generatedCount = 0;

  for (const { memberId, suffix } of pairs) {
    if (lockedPairKeys.has(pairKey(memberId, suffix))) continue;

    // この (memberId, suffix) ペアが、当該会員の中で最初に参加費を負担すべきか
    const includeFee = !memberFeeAssigned.has(memberId);

    const data = await calculateMemberSettlement(
      eventId, memberId, event, txns, suffix, { includeFee },
    );
    if (!data) continue;

    // 参加費を計上した場合、以降の同会員伝票では計上しない
    if (includeFee) memberFeeAssigned.add(memberId);

    settlementData.push({
      ...data,
      suffix,
      settlementType: "final",
    });
    generatedCount++;
  }

  if (settlementData.length > 0) {
    await db.bulkCreateSettlements(settlementData);
  }

  return { memberCount: generatedCount, transactionCount: txns.length, skippedInterim: lockedPairKeys.size };
}

export const settlementsRouter = router({
  list: protectedProcedure
    .input(z.object({ eventId: z.number() }))
    .query(async ({ input }) => {
      const setts = await db.listSettlements(input.eventId);
      const enriched = await Promise.all(setts.map(async (s) => {
        const member = await db.getMemberById(s.memberId);
        const event = await db.getEventById(s.eventId);
        return { ...s, member, event };
      }));
      // 会員番号順にソート
      return enriched.sort((a, b) => (a.member?.memberNumber ?? 0) - (b.member?.memberNumber ?? 0));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const s = await db.getSettlementById(input.id);
      if (!s) throw new TRPCError({ code: "NOT_FOUND" });
      const member = await db.getMemberById(s.memberId);
      const event = await db.getEventById(s.eventId);
      const txns = await db.listTransactions(s.eventId);
      const memberTxns = txns.filter(t =>
        t.sellerMemberId === s.memberId || t.buyerMemberId === s.memberId
      );
      return { ...s, member, event, transactions: memberTxns };
    }),

  getByMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      return db.getSettlementsByMember(input.memberId);
    }),

  // ─── 途中個別精算: イベント進行中に特定会員の精算書を生成 ───
  generateInterimSettlement: adminProcedure
    .input(z.object({
      eventId: z.number(),
      memberId: z.number(),
      // 伝票分割（A/B/C）対象の枝番。null は通常伝票
      suffix: z.enum(["A", "B", "C"]).nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const event = await db.getEventById(input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "イベントが見つかりません。" });
      if (event.status === "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "このイベントは最終締め済みです。" });
      }

      const targetSuffix = input.suffix ?? null;

      // 同じ (memberId, suffix) ペアで既存の精算書をチェック
      const existingSettlements = await db.listSettlements(input.eventId);
      const existing = existingSettlements.find(
        s => s.memberId === input.memberId && (s.suffix ?? null) === targetSuffix,
      );
      if (existing && existing.isSettled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "この伝票は既に精算済みです。" });
      }

      // Delete existing unsettled settlement for this (member, suffix) if any
      if (existing) {
        await db.deleteSettlement(existing.id);
      }

      const txns = await db.listTransactions(input.eventId);
      const memberTxns = txns.filter(t =>
        (t.sellerMemberId === input.memberId && (t.sellerSuffix ?? null) === targetSuffix) ||
        (t.buyerMemberId === input.memberId && (t.buyerSuffix ?? null) === targetSuffix)
      );

      if (memberTxns.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "この伝票の取引データがありません。" });
      }

      // 参加費は、同じ会員の他の精算書（suffix=null/A/B/C のいずれか）で
      // 既に計上されていなければこの伝票で計上する
      const otherSettlementsForMember = existingSettlements.filter(
        s => s.memberId === input.memberId && (s.suffix ?? null) !== targetSuffix,
      );
      const feeAlreadyAssigned = otherSettlementsForMember.some(s => (s.participationFee ?? 0) > 0);

      const data = await calculateMemberSettlement(
        input.eventId, input.memberId, event, txns, targetSuffix, { includeFee: !feeAlreadyAssigned },
      );
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "会員が見つかりません。" });

      const insertId = await db.createSettlement({
        ...data,
        suffix: targetSuffix,
        settlementType: "interim",
      });

      await createAuditLog({
        userId: ctx.user.id,
        action: "generate_interim_settlement",
        tableName: "settlements",
        recordId: insertId,
        newValue: { memberId: input.memberId, eventId: input.eventId },
      });

      // 通知を作成
      await notifyMembersSettlementCreated(
        input.eventId,
        [input.memberId],
        event.eventDate,
        event.title,
      );

      return { success: true, settlementId: insertId };
    }),

  // ─── 途中精算を確定（レジで精算完了時に呼ぶ） ───
  markSettled: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const s = await db.getSettlementById(input.id);
      if (!s) throw new TRPCError({ code: "NOT_FOUND" });
      if (s.isSettled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "既に精算済みです。" });
      }

      await db.updateSettlement(input.id, {
        isSettled: true,
        settledAt: new Date(),
      });

      await createAuditLog({
        userId: ctx.user.id,
        action: "mark_settled",
        tableName: "settlements",
        recordId: input.id,
      });

      return { success: true };
    }),

  // ─── 全体精算処理（最終精算） ───
  // 途中精算済みの会員を除外して残りの会員の精算書を生成
  generateSettlements: adminProcedure
    .input(z.object({ eventId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const event = await db.getEventById(input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "イベントが見つかりません。" });
      if (event.status === "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "このイベントは最終締め済みです。再開してください。" });
      }

      const result = await generateSettlementData(input.eventId, true);

      // ステータスを「settled」に
      await db.updateEvent(input.eventId, { status: "settled" });

      await createAuditLog({
        userId: ctx.user.id,
        action: "generate_settlements",
        tableName: "events",
        recordId: input.eventId,
        newValue: result,
      });

      // 精算書が作成された会員に通知を送信
      const newSettlements = await db.listSettlements(input.eventId);
      const notifyMemberIds = newSettlements
        .filter(s => !s.isSettled) // 新規生成分のみ
        .map(s => s.memberId);
      await notifyMembersSettlementCreated(
        input.eventId,
        notifyMemberIds,
        event.eventDate,
        event.title,
      );

      return { success: true, ...result };
    }),

  // ─── 最終締め ───
  finalizeEvent: adminProcedure
    .input(z.object({ eventId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const event = await db.getEventById(input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "イベントが見つかりません。" });
      if (event.status !== "settled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "先に精算処理を実行してください。" });
      }

      // 全員レジ精算完了チェック
      const settlements = await db.listSettlements(input.eventId);
      const unsettledMembers = settlements.filter(s => !s.isSettled);
      if (unsettledMembers.length > 0) {
        const memberNames: string[] = [];
        for (const s of unsettledMembers.slice(0, 5)) {
          const m = await db.getMemberById(s.memberId);
          if (m) memberNames.push(`${m.memberNumber} ${m.displayName}`);
        }
        const suffix = unsettledMembers.length > 5 ? `他${unsettledMembers.length - 5}名` : "";
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `未精算の会員が${unsettledMembers.length}名います。全員のレジ精算を完了してから最終締めを実行してください。\n未精算: ${memberNames.join(", ")}${suffix}`,
        });
      }

      await db.updateEvent(input.eventId, { status: "closed" });

      await createAuditLog({
        userId: ctx.user.id,
        action: "finalize_event",
        tableName: "events",
        recordId: input.eventId,
      });

      return { success: true };
    }),

  // ─── 精算処理取消し（settled → open） ───
  resetSettlements: adminProcedure
    .input(z.object({ eventId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const event = await db.getEventById(input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      if (event.status === "open") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "このイベントは既にオープン状態です。" });
      }

      // Delete ALL settlements (including interim)
      await db.deleteSettlementsByEvent(input.eventId);
      await db.updateEvent(input.eventId, { status: "open" });

      await createAuditLog({
        userId: ctx.user.id,
        action: "reset_settlements",
        tableName: "events",
        recordId: input.eventId,
        oldValue: { status: event.status },
        newValue: { status: "open" },
      });

      return { success: true };
    }),

  // ─── 最終締め取消し（closed → settled） ───
  reopenEvent: adminProcedure
    .input(z.object({ eventId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const event = await db.getEventById(input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      if (event.status !== "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "このイベントは最終締めされていません。" });
      }

      await db.updateEvent(input.eventId, { status: "settled" });

      await createAuditLog({
        userId: ctx.user.id,
        action: "reopen_event",
        tableName: "events",
        recordId: input.eventId,
      });

      return { success: true };
    }),

  // ─── 後方互換: closeEvent は generateSettlements のエイリアス ───
  closeEvent: adminProcedure
    .input(z.object({ eventId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const event = await db.getEventById(input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "イベントが見つかりません。" });
      if (event.status === "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "このイベントは既に最終締め済みです。" });
      }

      const result = await generateSettlementData(input.eventId, true);
      await db.updateEvent(input.eventId, { status: "settled" });

      await createAuditLog({
        userId: ctx.user.id,
        action: "generate_settlements",
        tableName: "events",
        recordId: input.eventId,
        newValue: result,
      });

      return { success: true, ...result };
    }),
});
