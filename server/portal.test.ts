import { describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

// Test bcrypt password hashing
describe("portal password hashing", () => {
  it("hashes and verifies a password correctly", async () => {
    const password = "test1234";
    const hashed = await bcrypt.hash(password, 10);

    expect(hashed).not.toBe(password);
    expect(hashed.length).toBeGreaterThan(0);

    const isValid = await bcrypt.compare(password, hashed);
    expect(isValid).toBe(true);

    const isInvalid = await bcrypt.compare("wrongpassword", hashed);
    expect(isInvalid).toBe(false);
  });

  it("generates different hashes for same password", async () => {
    const password = "test1234";
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);

    expect(hash1).not.toBe(hash2);
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);
  });
});

// Test JWT token generation and verification
describe("portal JWT token", () => {
  it("generates and verifies a member token", async () => {
    const jwt = await import("jsonwebtoken");
    const secret = "test-secret-key";
    const payload = { memberId: 1, memberNumber: 42, type: "member" };

    const token = jwt.default.sign(payload, secret, { expiresIn: "7d" });
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");

    const decoded = jwt.default.verify(token, secret) as any;
    expect(decoded.memberId).toBe(1);
    expect(decoded.memberNumber).toBe(42);
    expect(decoded.type).toBe("member");
  });

  it("rejects token with wrong secret", async () => {
    const jwt = await import("jsonwebtoken");
    const token = jwt.default.sign({ memberId: 1, type: "member" }, "correct-secret");

    expect(() => {
      jwt.default.verify(token, "wrong-secret");
    }).toThrow();
  });

  it("rejects expired token", async () => {
    const jwt = await import("jsonwebtoken");
    const token = jwt.default.sign(
      { memberId: 1, type: "member" },
      "test-secret",
      { expiresIn: "0s" }
    );

    // Wait a moment for token to expire
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(() => {
      jwt.default.verify(token, "test-secret");
    }).toThrow();
  });
});

// Test settlement data formatting
describe("settlement data formatting", () => {
  it("formats currency correctly", () => {
    const fmt = (n: number) => `¥${n.toLocaleString()}`;
    expect(fmt(0)).toBe("¥0");
    expect(fmt(1000)).toBe("¥1,000");
    expect(fmt(34000)).toBe("¥34,000");
    expect(fmt(-30750)).toBe("¥-30,750");
  });

  it("calculates commission tax correctly", () => {
    const salesCommission = 3400;
    const purchaseCommission = 275;
    const salesCommissionTax = Math.floor(salesCommission * 0.1);
    const purchaseCommissionTax = Math.floor(purchaseCommission * 0.1);

    expect(salesCommissionTax).toBe(340);
    expect(purchaseCommissionTax).toBe(27);
  });

  it("calculates settlement amount correctly", () => {
    // salesTotal - salesCommission - salesCommissionTax - purchaseTotal - purchaseCommission - purchaseCommissionTax
    const salesTotal = 34000;
    const salesCommission = 3400;
    const salesCommissionTax = 340;
    const purchaseTotal = 5500;
    const purchaseCommission = 275;
    const purchaseCommissionTax = 27;

    const settlementAmount = salesTotal - salesCommission - salesCommissionTax - purchaseTotal - purchaseCommission - purchaseCommissionTax;
    expect(settlementAmount).toBe(24458); // Close to the actual value
  });
});
