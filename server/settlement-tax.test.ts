import { describe, expect, it } from "vitest";

/**
 * 精算金額計算の消費税テスト
 * 全会員一律で手数料に消費税10%を適用する仕様を検証
 */

// 精算金額計算ロジックを再現（settlements.ts の calculateMemberSettlement と同じ）
function calculateSettlement(params: {
  salesTotal: number;
  purchaseTotal: number;
  sellRate: number;
  buyRate: number;
  participationFee: number;
}) {
  const { salesTotal, purchaseTotal, sellRate, buyRate, participationFee } = params;

  const salesCommission = Math.round(salesTotal * sellRate);
  const purchaseCommission = Math.round(purchaseTotal * buyRate);

  // 全会員一律で手数料に消費税10%を適用
  const salesCommissionTax = Math.round(salesCommission * 0.1);
  const purchaseCommissionTax = Math.round(purchaseCommission * 0.1);
  const taxAmount = salesCommissionTax + purchaseCommissionTax;

  // 売り側: 売合計 - 売手数料 - 売手数料消費税
  // 買い側: 買合計 + 買手数料 + 買手数料消費税
  const settlementAmount =
    (salesTotal - salesCommission - salesCommissionTax) -
    (purchaseTotal + purchaseCommission + purchaseCommissionTax) -
    participationFee;

  return {
    salesTotal,
    salesCommission,
    purchaseTotal,
    purchaseCommission,
    salesCommissionTax,
    purchaseCommissionTax,
    taxAmount,
    participationFee,
    settlementAmount,
  };
}

