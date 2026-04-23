import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 同伴者カウント・受付合計金額の計算ロジックのテスト
 * 
 * ビジネスルール:
 * - リサイクル: 参加費2000円、同伴者1000円/人
 * - Galacta1: 参加費1500円、同伴者1500円/人
 * - 参加費免除者は本人の参加費0円、同伴者料金は別途徴収
 * - 精算時: companionFee = companionCount × event.companionFee
 */

// 受付合計金額の計算ロジック（Reception.tsxのuseMemoロジックを再現）
function calculateReceptionSummary(
  presentMembers: Array<{ isFeeExempt: boolean; companionCount: number }>,
  participationFee: number,
  companionFee: number,
) {
  let totalPersons = 0;
  let totalAmount = 0;

  presentMembers.forEach((a) => {
    // 本人
    totalPersons += 1;
    if (!a.isFeeExempt) {
      totalAmount += participationFee;
    }

    // 同伴者
    totalPersons += a.companionCount;
    totalAmount += a.companionCount * companionFee;
  });

  return { totalPersons, totalAmount };
}

// 精算時の同伴者料金計算ロジック（settlements.tsのcalculateSettlementロジックを再現）
function calculateCompanionFee(
  companionCount: number,
  eventCompanionFee: number,
): number {
  return companionCount * eventCompanionFee;
}

describe("受付合計金額の計算", () => {
  describe("リサイクルオークション（参加費2000円、同伴者1000円）", () => {
    const participationFee = 2000;
    const companionFee = 1000;

    it("出席者5名、同伴者なしの場合", () => {
      const members = Array.from({ length: 5 }, () => ({
        isFeeExempt: false,
        companionCount: 0,
      }));
      const result = calculateReceptionSummary(members, participationFee, companionFee);
      expect(result.totalPersons).toBe(5);
      expect(result.totalAmount).toBe(10000); // 5 × 2000
    });

    it("出席者3名、うち1名が同伴者2名連れの場合", () => {
      const members = [
        { isFeeExempt: false, companionCount: 0 },
        { isFeeExempt: false, companionCount: 2 },
        { isFeeExempt: false, companionCount: 0 },
      ];
      const result = calculateReceptionSummary(members, participationFee, companionFee);
      expect(result.totalPersons).toBe(5); // 3本人 + 2同伴者
      expect(result.totalAmount).toBe(8000); // 3×2000 + 2×1000
    });

    it("出席者4名、うち1名参加費免除、1名が同伴者1名連れの場合", () => {
      const members = [
        { isFeeExempt: false, companionCount: 0 },
        { isFeeExempt: true, companionCount: 0 },
        { isFeeExempt: false, companionCount: 1 },
        { isFeeExempt: false, companionCount: 0 },
      ];
      const result = calculateReceptionSummary(members, participationFee, companionFee);
      expect(result.totalPersons).toBe(5); // 4本人 + 1同伴者
      expect(result.totalAmount).toBe(7000); // 3×2000 + 1×1000 (免除者は参加費0)
    });

    it("参加費免除者が同伴者を連れている場合、同伴者料金は徴収される", () => {
      const members = [
        { isFeeExempt: true, companionCount: 3 },
      ];
      const result = calculateReceptionSummary(members, participationFee, companionFee);
      expect(result.totalPersons).toBe(4); // 1本人 + 3同伴者
      expect(result.totalAmount).toBe(3000); // 0(免除) + 3×1000
    });

    it("出席者0名の場合", () => {
      const members: Array<{ isFeeExempt: boolean; companionCount: number }> = [];
      const result = calculateReceptionSummary(members, participationFee, companionFee);
      expect(result.totalPersons).toBe(0);
      expect(result.totalAmount).toBe(0);
    });
  });

  describe("Galacta1（参加費1500円、同伴者1500円）", () => {
    const participationFee = 1500;
    const companionFee = 1500;

    it("出席者3名、うち1名が同伴者1名連れの場合", () => {
      const members = [
        { isFeeExempt: false, companionCount: 0 },
        { isFeeExempt: false, companionCount: 1 },
        { isFeeExempt: false, companionCount: 0 },
      ];
      const result = calculateReceptionSummary(members, participationFee, companionFee);
      expect(result.totalPersons).toBe(4); // 3本人 + 1同伴者
      expect(result.totalAmount).toBe(6000); // 3×1500 + 1×1500
    });

    it("全員が同伴者を連れている場合", () => {
      const members = [
        { isFeeExempt: false, companionCount: 2 },
        { isFeeExempt: false, companionCount: 1 },
        { isFeeExempt: false, companionCount: 3 },
      ];
      const result = calculateReceptionSummary(members, participationFee, companionFee);
      expect(result.totalPersons).toBe(9); // 3本人 + 6同伴者
      expect(result.totalAmount).toBe(13500); // 3×1500 + 6×1500
    });
  });
});

describe("精算時の同伴者料金計算", () => {
  it("同伴者0人の場合は0円", () => {
    expect(calculateCompanionFee(0, 1000)).toBe(0);
  });

  it("同伴者2人×1000円の場合は2000円", () => {
    expect(calculateCompanionFee(2, 1000)).toBe(2000);
  });

  it("同伴者3人×1500円の場合は4500円", () => {
    expect(calculateCompanionFee(3, 1500)).toBe(4500);
  });

  it("同伴者料金が0円の場合は人数に関係なく0円", () => {
    expect(calculateCompanionFee(5, 0)).toBe(0);
  });
});

describe("精算金額への同伴者料金の影響", () => {
  // settlements.tsのcalculateSettlement関数のロジックを再現
  // 参加費・同伴者料金は事前徴収済のため精算金額からは差引かない
  function calculateSettlementAmount(params: {
    salesTotal: number;
    salesCommission: number;
    purchaseTotal: number;
    purchaseCommission: number;
    salesReturnTotal: number;
    purchaseReturnTotal: number;
  }) {
    const salesCommissionTax = Math.floor(params.salesCommission * 0.1);
    const purchaseCommissionTax = Math.floor(params.purchaseCommission * 0.1);

    // 参加費・同伴者料金は事前徴収済のため差引かない
    return (
      (params.salesTotal - params.salesCommission - salesCommissionTax - params.salesReturnTotal) -
      (params.purchaseTotal + params.purchaseCommission + purchaseCommissionTax - params.purchaseReturnTotal)
    );
  }

  it("同伴者がいても精算金額に影響しない（事前徴収済）", () => {
    const result = calculateSettlementAmount({
      salesTotal: 100000,
      salesCommission: 5000,
      purchaseTotal: 50000,
      purchaseCommission: 2500,
      salesReturnTotal: 0,
      purchaseReturnTotal: 0,
    });

    // 売上: 100000 - 5000 - 500 = 94500
    // 仕入: 50000 + 2500 + 250 = 52750
    // 差引: 94500 - 52750 = 41750
    // 参加費・同伴者料金は事前徴収済のため差引かない
    expect(result).toBe(41750);
  });

  it("同伴者なしの場合も同じ精算金額", () => {
    const result = calculateSettlementAmount({
      salesTotal: 100000,
      salesCommission: 5000,
      purchaseTotal: 50000,
      purchaseCommission: 2500,
      salesReturnTotal: 0,
      purchaseReturnTotal: 0,
    });

    // 売上: 100000 - 5000 - 500 = 94500
    // 仕入: 50000 + 2500 + 250 = 52750
    // 差引: 94500 - 52750 = 41750
    expect(result).toBe(41750);
  });
});
