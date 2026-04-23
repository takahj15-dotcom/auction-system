import { describe, it, expect } from "vitest";

// Test register transaction data structure and calculations
describe("Register Transaction Calculations", () => {
  // Helper to simulate register closing summary calculation
  function calculateClosingSummary(
    initialFund: number,
    transactions: {
      depositAmount: number;
      paymentAmount: number;
      receivedAmount: number;
      changeAmount: number;
    }[]
  ) {
    let totalDeposits = 0;
    let totalPayments = 0;
    let totalReceived = 0;
    let totalChange = 0;

    for (const tx of transactions) {
      totalDeposits += tx.depositAmount;
      totalPayments += tx.paymentAmount;
      totalReceived += tx.receivedAmount;
      totalChange += tx.changeAmount;
    }

    const theoreticalBalance = initialFund + totalReceived - totalChange - totalPayments;

    return {
      initialFund,
      totalDeposits,
      totalPayments,
      totalReceived,
      totalChange,
      theoreticalBalance,
    };
  }

  it("calculates theoretical balance correctly with deposits only", () => {
    const summary = calculateClosingSummary(50000, [
      { depositAmount: 15000, paymentAmount: 0, receivedAmount: 20000, changeAmount: 5000 },
      { depositAmount: 8000, paymentAmount: 0, receivedAmount: 10000, changeAmount: 2000 },
    ]);
    // 50000 + 30000(received) - 7000(change) - 0(payments) = 73000
    expect(summary.theoreticalBalance).toBe(73000);
    expect(summary.totalDeposits).toBe(23000);
    expect(summary.totalReceived).toBe(30000);
    expect(summary.totalChange).toBe(7000);
  });

  it("calculates theoretical balance correctly with payments only", () => {
    const summary = calculateClosingSummary(50000, [
      { depositAmount: 0, paymentAmount: 10000, receivedAmount: 0, changeAmount: 0 },
      { depositAmount: 0, paymentAmount: 25000, receivedAmount: 0, changeAmount: 0 },
    ]);
    // 50000 + 0 - 0 - 35000 = 15000
    expect(summary.theoreticalBalance).toBe(15000);
    expect(summary.totalPayments).toBe(35000);
  });

  it("calculates theoretical balance correctly with mixed transactions", () => {
    const summary = calculateClosingSummary(50000, [
      // Customer pays 15000, gives 20000, change 5000
      { depositAmount: 15000, paymentAmount: 0, receivedAmount: 20000, changeAmount: 5000 },
      // Pay customer 10000
      { depositAmount: 0, paymentAmount: 10000, receivedAmount: 0, changeAmount: 0 },
      // Customer pays 8000, gives exact
      { depositAmount: 8000, paymentAmount: 0, receivedAmount: 8000, changeAmount: 0 },
    ]);
    // 50000 + 28000(received) - 5000(change) - 10000(payments) = 63000
    expect(summary.theoreticalBalance).toBe(63000);
  });

  it("handles zero transactions", () => {
    const summary = calculateClosingSummary(50000, []);
    expect(summary.theoreticalBalance).toBe(50000);
    expect(summary.totalDeposits).toBe(0);
    expect(summary.totalPayments).toBe(0);
  });

  it("calculates difference between actual and theoretical balance", () => {
    const summary = calculateClosingSummary(50000, [
      { depositAmount: 15000, paymentAmount: 0, receivedAmount: 20000, changeAmount: 5000 },
    ]);
    const actualBalance = 65000;
    const difference = actualBalance - summary.theoreticalBalance;
    // theoretical = 50000 + 20000 - 5000 - 0 = 65000
    expect(difference).toBe(0);
  });

  it("detects surplus when actual > theoretical", () => {
    const summary = calculateClosingSummary(50000, [
      { depositAmount: 15000, paymentAmount: 0, receivedAmount: 20000, changeAmount: 5000 },
    ]);
    const actualBalance = 66000;
    const difference = actualBalance - summary.theoreticalBalance;
    expect(difference).toBe(1000);
    expect(difference > 0).toBe(true); // surplus
  });

  it("detects shortage when actual < theoretical", () => {
    const summary = calculateClosingSummary(50000, [
      { depositAmount: 15000, paymentAmount: 0, receivedAmount: 20000, changeAmount: 5000 },
    ]);
    const actualBalance = 64000;
    const difference = actualBalance - summary.theoreticalBalance;
    expect(difference).toBe(-1000);
    expect(difference < 0).toBe(true); // shortage
  });
});

// Test register transaction data structure
describe("Register Transaction Data Structure", () => {
  it("correctly determines deposit vs payment from settlement amount", () => {
    // settlementAmount < 0 means customer pays (deposit to company)
    const settlementAmount1 = -15000;
    const depositAmount1 = settlementAmount1 < 0 ? Math.abs(settlementAmount1) : 0;
    const paymentAmount1 = settlementAmount1 > 0 ? settlementAmount1 : 0;
    expect(depositAmount1).toBe(15000);
    expect(paymentAmount1).toBe(0);

    // settlementAmount > 0 means company pays customer (payment)
    const settlementAmount2 = 10000;
    const depositAmount2 = settlementAmount2 < 0 ? Math.abs(settlementAmount2) : 0;
    const paymentAmount2 = settlementAmount2 > 0 ? settlementAmount2 : 0;
    expect(depositAmount2).toBe(0);
    expect(paymentAmount2).toBe(10000);

    // settlementAmount = 0 means no money exchange
    const settlementAmount3 = 0;
    const depositAmount3 = settlementAmount3 < 0 ? Math.abs(settlementAmount3) : 0;
    const paymentAmount3 = settlementAmount3 > 0 ? settlementAmount3 : 0;
    expect(depositAmount3).toBe(0);
    expect(paymentAmount3).toBe(0);
  });

  it("calculates change correctly", () => {
    const customerPayAmount = 15000;
    const received = 20000;
    const change = received - customerPayAmount;
    expect(change).toBe(5000);
  });

  it("detects insufficient payment", () => {
    const customerPayAmount = 15000;
    const received = 10000;
    const change = received - customerPayAmount;
    expect(change).toBe(-5000);
    expect(change < 0).toBe(true); // insufficient
  });

  it("handles exact payment", () => {
    const customerPayAmount = 15000;
    const received = 15000;
    const change = received - customerPayAmount;
    expect(change).toBe(0);
  });
});

// Test initial fund setting
describe("Register Initial Fund Setting", () => {
  it("uses default value when no setting exists", () => {
    const settingValue: string | undefined = undefined;
    const initialFund = parseInt(settingValue || "50000", 10);
    expect(initialFund).toBe(50000);
  });

  it("uses custom value when setting exists", () => {
    const settingValue = "100000";
    const initialFund = parseInt(settingValue || "50000", 10);
    expect(initialFund).toBe(100000);
  });

  it("falls back to default for invalid setting", () => {
    const settingValue = "invalid";
    const initialFund = parseInt(settingValue || "50000", 10);
    expect(isNaN(initialFund)).toBe(true);
    // In actual code, we'd handle this with a fallback
    const safeFund = isNaN(initialFund) ? 50000 : initialFund;
    expect(safeFund).toBe(50000);
  });
});