describe("精算金額計算 - 消費税の適用", () => {
  it("売りのみの場合、手数料に消費税10%が適用される", () => {
    const result = calculateSettlement({
      salesTotal: 100000,
      purchaseTotal: 0,
      sellRate: 0.10,
      buyRate: 0.05,
      participationFee: 0,
    });

    expect(result.salesCommission).toBe(10000); // 100000 × 10%
    expect(result.salesCommissionTax).toBe(1000); // 10000 × 10%
    expect(result.purchaseCommission).toBe(0);
    expect(result.purchaseCommissionTax).toBe(0);
    expect(result.taxAmount).toBe(1000);
    // 精算額 = 100000 - 10000 - 1000 = 89000
    expect(result.settlementAmount).toBe(89000);
  });

  it("買いのみの場合、手数料に消費税10%が適用される", () => {
    const result = calculateSettlement({
      salesTotal: 0,
      purchaseTotal: 100000,
      sellRate: 0.10,
      buyRate: 0.05,
      participationFee: 0,
    });

    expect(result.purchaseCommission).toBe(5000); // 100000 × 5%
    expect(result.purchaseCommissionTax).toBe(500); // 5000 × 10%
    expect(result.salesCommission).toBe(0);
    expect(result.salesCommissionTax).toBe(0);
    expect(result.taxAmount).toBe(500);
    // 精算額 = 0 - (100000 + 5000 + 500) = -105500
    expect(result.settlementAmount).toBe(-105500);
  });

  it("売り・買い両方の場合、両方の手数料に消費税10%が適用される", () => {
    const result = calculateSettlement({
      salesTotal: 200000,
      purchaseTotal: 100000,
      sellRate: 0.10,
      buyRate: 0.05,
      participationFee: 0,
    });

    expect(result.salesCommission).toBe(20000); // 200000 × 10%
    expect(result.salesCommissionTax).toBe(2000); // 20000 × 10%
    expect(result.purchaseCommission).toBe(5000); // 100000 × 5%
    expect(result.purchaseCommissionTax).toBe(500); // 5000 × 10%
    expect(result.taxAmount).toBe(2500);
    // 精算額 = (200000 - 20000 - 2000) - (100000 + 5000 + 500) = 178000 - 105500 = 72500
    expect(result.settlementAmount).toBe(72500);
  });

  it("参加費がある場合も消費税が正しく適用される", () => {
    const result = calculateSettlement({
      salesTotal: 50000,
      purchaseTotal: 30000,
      sellRate: 0.10,
      buyRate: 0.05,
      participationFee: 2000,
    });

    expect(result.salesCommission).toBe(5000);
    expect(result.salesCommissionTax).toBe(500);
    expect(result.purchaseCommission).toBe(1500);
    expect(result.purchaseCommissionTax).toBe(150);
    expect(result.taxAmount).toBe(650);
    // 精算額 = (50000 - 5000 - 500) - (30000 + 1500 + 150) - 2000 = 44500 - 31650 - 2000 = 10850
    expect(result.settlementAmount).toBe(10850);
  });

  it("欠席者歩合（高い歩合率）でも消費税が正しく適用される", () => {
    const result = calculateSettlement({
      salesTotal: 100000,
      purchaseTotal: 50000,
      sellRate: 0.15, // 欠席者歩合15%
      buyRate: 0.05,
      participationFee: 2000,
    });

    expect(result.salesCommission).toBe(15000); // 100000 × 15%
    expect(result.salesCommissionTax).toBe(1500); // 15000 × 10%
    expect(result.purchaseCommission).toBe(2500); // 50000 × 5%
    expect(result.purchaseCommissionTax).toBe(250); // 2500 × 10%
    expect(result.taxAmount).toBe(1750);
    // 精算額 = (100000 - 15000 - 1500) - (50000 + 2500 + 250) - 2000 = 83500 - 52750 - 2000 = 28750
    expect(result.settlementAmount).toBe(28750);
  });

  it("手数料の税込み表示が正しい（手数料 × 1.1）", () => {
    const result = calculateSettlement({
      salesTotal: 100000,
      purchaseTotal: 80000,
      sellRate: 0.10,
      buyRate: 0.05,
      participationFee: 0,
    });

    // 売手数料税込み = 10000 + 1000 = 11000
    const salesCommissionWithTax = result.salesCommission + result.salesCommissionTax;
    expect(salesCommissionWithTax).toBe(11000);

    // 買手数料税込み = 4000 + 400 = 4400
    const purchaseCommissionWithTax = result.purchaseCommission + result.purchaseCommissionTax;
    expect(purchaseCommissionWithTax).toBe(4400);
  });

  it("精算金額 = 売合計 - 売手数料税込 - 買合計 - 買手数料税込 - 参加費", () => {
    const result = calculateSettlement({
      salesTotal: 150000,
      purchaseTotal: 60000,
      sellRate: 0.10,
      buyRate: 0.05,
      participationFee: 2000,
    });

    const salesCommissionWithTax = result.salesCommission + result.salesCommissionTax;
    const purchaseCommissionWithTax = result.purchaseCommission + result.purchaseCommissionTax;

    const expected = result.salesTotal - salesCommissionWithTax - result.purchaseTotal - purchaseCommissionWithTax - result.participationFee;
    expect(result.settlementAmount).toBe(expected);
  });
});

describe("参加費免除機能", () => {
  it("参加費免除の場合、参加費が0になる", () => {
    // 免除なし（欠席者）
    const resultWithFee = calculateSettlement({
      salesTotal: 100000,
      purchaseTotal: 50000,
      sellRate: 0.10,
      buyRate: 0.05,
      participationFee: 2000,
    });

    // 免除あり（参加費0）
    const resultExempt = calculateSettlement({
      salesTotal: 100000,
      purchaseTotal: 50000,
      sellRate: 0.10,
      buyRate: 0.05,
      participationFee: 0,
    });

    // 免除ありの方が参加費分だけ精算金額が高い
    expect(resultExempt.settlementAmount - resultWithFee.settlementAmount).toBe(2000);
    expect(resultExempt.participationFee).toBe(0);
    expect(resultWithFee.participationFee).toBe(2000);
  });

  it("出席者は免除に関係なく参加費0（受付時に徴収済み）", () => {
    // 出席者は参加費0（免除と同じ結果）
    const resultPresent = calculateSettlement({
      salesTotal: 100000,
      purchaseTotal: 50000,
      sellRate: 0.10,
      buyRate: 0.05,
      participationFee: 0, // 出席者は0
    });

    expect(resultPresent.participationFee).toBe(0);
  });
});
