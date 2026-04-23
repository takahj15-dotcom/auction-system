import { describe, it, expect } from "vitest";

/**
 * 現金徴収チェック機能のテスト
 * 
 * ビジネスルール:
 * - 参加費・同伴者料金は事前に現金で徴収する
 * - 受付時に徴収済みチェックを行い、徴収漏れを防止する
 * - 参加費免除者でも同伴者がいれば徴収が必要
 * - 参加費免除者で同伴者なしの場合は徴収不要
 */

interface AttendanceRecord {
  isFeeExempt: boolean;
  companionCount: number;
  feeCollected: boolean;
}

// 徴収が必要かどうかの判定ロジック
function needsCollection(record: AttendanceRecord): boolean {
  return !record.isFeeExempt || record.companionCount > 0;
}

// 受付サマリー計算（Reception.tsxのuseMemoロジックを再現）
function calculateCollectionSummary(
  presentMembers: AttendanceRecord[],
  participationFee: number,
  companionFee: number,
) {
  let totalPersons = 0;
  let totalAmount = 0;
  let collectedCount = 0;
  let uncollectedCount = 0;
  let collectedAmount = 0;
  let uncollectedAmount = 0;

  presentMembers.forEach((a) => {
    totalPersons += 1;
    let memberAmount = 0;
    if (!a.isFeeExempt) {
      memberAmount += participationFee;
    }
    memberAmount += a.companionCount * companionFee;

    totalPersons += a.companionCount;
    totalAmount += memberAmount;

    const needs = needsCollection(a);
    if (!needs) {
      // 免除者で同伴者なし → 徴収不要なので徴収済み扱い
      collectedCount++;
    } else if (a.feeCollected) {
      collectedCount++;
      collectedAmount += memberAmount;
    } else {
      uncollectedCount++;
      uncollectedAmount += memberAmount;
    }
  });

  return { totalPersons, totalAmount, collectedCount, uncollectedCount, collectedAmount, uncollectedAmount };
}

describe("徴収要否の判定", () => {
  it("通常参加者は徴収が必要", () => {
    expect(needsCollection({ isFeeExempt: false, companionCount: 0, feeCollected: false })).toBe(true);
  });

  it("参加費免除者で同伴者なしは徴収不要", () => {
    expect(needsCollection({ isFeeExempt: true, companionCount: 0, feeCollected: false })).toBe(false);
  });

  it("参加費免除者でも同伴者がいれば徴収が必要", () => {
    expect(needsCollection({ isFeeExempt: true, companionCount: 1, feeCollected: false })).toBe(true);
    expect(needsCollection({ isFeeExempt: true, companionCount: 3, feeCollected: false })).toBe(true);
  });
});

