import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";

export const pdfRouter = router({
  getSettlementPdfData: protectedProcedure
    .input(z.object({ settlementId: z.number() }))
    .query(async ({ input }) => {
      return getSettlementPdfDataInternal(input.settlementId);
    }),
  getBulkSettlementPdfData: protectedProcedure
    .input(z.object({ eventId: z.number() }))
    .query(async ({ input }) => {
      return getBulkSettlementPdfData(input.eventId);
    }),
});

// Shared function for both tRPC and Express PDF route (single settlement)
export async function getSettlementPdfDataInternal(settlementId: number) {
      const s = await db.getSettlementById(settlementId);
      if (!s) throw new TRPCError({ code: "NOT_FOUND" });
      const member = await db.getMemberById(s.memberId);
      const event = await db.getEventById(s.eventId);
      const txns = await db.listTransactions(s.eventId);

      // 伝票分割（A/B/C）対応: settlement.suffix と一致する取引のみ抽出
      const targetSuffix = (s as any).suffix ?? null;
      const matchSeller = (t: any) =>
        t.sellerMemberId === s.memberId && ((t.sellerSuffix ?? null) === targetSuffix);
      const matchBuyer = (t: any) =>
        t.buyerMemberId === s.memberId && ((t.buyerSuffix ?? null) === targetSuffix);

      // 通常取引と返品取引を分離
      const salesTxns = txns.filter(t => matchSeller(t) && t.transactionType !== "return");
      const purchaseTxns = txns.filter(t => matchBuyer(t) && t.transactionType !== "return");
      const salesReturnTxns = txns.filter(t => matchSeller(t) && t.transactionType === "return");
      const purchaseReturnTxns = txns.filter(t => matchBuyer(t) && t.transactionType === "return");

      // Build member cache with invoice numbers
      const memberCache = new Map<number, { id: number; memberNumber: number; displayName: string; invoiceNumber: string | null; isTaxable: boolean }>();
      const getMemberInfo = async (id: number) => {
        if (memberCache.has(id)) return memberCache.get(id)!;
        const m = await db.getMemberById(id);
        const info = {
          id,
          memberNumber: m?.memberNumber ?? 0,
          displayName: m?.displayName ?? `会員${id}`,
          invoiceNumber: m?.invoiceNumber ?? null,
          isTaxable: m?.isTaxable ?? false,
        };
        memberCache.set(id, info);
        return info;
      };

      // Enrich sales with buyer info
      const enrichedSales = await Promise.all(salesTxns.map(async t => {
        const buyerInfo = await getMemberInfo(t.buyerMemberId);
        return {
          ...t,
          buyerMemberNumber: buyerInfo.memberNumber,
          buyerName: buyerInfo.displayName,
          buyerInvoiceNumber: buyerInfo.invoiceNumber,
          buyerIsTaxable: buyerInfo.isTaxable,
        };
      }));

      // Enrich purchases with seller info
      const enrichedPurchases = await Promise.all(purchaseTxns.map(async t => {
        const sellerInfo = await getMemberInfo(t.sellerMemberId);
        return {
          ...t,
          sellerMemberNumber: sellerInfo.memberNumber,
          sellerName: sellerInfo.displayName,
          sellerInvoiceNumber: sellerInfo.invoiceNumber,
          sellerIsTaxable: sellerInfo.isTaxable,
        };
      }));

      // Enrich return transactions
      const enrichedSalesReturns = await Promise.all(salesReturnTxns.map(async t => {
        const buyerInfo = await getMemberInfo(t.buyerMemberId);
        return {
          ...t,
          buyerMemberNumber: buyerInfo.memberNumber,
          buyerName: buyerInfo.displayName,
          buyerInvoiceNumber: buyerInfo.invoiceNumber,
          buyerIsTaxable: buyerInfo.isTaxable,
        };
      }));

      const enrichedPurchaseReturns = await Promise.all(purchaseReturnTxns.map(async t => {
        const sellerInfo = await getMemberInfo(t.sellerMemberId);
        return {
          ...t,
          sellerMemberNumber: sellerInfo.memberNumber,
          sellerName: sellerInfo.displayName,
          sellerInvoiceNumber: sellerInfo.invoiceNumber,
          sellerIsTaxable: sellerInfo.isTaxable,
        };
      }));

      // Calculate taxable/non-taxable breakdown for sales (excluding returns)
      let salesTotalTaxable = 0;
      let salesTotalNonTaxable = 0;
      for (const t of enrichedSales) {
        if (t.buyerIsTaxable) {
          salesTotalTaxable += t.totalPrice;
        } else {
          salesTotalNonTaxable += t.totalPrice;
        }
      }

      // Calculate taxable/non-taxable breakdown for purchases (excluding returns)
      let purchaseTotalTaxable = 0;
      let purchaseTotalNonTaxable = 0;
      for (const t of enrichedPurchases) {
        if (t.sellerIsTaxable) {
          purchaseTotalTaxable += t.totalPrice;
        } else {
          purchaseTotalNonTaxable += t.totalPrice;
        }
      }

      // Calculate tax on commission (10% of commission for taxable transactions)
      const salesCommissionTax = Math.floor(s.salesCommission * 0.1);
      const purchaseCommissionTax = Math.floor(s.purchaseCommission * 0.1);

      // Get seal image URL from settings
      const sealSetting = await db.getSetting("seal_image_url");
      const sealImageUrl = sealSetting?.settingValue || null;

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
        salesTransactions: enrichedSales,
        purchaseTransactions: enrichedPurchases,
        salesReturnTransactions: enrichedSalesReturns,
        purchaseReturnTransactions: enrichedPurchaseReturns,
        breakdown: {
          salesTotalTaxable,
          salesTotalNonTaxable,
          purchaseTotalTaxable,
          purchaseTotalNonTaxable,
          salesCommissionTax,
          purchaseCommissionTax,
          salesReturnTotal: s.salesReturnTotal,
          purchaseReturnTotal: s.purchaseReturnTotal,
        },
        participationFeeStatus,
        sealImageUrl,
      };
}

