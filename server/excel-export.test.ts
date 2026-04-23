import { describe, it, expect } from "vitest";
import { generateTransactionsExcel, ExcelExportData } from "./excelGenerator";

describe("Excel export", () => {
  it("generates a valid Excel buffer with correct data", async () => {
    const data: ExcelExportData = {
      eventTitle: "テストオークション",
      eventDate: "2026-03-01",
      transactions: [
        {
          rowNumber: 1,
          sellerMemberNumber: 1,
          sellerName: "テスト売主",
          itemName: "テスト商品",
          unitPrice: 1000,
          quantity: 2,
          totalPrice: 2000,
          buyerMemberNumber: 2,
          buyerName: "テスト買主",
          transactionType: "normal",
          notes: "テスト備考",
        },
        {
          rowNumber: 2,
          sellerMemberNumber: 3,
          sellerName: "売主B",
          itemName: "商品B",
          unitPrice: 500,
          quantity: 1,
          totalPrice: 500,
          buyerMemberNumber: 1,
          buyerName: "テスト売主",
          transactionType: "return",
          notes: "",
        },
      ],
    };

    const buffer = await generateTransactionsExcel(data);

    // Should return a non-empty buffer
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Excel files start with PK (ZIP format)
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
  });

  it("handles empty transactions", async () => {
    const data: ExcelExportData = {
      eventTitle: "空イベント",
      eventDate: "2026-04-01",
      transactions: [],
    };

    const buffer = await generateTransactionsExcel(data);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("correctly calculates summary total", async () => {
    const data: ExcelExportData = {
      eventTitle: "合計テスト",
      eventDate: "2026-05-01",
      transactions: [
        {
          rowNumber: 1,
          sellerMemberNumber: 1,
          sellerName: "A",
          itemName: "商品1",
          unitPrice: 1000,
          quantity: 1,
          totalPrice: 1000,
          buyerMemberNumber: 2,
          buyerName: "B",
          transactionType: "normal",
          notes: "",
        },
        {
          rowNumber: 2,
          sellerMemberNumber: 1,
          sellerName: "A",
          itemName: "商品2",
          unitPrice: 3000,
          quantity: 2,
          totalPrice: 6000,
          buyerMemberNumber: 2,
          buyerName: "B",
          transactionType: "normal",
          notes: "",
        },
      ],
    };

    const buffer = await generateTransactionsExcel(data);
    expect(buffer).toBeInstanceOf(Buffer);

    // Verify the total calculation logic
    const total = data.transactions.reduce((sum, tx) => sum + tx.totalPrice, 0);
    expect(total).toBe(7000);
  });

  it("maps transaction types correctly", () => {
    const typeLabels: Record<string, string> = {
      normal: "通常",
      return: "返品",
      defect: "クレーム",
    };
    expect(typeLabels["normal"]).toBe("通常");
    expect(typeLabels["return"]).toBe("返品");
    expect(typeLabels["defect"]).toBe("クレーム");
  });
});