describe("徴収サマリーの計算", () => {
  const participationFee = 2000;
  const companionFee = 1000;

  it("全員未徴収の場合", () => {
    const members: AttendanceRecord[] = [
      { isFeeExempt: false, companionCount: 0, feeCollected: false },
      { isFeeExempt: false, companionCount: 1, feeCollected: false },
      { isFeeExempt: false, companionCount: 0, feeCollected: false },
    ];
    const result = calculateCollectionSummary(members, participationFee, companionFee);
    expect(result.totalAmount).toBe(2000 + 2000 + 1000 + 2000); // 7000
    expect(result.collectedCount).toBe(0);
    expect(result.uncollectedCount).toBe(3);
    expect(result.uncollectedAmount).toBe(7000);
    expect(result.collectedAmount).toBe(0);
  });

  it("全員徴収済みの場合", () => {
    const members: AttendanceRecord[] = [
      { isFeeExempt: false, companionCount: 0, feeCollected: true },
      { isFeeExempt: false, companionCount: 2, feeCollected: true },
    ];
    const result = calculateCollectionSummary(members, participationFee, companionFee);
    expect(result.totalAmount).toBe(2000 + 2000 + 2000); // 6000
    expect(result.collectedCount).toBe(2);
    expect(result.uncollectedCount).toBe(0);
    expect(result.collectedAmount).toBe(6000);
    expect(result.uncollectedAmount).toBe(0);
  });

  it("一部徴収済みの場合", () => {
    const members: AttendanceRecord[] = [
      { isFeeExempt: false, companionCount: 0, feeCollected: true },  // 2000 徴収済み
      { isFeeExempt: false, companionCount: 1, feeCollected: false }, // 3000 未徴収
      { isFeeExempt: false, companionCount: 0, feeCollected: true },  // 2000 徴収済み
    ];
    const result = calculateCollectionSummary(members, participationFee, companionFee);
    expect(result.totalAmount).toBe(7000);
    expect(result.collectedCount).toBe(2);
    expect(result.uncollectedCount).toBe(1);
    expect(result.collectedAmount).toBe(4000);
    expect(result.uncollectedAmount).toBe(3000);
  });

  it("参加費免除者（同伴者なし）は徴収不要として徴収済み扱い", () => {
    const members: AttendanceRecord[] = [
      { isFeeExempt: true, companionCount: 0, feeCollected: false },  // 徴収不要 → 徴収済み扱い
      { isFeeExempt: false, companionCount: 0, feeCollected: false }, // 2000 未徴収
    ];
    const result = calculateCollectionSummary(members, participationFee, companionFee);
    expect(result.totalAmount).toBe(2000);
    expect(result.collectedCount).toBe(1); // 免除者は徴収済み扱い
    expect(result.uncollectedCount).toBe(1);
    expect(result.collectedAmount).toBe(0); // 免除者の金額は0
    expect(result.uncollectedAmount).toBe(2000);
  });

  it("参加費免除者（同伴者あり）の徴収チェック", () => {
    const members: AttendanceRecord[] = [
      { isFeeExempt: true, companionCount: 2, feeCollected: false },  // 同伴者2000円 未徴収
      { isFeeExempt: true, companionCount: 1, feeCollected: true },   // 同伴者1000円 徴収済み
    ];
    const result = calculateCollectionSummary(members, participationFee, companionFee);
    expect(result.totalAmount).toBe(3000); // 同伴者料金のみ
    expect(result.collectedCount).toBe(1);
    expect(result.uncollectedCount).toBe(1);
    expect(result.collectedAmount).toBe(1000);
    expect(result.uncollectedAmount).toBe(2000);
  });

  it("出席者なしの場合", () => {
    const members: AttendanceRecord[] = [];
    const result = calculateCollectionSummary(members, participationFee, companionFee);
    expect(result.totalAmount).toBe(0);
    expect(result.collectedCount).toBe(0);
    expect(result.uncollectedCount).toBe(0);
    expect(result.collectedAmount).toBe(0);
    expect(result.uncollectedAmount).toBe(0);
  });

  it("混合パターン（通常・免除・同伴者あり）", () => {
    const members: AttendanceRecord[] = [
      { isFeeExempt: false, companionCount: 0, feeCollected: true },  // 2000 徴収済み
      { isFeeExempt: false, companionCount: 2, feeCollected: true },  // 4000 徴収済み
      { isFeeExempt: true, companionCount: 0, feeCollected: false },  // 0 徴収不要
      { isFeeExempt: true, companionCount: 1, feeCollected: false },  // 1000 未徴収
      { isFeeExempt: false, companionCount: 0, feeCollected: false }, // 2000 未徴収
    ];
    const result = calculateCollectionSummary(members, participationFee, companionFee);
    expect(result.totalAmount).toBe(9000);
    expect(result.totalPersons).toBe(5 + 3); // 5名 + 同伴者3名
    expect(result.collectedCount).toBe(3); // 2名徴収済み + 1名徴収不要
    expect(result.uncollectedCount).toBe(2);
    expect(result.collectedAmount).toBe(6000);
    expect(result.uncollectedAmount).toBe(3000);
  });
});

describe("Galacta1（参加費1500円、同伴者1500円）", () => {
  const participationFee = 1500;
  const companionFee = 1500;

  it("全員同伴者ありで一部徴収済み", () => {
    const members: AttendanceRecord[] = [
      { isFeeExempt: false, companionCount: 1, feeCollected: true },  // 3000 徴収済み
      { isFeeExempt: false, companionCount: 1, feeCollected: false }, // 3000 未徴収
      { isFeeExempt: false, companionCount: 2, feeCollected: true },  // 4500 徴収済み
    ];
    const result = calculateCollectionSummary(members, participationFee, companionFee);
    expect(result.totalAmount).toBe(10500);
    expect(result.collectedCount).toBe(2);
    expect(result.uncollectedCount).toBe(1);
    expect(result.collectedAmount).toBe(7500);
    expect(result.uncollectedAmount).toBe(3000);
  });
});