// ─── Optimized bulk data fetch (single DB round-trip per resource) ───
export async function getBulkSettlementPdfData(eventId: number) {
  // Fetch all data in parallel with minimal DB calls
  const [settlementList, allTxns, allMembers, event, sealSetting, allAttendance] = await Promise.all([
    db.listSettlements(eventId),
    db.listTransactions(eventId),
    db.listMembers(false), // all members including inactive
    db.getEventById(eventId),
    db.getSetting("seal_image_url"),
    db.listAttendance(eventId),
  ]);

  // Build attendance lookup map (by memberId)
  const attendanceByMemberId = new Map<number, typeof allAttendance[0]>();
  for (const a of allAttendance) {
    attendanceByMemberId.set(a.memberId, a);
  }

  if (settlementList.length === 0) return [];

  const sealImageUrl = sealSetting?.settingValue || null;

  // Build member lookup map (by id)
  const memberById = new Map<number, typeof allMembers[0]>();
  for (const m of allMembers) {
    memberById.set(m.id, m);
  }

  // Process each settlement using pre-fetched data
  const results = [];
  for (const s of settlementList) {
    const member = memberById.get(s.memberId);
    // 伝票分割（A/B/C）対応: settlement.suffix と一致する取引のみ抽出
    const targetSuffix = (s as any).suffix ?? null;
    const matchSeller = (t: any) =>
      t.sellerMemberId === s.memberId && ((t.sellerSuffix ?? null) === targetSuffix);
    const matchBuyer = (t: any) =>
      t.buyerMemberId === s.memberId && ((t.buyerSuffix ?? null) === targetSuffix);
    // 通常取引と返品取引を分離
    const salesTxns = allTxns.filter(t => matchSeller(t) && t.transactionType !== "return");
    const purchaseTxns = allTxns.filter(t => matchBuyer(t) && t.transactionType !== "return");
    const salesReturnTxns = allTxns.filter(t => matchSeller(t) && t.transactionType === "return");
    const purchaseReturnTxns = allTxns.filter(t => matchBuyer(t) && t.transactionType === "return");

    // Enrich sales with buyer info (from pre-fetched member map)
    const enrichedSales = salesTxns.map(t => {
      const buyer = memberById.get(t.buyerMemberId);
      return {
        ...t,
        buyerMemberNumber: buyer?.memberNumber ?? 0,
        buyerName: buyer?.displayName ?? `会員${t.buyerMemberId}`,
        buyerInvoiceNumber: buyer?.invoiceNumber ?? null,
        buyerIsTaxable: buyer?.isTaxable ?? false,
      };
    });

    // Enrich purchases with seller info (from pre-fetched member map)
    const enrichedPurchases = purchaseTxns.map(t => {
      const seller = memberById.get(t.sellerMemberId);
      return {
        ...t,
        sellerMemberNumber: seller?.memberNumber ?? 0,
        sellerName: seller?.displayName ?? `会員${t.sellerMemberId}`,
        sellerInvoiceNumber: seller?.invoiceNumber ?? null,
        sellerIsTaxable: seller?.isTaxable ?? false,
      };
    });

    // Enrich return transactions
    const enrichedSalesReturns = salesReturnTxns.map(t => {
      const buyer = memberById.get(t.buyerMemberId);
      return {
        ...t,
        buyerMemberNumber: buyer?.memberNumber ?? 0,
        buyerName: buyer?.displayName ?? `会員${t.buyerMemberId}`,
        buyerInvoiceNumber: buyer?.invoiceNumber ?? null,
        buyerIsTaxable: buyer?.isTaxable ?? false,
      };
    });

    const enrichedPurchaseReturns = purchaseReturnTxns.map(t => {
      const seller = memberById.get(t.sellerMemberId);
      return {
        ...t,
        sellerMemberNumber: seller?.memberNumber ?? 0,
        sellerName: seller?.displayName ?? `会員${t.sellerMemberId}`,
        sellerInvoiceNumber: seller?.invoiceNumber ?? null,
        sellerIsTaxable: seller?.isTaxable ?? false,
      };
    });

    // Calculate taxable/non-taxable breakdown
    let salesTotalTaxable = 0;
    let salesTotalNonTaxable = 0;
    for (const t of enrichedSales) {
      if (t.buyerIsTaxable) salesTotalTaxable += t.totalPrice;
      else salesTotalNonTaxable += t.totalPrice;
    }

    let purchaseTotalTaxable = 0;
    let purchaseTotalNonTaxable = 0;
    for (const t of enrichedPurchases) {
      if (t.sellerIsTaxable) purchaseTotalTaxable += t.totalPrice;
      else purchaseTotalNonTaxable += t.totalPrice;
    }

    const salesCommissionTax = Math.floor(s.salesCommission * 0.1);
    const purchaseCommissionTax = Math.floor(s.purchaseCommission * 0.1);

    // 受付情報から参加費ステータスを取得
    const attendance = attendanceByMemberId.get(s.memberId);
    let participationFeeStatus: "collected" | "uncollected" | "exempt" | "absent" = "absent";
    if (attendance?.isPresent && attendance?.isFeeExempt) {
      participationFeeStatus = "exempt";
    } else if (attendance?.isPresent && attendance?.feeCollected) {
      participationFeeStatus = "collected";
    } else if (attendance?.isPresent && !attendance?.feeCollected) {
      participationFeeStatus = "uncollected";
    }

    results.push({
      settlement: s,
      member,
      event,
      salesTransactions: enrichedSales,
      purchaseTransactions: enrichedPurchases,
      salesReturnTransactions: enrichedSalesReturns,
      purchaseReturnTransactions: enrichedPurchaseReturns,
      breakdown: {
        salesTotalTaxable,
        salesTotalNonTaxable,
        purchaseTotalTaxable,
        purchaseTotalNonTaxable,
        salesCommissionTax,
        purchaseCommissionTax,
        salesReturnTotal: s.salesReturnTotal,
        purchaseReturnTotal: s.purchaseReturnTotal,
      },
      participationFeeStatus,
      sealImageUrl,
    });
  }

  // 会員番号順にソート
  return results.sort((a, b) => (a.member?.memberNumber ?? 0) - (b.member?.memberNumber ?? 0));
}
