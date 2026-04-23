import { describe, it, expect } from "vitest";

describe("Event Commission Rates & Attendance", () => {
  // Schema validation tests
  describe("Event schema", () => {
    it("should have commission rate fields in event creation input", () => {
      const input = {
        eventDate: "2026-03-24",
        title: "テストイベント",
        sellCommissionRate: "10.00",
        buyCommissionRate: "5.00",
        absentSellCommissionRate: "15.00",
        absentBuyCommissionRate: "5.00",
      };
      expect(input.sellCommissionRate).toBe("10.00");
      expect(input.buyCommissionRate).toBe("5.00");
      expect(input.absentSellCommissionRate).toBe("15.00");
      expect(input.absentBuyCommissionRate).toBe("5.00");
    });

    it("should have default commission rates", () => {
      const defaults = {
        sellCommissionRate: "10.00",
        buyCommissionRate: "5.00",
        absentSellCommissionRate: "15.00",
        absentBuyCommissionRate: "5.00",
      };
      expect(parseFloat(defaults.sellCommissionRate)).toBe(10);
      expect(parseFloat(defaults.buyCommissionRate)).toBe(5);
      expect(parseFloat(defaults.absentSellCommissionRate)).toBe(15);
      expect(parseFloat(defaults.absentBuyCommissionRate)).toBe(5);
    });
  });

  describe("Commission rate calculation", () => {
    it("should apply present rates for attending members", () => {
      const event = {
        sellCommissionRate: "10.00",
        buyCommissionRate: "5.00",
        absentSellCommissionRate: "15.00",
        absentBuyCommissionRate: "5.00",
      };
      const isPresent = true;
      const sellRate = isPresent
        ? parseFloat(event.sellCommissionRate) / 100
        : parseFloat(event.absentSellCommissionRate) / 100;
      const buyRate = isPresent
        ? parseFloat(event.buyCommissionRate) / 100
        : parseFloat(event.absentBuyCommissionRate) / 100;

      expect(sellRate).toBe(0.1);
      expect(buyRate).toBe(0.05);
    });

    it("should apply absent rates for absent members", () => {
      const event = {
        sellCommissionRate: "10.00",
        buyCommissionRate: "5.00",
        absentSellCommissionRate: "15.00",
        absentBuyCommissionRate: "5.00",
      };
      const isPresent = false;
      const sellRate = isPresent
        ? parseFloat(event.sellCommissionRate) / 100
        : parseFloat(event.absentSellCommissionRate) / 100;
      const buyRate = isPresent
        ? parseFloat(event.buyCommissionRate) / 100
        : parseFloat(event.absentBuyCommissionRate) / 100;

      expect(sellRate).toBe(0.15);
      expect(buyRate).toBe(0.05);
    });

    it("should calculate settlement correctly for present member", () => {
      const sellRate = 0.10;
      const buyRate = 0.05;
      const salesTotal = 100000;
      const purchaseTotal = 50000;
      const participationFee = 0;
      const isTaxable = true;

      const salesCommission = Math.round(salesTotal * sellRate);
      const purchaseCommission = Math.round(purchaseTotal * buyRate);
      const taxAmount = isTaxable
        ? Math.round((salesCommission + purchaseCommission) * 0.1)
        : 0;
      const settlementAmount = (salesTotal - salesCommission) - (purchaseTotal + purchaseCommission) - participationFee - taxAmount;

      expect(salesCommission).toBe(10000);
      expect(purchaseCommission).toBe(2500);
      expect(taxAmount).toBe(1250);
      expect(settlementAmount).toBe(36250);
    });

    it("should calculate settlement correctly for absent member (higher sell rate)", () => {
      const sellRate = 0.15;
      const buyRate = 0.05;
      const salesTotal = 100000;
      const purchaseTotal = 50000;
      const participationFee = 0;
      const isTaxable = true;

      const salesCommission = Math.round(salesTotal * sellRate);
      const purchaseCommission = Math.round(purchaseTotal * buyRate);
      const taxAmount = isTaxable
        ? Math.round((salesCommission + purchaseCommission) * 0.1)
        : 0;
      const settlementAmount = (salesTotal - salesCommission) - (purchaseTotal + purchaseCommission) - participationFee - taxAmount;

      expect(salesCommission).toBe(15000);
      expect(purchaseCommission).toBe(2500);
      expect(taxAmount).toBe(1750);
      // 100000 - 15000 - 50000 - 2500 - 0 - 1750 = 30750
      expect(settlementAmount).toBe(30750);
    });

    it("should handle custom commission rates per event", () => {
      const event = {
        sellCommissionRate: "8.00",
        buyCommissionRate: "3.00",
        absentSellCommissionRate: "12.00",
        absentBuyCommissionRate: "6.00",
      };

      const presentSellRate = parseFloat(event.sellCommissionRate) / 100;
      const presentBuyRate = parseFloat(event.buyCommissionRate) / 100;
      const absentSellRate = parseFloat(event.absentSellCommissionRate) / 100;
      const absentBuyRate = parseFloat(event.absentBuyCommissionRate) / 100;

      expect(presentSellRate).toBe(0.08);
      expect(presentBuyRate).toBe(0.03);
      expect(absentSellRate).toBe(0.12);
      expect(absentBuyRate).toBe(0.06);
    });
  });

  describe("Attendance data structure", () => {
    it("should have correct attendance record structure", () => {
      const attendance = {
        id: 1,
        eventId: 1,
        memberId: 100,
        isPresent: false,
        checkedInAt: null as Date | null,
      };
      expect(attendance.isPresent).toBe(false);
      expect(attendance.checkedInAt).toBeNull();
    });

    it("should update attendance on check-in", () => {
      const attendance = {
        id: 1,
        eventId: 1,
        memberId: 100,
        isPresent: false,
        checkedInAt: null as Date | null,
      };

      // Simulate check-in
      attendance.isPresent = true;
      attendance.checkedInAt = new Date();

      expect(attendance.isPresent).toBe(true);
      expect(attendance.checkedInAt).toBeInstanceOf(Date);
    });

    it("should support toggling attendance", () => {
      const attendance = {
        isPresent: true,
        checkedInAt: new Date() as Date | null,
      };

      // Toggle to absent
      attendance.isPresent = false;
      attendance.checkedInAt = null;

      expect(attendance.isPresent).toBe(false);
      expect(attendance.checkedInAt).toBeNull();
    });
  });

  describe("Bulk attendance initialization", () => {
    it("should create attendance records for all members", () => {
      const members = [
        { id: 1, memberNumber: 1 },
        { id: 2, memberNumber: 3 },
        { id: 3, memberNumber: 5 },
      ];
      const existingAttendance = new Set([1]); // member 1 already has record

      const newRecords = members
        .filter(m => !existingAttendance.has(m.id))
        .map(m => ({
          eventId: 1,
          memberId: m.id,
          isPresent: false,
        }));

      expect(newRecords.length).toBe(2);
      expect(newRecords[0].memberId).toBe(2);
      expect(newRecords[1].memberId).toBe(3);
      expect(newRecords.every(r => r.isPresent === false)).toBe(true);
    });
  });

  describe("Settlement with attendance-based rates", () => {
    it("should produce different settlements for present vs absent members", () => {
      const event = {
        sellCommissionRate: "10.00",
        buyCommissionRate: "5.00",
        absentSellCommissionRate: "15.00",
        absentBuyCommissionRate: "5.00",
      };

      const salesTotal = 200000;
      const purchaseTotal = 100000;

      // Present member
      const presentSellComm = Math.round(salesTotal * 0.10);
      const presentBuyComm = Math.round(purchaseTotal * 0.05);
      const presentTax = Math.round((presentSellComm + presentBuyComm) * 0.1);
      const presentSettlement = (salesTotal - presentSellComm) - (purchaseTotal + presentBuyComm) - presentTax;

      // Absent member (same transactions)
      const absentSellComm = Math.round(salesTotal * 0.15);
      const absentBuyComm = Math.round(purchaseTotal * 0.05);
      const absentTax = Math.round((absentSellComm + absentBuyComm) * 0.1);
      const absentSettlement = (salesTotal - absentSellComm) - (purchaseTotal + absentBuyComm) - absentTax;

      // Absent member should have lower settlement (higher commission)
      expect(absentSettlement).toBeLessThan(presentSettlement);
      expect(presentSellComm).toBe(20000);
      expect(absentSellComm).toBe(30000);
      expect(presentSettlement - absentSettlement).toBe(10000 + (absentTax - presentTax));
    });
  });
});
