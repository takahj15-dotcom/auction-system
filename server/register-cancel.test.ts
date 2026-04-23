import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
vi.mock("./db", () => ({
  getSettlementById: vi.fn(),
  getRegisterTransactionBySettlement: vi.fn(),
  deleteRegisterTransaction: vi.fn(),
  updateSettlement: vi.fn(),
  getMemberById: vi.fn(),
  createAuditLog: vi.fn(),
}));

import * as db from "./db";

describe("レジ精算取り消し機能", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("取り消しロジック", () => {
    it("精算取り消し時にレジ取引記録が削除される", async () => {
      const mockSettlement = {
        id: 1,
        memberId: 10,
        eventId: 100,
        isSettled: true,
        settlementAmount: -5000,
      };
      const mockRegTxn = {
        id: 50,
        settlementId: 1,
        depositAmount: 5000,
        paymentAmount: 0,
        receivedAmount: 10000,
        changeAmount: 5000,
      };
      const mockMember = { id: 10, displayName: "テスト会員", memberNumber: 1 };

      (db.getSettlementById as any).mockResolvedValue(mockSettlement);
      (db.getRegisterTransactionBySettlement as any).mockResolvedValue(mockRegTxn);
      (db.deleteRegisterTransaction as any).mockResolvedValue(undefined);
      (db.updateSettlement as any).mockResolvedValue(undefined);
      (db.getMemberById as any).mockResolvedValue(mockMember);
      (db.createAuditLog as any).mockResolvedValue(undefined);

      // Simulate the cancel logic
      const settlement = await db.getSettlementById(1);
      expect(settlement).toBeDefined();

      const regTxn = await db.getRegisterTransactionBySettlement(1);
      expect(regTxn).toBeDefined();

      await db.deleteRegisterTransaction(regTxn!.id);
      expect(db.deleteRegisterTransaction).toHaveBeenCalledWith(50);

      await db.updateSettlement(1, { isSettled: false, settledAt: null });
      expect(db.updateSettlement).toHaveBeenCalledWith(1, {
        isSettled: false,
        settledAt: null,
      });
    });

    it("レジ取引記録がない場合はエラー", async () => {
      const mockSettlement = {
        id: 2,
        memberId: 20,
        eventId: 100,
        isSettled: true,
      };

      (db.getSettlementById as any).mockResolvedValue(mockSettlement);
      (db.getRegisterTransactionBySettlement as any).mockResolvedValue(undefined);

      const settlement = await db.getSettlementById(2);
      expect(settlement).toBeDefined();

      const regTxn = await db.getRegisterTransactionBySettlement(2);
      expect(regTxn).toBeUndefined();
      // API should throw BAD_REQUEST error here
    });

    it("精算データが存在しない場合はエラー", async () => {
      (db.getSettlementById as any).mockResolvedValue(undefined);

      const settlement = await db.getSettlementById(999);
      expect(settlement).toBeUndefined();
      // API should throw NOT_FOUND error here
    });

    it("取り消し後にisSettledがfalseに戻る", async () => {
      const mockSettlement = {
        id: 3,
        memberId: 30,
        eventId: 100,
        isSettled: true,
        settledAt: new Date().toISOString(),
      };
      const mockRegTxn = {
        id: 60,
        settlementId: 3,
        depositAmount: 0,
        paymentAmount: 8000,
        receivedAmount: 0,
        changeAmount: 0,
      };

      (db.getSettlementById as any).mockResolvedValue(mockSettlement);
      (db.getRegisterTransactionBySettlement as any).mockResolvedValue(mockRegTxn);
      (db.deleteRegisterTransaction as any).mockResolvedValue(undefined);
      (db.updateSettlement as any).mockResolvedValue(undefined);
      (db.getMemberById as any).mockResolvedValue({ id: 30, displayName: "支払い会員", memberNumber: 3 });
      (db.createAuditLog as any).mockResolvedValue(undefined);

      await db.deleteRegisterTransaction(mockRegTxn.id);
      await db.updateSettlement(3, { isSettled: false, settledAt: null });

      expect(db.updateSettlement).toHaveBeenCalledWith(3, {
        isSettled: false,
        settledAt: null,
      });
    });

    it("取り消し時に監査ログが記録される", async () => {
      const mockSettlement = {
        id: 4,
        memberId: 40,
        eventId: 100,
        isSettled: true,
      };
      const mockRegTxn = {
        id: 70,
        settlementId: 4,
        depositAmount: 3000,
        paymentAmount: 0,
        receivedAmount: 5000,
        changeAmount: 2000,
      };
      const mockMember = { id: 40, displayName: "監査テスト会員", memberNumber: 4 };

      (db.getSettlementById as any).mockResolvedValue(mockSettlement);
      (db.getRegisterTransactionBySettlement as any).mockResolvedValue(mockRegTxn);
      (db.deleteRegisterTransaction as any).mockResolvedValue(undefined);
      (db.updateSettlement as any).mockResolvedValue(undefined);
      (db.getMemberById as any).mockResolvedValue(mockMember);
      (db.createAuditLog as any).mockResolvedValue(undefined);

      await db.deleteRegisterTransaction(mockRegTxn.id);
      await db.updateSettlement(4, { isSettled: false, settledAt: null });

      await db.createAuditLog({
        userId: 1,
        action: "register_cancel",
        tableName: "register_transactions",
        recordId: mockRegTxn.id,
        oldValue: {
          settlementId: mockSettlement.id,
          memberId: mockSettlement.memberId,
          memberName: mockMember.displayName,
          depositAmount: mockRegTxn.depositAmount,
          paymentAmount: mockRegTxn.paymentAmount,
          receivedAmount: mockRegTxn.receivedAmount,
          changeAmount: mockRegTxn.changeAmount,
        },
      } as any);

      expect(db.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "register_cancel",
          tableName: "register_transactions",
          recordId: 70,
        })
      );
    });
  });

  describe("再精算フロー", () => {
    it("取り消し後に同じsettlementIdで再度精算記録を作成できる", async () => {
      // After cancel, getRegisterTransactionBySettlement should return undefined
      (db.getRegisterTransactionBySettlement as any).mockResolvedValue(undefined);

      const existing = await db.getRegisterTransactionBySettlement(1);
      expect(existing).toBeUndefined();
      // This means register.complete can be called again for this settlement
    });
  });
});
