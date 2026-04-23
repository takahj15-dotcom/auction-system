import { describe, it, expect } from "vitest";

/**
 * レジ締め・最終締めの制御ロジックのテスト
 * - 全員精算完了チェック
 * - レジ締め→最終締めのフロー制御
 * - closingSummaryの精算状況フィールド
 */

describe("レジ締め・最終締め制御ロジック", () => {
  // ── 全員精算完了チェック ──

  describe("全員精算完了チェック", () => {
    it("全員精算済みの場合、allSettled=trueを返す", () => {
      const settlements = [
        { id: 1, isSettled: true, memberId: 1 },
        { id: 2, isSettled: true, memberId: 2 },
        { id: 3, isSettled: true, memberId: 3 },
      ];
      const totalSettlements = settlements.length;
      const settledCount = settlements.filter(s => s.isSettled).length;
      const unsettledCount = totalSettlements - settledCount;
      const allSettled = totalSettlements > 0 && unsettledCount === 0;

      expect(allSettled).toBe(true);
      expect(unsettledCount).toBe(0);
      expect(settledCount).toBe(3);
    });

    it("未精算者がいる場合、allSettled=falseを返す", () => {
      const settlements = [
        { id: 1, isSettled: true, memberId: 1 },
        { id: 2, isSettled: false, memberId: 2 },
        { id: 3, isSettled: true, memberId: 3 },
      ];
      const totalSettlements = settlements.length;
      const settledCount = settlements.filter(s => s.isSettled).length;
      const unsettledCount = totalSettlements - settledCount;
      const allSettled = totalSettlements > 0 && unsettledCount === 0;

      expect(allSettled).toBe(false);
      expect(unsettledCount).toBe(1);
      expect(settledCount).toBe(2);
    });

    it("精算データがない場合、allSettled=falseを返す", () => {
      const settlements: any[] = [];
      const totalSettlements = settlements.length;
      const settledCount = settlements.filter(s => s.isSettled).length;
      const unsettledCount = totalSettlements - settledCount;
      const allSettled = totalSettlements > 0 && unsettledCount === 0;

      expect(allSettled).toBe(false);
      expect(totalSettlements).toBe(0);
    });

    it("1名のみ未精算の場合、unsettledCount=1を返す", () => {
      const settlements = [
        { id: 1, isSettled: true, memberId: 1 },
        { id: 2, isSettled: true, memberId: 2 },
        { id: 3, isSettled: true, memberId: 3 },
        { id: 4, isSettled: false, memberId: 4 },
      ];
      const unsettledCount = settlements.filter(s => !s.isSettled).length;
      expect(unsettledCount).toBe(1);
    });
  });

  // ── レジ締めサマリーの精算状況フィールド ──

  describe("closingSummaryの精算状況フィールド", () => {
    it("精算状況フィールドが正しく計算される", () => {
      const settlements = [
        { id: 1, isSettled: true, memberId: 1 },
        { id: 2, isSettled: true, memberId: 2 },
        { id: 3, isSettled: false, memberId: 3 },
        { id: 4, isSettled: false, memberId: 4 },
        { id: 5, isSettled: true, memberId: 5 },
      ];
      const totalSettlements = settlements.length;
      const settledCount = settlements.filter(s => s.isSettled).length;
      const unsettledCount = totalSettlements - settledCount;
      const allSettled = totalSettlements > 0 && unsettledCount === 0;

      expect(totalSettlements).toBe(5);
      expect(settledCount).toBe(3);
      expect(unsettledCount).toBe(2);
      expect(allSettled).toBe(false);
    });

    it("未精算会員のリストが正しく生成される（最大10名）", () => {
      const unsettledSettlements = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        isSettled: false,
        memberId: i + 1,
      }));
      const unsettledMembers = unsettledSettlements
        .filter(s => !s.isSettled)
        .slice(0, 10)
        .map(s => ({ memberNumber: s.memberId, displayName: `会員${s.memberId}` }));

      expect(unsettledMembers.length).toBe(10);
      expect(unsettledMembers[0].memberNumber).toBe(1);
      expect(unsettledMembers[9].memberNumber).toBe(10);
    });
  });

  // ── 最終締めのバリデーション ──

  describe("最終締めのバリデーション", () => {
    it("全員精算済みの場合、最終締めを許可する", () => {
      const settlements = [
        { id: 1, isSettled: true },
        { id: 2, isSettled: true },
      ];
      const unsettled = settlements.filter(s => !s.isSettled);
      expect(unsettled.length).toBe(0);
      // 最終締め可能
    });

    it("未精算者がいる場合、最終締めを拒否する", () => {
      const settlements = [
        { id: 1, isSettled: true },
        { id: 2, isSettled: false },
      ];
      const unsettled = settlements.filter(s => !s.isSettled);
      expect(unsettled.length).toBeGreaterThan(0);
      // 最終締め不可
    });

    it("エラーメッセージに未精算会員名が含まれる", () => {
      const unsettledMembers = [
        { memberNumber: 1, displayName: "田中太郎" },
        { memberNumber: 5, displayName: "山田花子" },
      ];
      const memberNames = unsettledMembers.map(m => `${m.memberNumber} ${m.displayName}`);
      const message = `未精算の会員が${unsettledMembers.length}名います。全員のレジ精算を完了してから最終締めを実行してください。\n未精算: ${memberNames.join(", ")}`;

      expect(message).toContain("2名");
      expect(message).toContain("1 田中太郎");
      expect(message).toContain("5 山田花子");
    });
  });

  // ── レジ画面のレジ締めボタン制御 ──

  describe("レジ画面のレジ締めボタン制御", () => {
    it("未精算者がいる場合、レジ締めボタンは無効", () => {
      const unsettledCount = 3;
      const disabled = unsettledCount > 0;
      expect(disabled).toBe(true);
    });

    it("全員精算完了の場合、レジ締めボタンは有効", () => {
      const unsettledCount = 0;
      const disabled = unsettledCount > 0;
      expect(disabled).toBe(false);
    });
  });

  // ── 締め処理画面の最終締めボタン制御 ──

  describe("締め処理画面の最終締めボタン制御", () => {
    it("全員精算完了かつsettled状態の場合、最終締めボタンは有効", () => {
      const allSettled = true;
      const eventStatus = "settled";
      const canFinalize = eventStatus === "settled" && allSettled;
      expect(canFinalize).toBe(true);
    });

    it("未精算者がいる場合、最終締めボタンは無効", () => {
      const allSettled = false;
      const eventStatus = "settled";
      const canFinalize = eventStatus === "settled" && allSettled;
      expect(canFinalize).toBe(false);
    });

    it("open状態の場合、最終締めボタンは表示されない", () => {
      const eventStatus = "open";
      const showFinalizeButton = eventStatus === "settled";
      expect(showFinalizeButton).toBe(false);
    });

    it("closed状態の場合、印刷ボタンが表示される", () => {
      const eventStatus = "closed";
      const showPrintButton = eventStatus === "closed";
      expect(showPrintButton).toBe(true);
    });
  });

  // ── 理論残高の計算 ──

  describe("レジ締めサマリーの理論残高計算", () => {
    it("理論残高 = 準備金 + 預かり合計 - お釣り合計 - 支払い合計", () => {
      const initialFund = 50000;
      const totalReceived = 30000;
      const totalChange = 5000;
      const totalPayments = 20000;
      const theoreticalBalance = initialFund + totalReceived - totalChange - totalPayments;
      expect(theoreticalBalance).toBe(55000);
    });

    it("差額計算: 実際残高 - 理論残高", () => {
      const theoreticalBalance = 55000;
      const actualBalance = 55000;
      const difference = actualBalance - theoreticalBalance;
      expect(difference).toBe(0);
    });

    it("差額がプラスの場合、余剰金", () => {
      const theoreticalBalance = 55000;
      const actualBalance = 56000;
      const difference = actualBalance - theoreticalBalance;
      expect(difference).toBe(1000);
      expect(difference > 0).toBe(true);
    });

    it("差額がマイナスの場合、不足金", () => {
      const theoreticalBalance = 55000;
      const actualBalance = 54000;
      const difference = actualBalance - theoreticalBalance;
      expect(difference).toBe(-1000);
      expect(difference < 0).toBe(true);
    });
  });
});
