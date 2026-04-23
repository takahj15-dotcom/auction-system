import { describe, expect, it } from "vitest";

// Test event status transition logic
describe("event status cancellation logic", () => {
  // Simulates the backend logic: settled/closed → open
  const canResetToOpen = (status: string): boolean => {
    return status === "settled" || status === "closed";
  };

  const isAlreadyOpen = (status: string): boolean => {
    return status === "open";
  };

  it("allows reset from settled to open", () => {
    expect(canResetToOpen("settled")).toBe(true);
  });

  it("allows reset from closed to open", () => {
    expect(canResetToOpen("closed")).toBe(true);
  });

  it("does not allow reset from open (already open)", () => {
    expect(canResetToOpen("open")).toBe(false);
    expect(isAlreadyOpen("open")).toBe(true);
  });
});

// Test transaction editing permission based on event status
describe("transaction editing permissions", () => {
  // New logic: only "closed" blocks editing, "open" and "settled" allow editing
  const canEditTransaction = (eventStatus: string): boolean => {
    return eventStatus !== "closed";
  };

  const isLocked = (eventStatus: string): boolean => {
    return eventStatus === "closed";
  };

  it("allows editing when event is open", () => {
    expect(canEditTransaction("open")).toBe(true);
    expect(isLocked("open")).toBe(false);
  });

  it("allows editing when event is settled", () => {
    expect(canEditTransaction("settled")).toBe(true);
    expect(isLocked("settled")).toBe(false);
  });

  it("blocks editing when event is closed", () => {
    expect(canEditTransaction("closed")).toBe(false);
    expect(isLocked("closed")).toBe(true);
  });
});

// Test fixed seller mode logic
describe("fixed seller input mode", () => {
  type FixedSeller = { id: number; name: string } | null;

  // Simulates applying fixed seller to new empty rows
  const applyFixedSellerToRows = (
    rows: Array<{ isNew: boolean; sellerMemberId: number; sellerName: string }>,
    seller: FixedSeller
  ) => {
    if (!seller) return rows;
    return rows.map((r) => {
      if (r.isNew && r.sellerMemberId === 0) {
        return { ...r, sellerMemberId: seller.id, sellerName: seller.name };
      }
      return r;
    });
  };

  it("applies fixed seller to new empty rows", () => {
    const rows = [
      { isNew: false, sellerMemberId: 1, sellerName: "JPH合同会社" },
      { isNew: true, sellerMemberId: 0, sellerName: "" },
      { isNew: true, sellerMemberId: 0, sellerName: "" },
    ];
    const seller: FixedSeller = { id: 5, name: "テスト売主" };

    const result = applyFixedSellerToRows(rows, seller);

    // Existing rows should not be affected
    expect(result[0].sellerMemberId).toBe(1);
    expect(result[0].sellerName).toBe("JPH合同会社");

    // New empty rows should get the fixed seller
    expect(result[1].sellerMemberId).toBe(5);
    expect(result[1].sellerName).toBe("テスト売主");
    expect(result[2].sellerMemberId).toBe(5);
    expect(result[2].sellerName).toBe("テスト売主");
  });

  it("does not apply fixed seller to rows that already have a seller", () => {
    const rows = [
      { isNew: true, sellerMemberId: 3, sellerName: "既存売主" },
      { isNew: true, sellerMemberId: 0, sellerName: "" },
    ];
    const seller: FixedSeller = { id: 5, name: "テスト売主" };

    const result = applyFixedSellerToRows(rows, seller);

    expect(result[0].sellerMemberId).toBe(3);
    expect(result[0].sellerName).toBe("既存売主");
    expect(result[1].sellerMemberId).toBe(5);
    expect(result[1].sellerName).toBe("テスト売主");
  });

  it("does not modify rows when seller is null", () => {
    const rows = [
      { isNew: true, sellerMemberId: 0, sellerName: "" },
    ];

    const result = applyFixedSellerToRows(rows, null);
    expect(result[0].sellerMemberId).toBe(0);
    expect(result[0].sellerName).toBe("");
  });
});

// Test editable columns filtering for fixed seller mode
describe("editable columns filtering", () => {
  const EDITABLE_COLS = [
    { key: "sellerName", idx: 1 },
    { key: "itemName", idx: 2 },
    { key: "unitPrice", idx: 3 },
    { key: "quantity", idx: 4 },
    { key: "buyerName", idx: 5 },
    { key: "notes", idx: 8 },
  ];

  const getActiveEditableCols = (fixedSellerEnabled: boolean) => {
    if (fixedSellerEnabled) {
      return EDITABLE_COLS.filter((c) => c.key !== "sellerName");
    }
    return EDITABLE_COLS;
  };

  it("includes seller column when fixed seller is disabled", () => {
    const cols = getActiveEditableCols(false);
    expect(cols.length).toBe(6);
    expect(cols[0].key).toBe("sellerName");
  });

  it("excludes seller column when fixed seller is enabled", () => {
    const cols = getActiveEditableCols(true);
    expect(cols.length).toBe(5);
    expect(cols.find((c) => c.key === "sellerName")).toBeUndefined();
    expect(cols[0].key).toBe("itemName");
  });

  it("preserves other columns when seller is fixed", () => {
    const cols = getActiveEditableCols(true);
    const keys = cols.map((c) => c.key);
    expect(keys).toContain("itemName");
    expect(keys).toContain("unitPrice");
    expect(keys).toContain("quantity");
    expect(keys).toContain("buyerName");
    expect(keys).toContain("notes");
  });
});

// Test new row creation with fixed seller
describe("new row creation with fixed seller", () => {
  const makeEmptyRow = (rowNum: number) => ({
    rowNumber: rowNum,
    isNew: true,
    sellerMemberId: 0,
    sellerName: "",
    buyerMemberId: 0,
    buyerName: "",
    itemName: "",
    unitPrice: 0,
    quantity: 1,
    totalPrice: 0,
  });

  const makeRowWithFixedSeller = (
    rowNum: number,
    seller: { id: number; name: string } | null,
    enabled: boolean
  ) => {
    const row = makeEmptyRow(rowNum);
    if (enabled && seller) {
      row.sellerMemberId = seller.id;
      row.sellerName = seller.name;
    }
    return row;
  };

  it("creates empty row without fixed seller", () => {
    const row = makeRowWithFixedSeller(1, null, false);
    expect(row.sellerMemberId).toBe(0);
    expect(row.sellerName).toBe("");
  });

  it("creates row with fixed seller when enabled", () => {
    const seller = { id: 5, name: "5 テスト会社" };
    const row = makeRowWithFixedSeller(1, seller, true);
    expect(row.sellerMemberId).toBe(5);
    expect(row.sellerName).toBe("5 テスト会社");
  });

  it("creates empty row when seller exists but not enabled", () => {
    const seller = { id: 5, name: "5 テスト会社" };
    const row = makeRowWithFixedSeller(1, seller, false);
    expect(row.sellerMemberId).toBe(0);
    expect(row.sellerName).toBe("");
  });
});

// Test quick entry form logic
describe("quick entry form", () => {
  type QuickEntryData = {
    sellerMemberId: number;
    sellerName: string;
    buyerMemberId: number;
    buyerName: string;
    itemName: string;
    unitPrice: number;
    quantity: number;
    transactionType: string;
    notes: string;
  };

  // Simulates the total calculation in the quick entry form
  const calculateTotal = (unitPrice: string, quantity: string): number => {
    return (Number(unitPrice) || 0) * (Number(quantity) || 1);
  };

  it("calculates total correctly", () => {
    expect(calculateTotal("1000", "3")).toBe(3000);
    expect(calculateTotal("500", "10")).toBe(5000);
    expect(calculateTotal("0", "5")).toBe(0);
    expect(calculateTotal("", "1")).toBe(0);
    expect(calculateTotal("1000", "")).toBe(1000);
  });

  // Simulates validation logic
  const validateEntry = (
    entry: Partial<QuickEntryData>,
    fixedSellerEnabled: boolean,
    fixedSeller: { id: number; name: string } | null
  ): boolean => {
    const sid = fixedSellerEnabled && fixedSeller ? fixedSeller.id : (entry.sellerMemberId ?? 0);
    const buyerId = entry.buyerMemberId ?? 0;
    const itemName = entry.itemName?.trim() ?? "";
    return sid > 0 && buyerId > 0 && itemName !== "";
  };

  it("validates complete entry", () => {
    const entry: Partial<QuickEntryData> = {
      sellerMemberId: 1,
      buyerMemberId: 2,
      itemName: "冷蔵庫",
    };
    expect(validateEntry(entry, false, null)).toBe(true);
  });

  it("rejects entry without seller (no fixed seller)", () => {
    const entry: Partial<QuickEntryData> = {
      sellerMemberId: 0,
      buyerMemberId: 2,
      itemName: "冷蔵庫",
    };
    expect(validateEntry(entry, false, null)).toBe(false);
  });

  it("accepts entry without seller when fixed seller is enabled", () => {
    const entry: Partial<QuickEntryData> = {
      sellerMemberId: 0,
      buyerMemberId: 2,
      itemName: "冷蔵庫",
    };
    expect(validateEntry(entry, true, { id: 5, name: "固定売主" })).toBe(true);
  });

  it("rejects entry without buyer", () => {
    const entry: Partial<QuickEntryData> = {
      sellerMemberId: 1,
      buyerMemberId: 0,
      itemName: "冷蔵庫",
    };
    expect(validateEntry(entry, false, null)).toBe(false);
  });

  it("rejects entry without item name", () => {
    const entry: Partial<QuickEntryData> = {
      sellerMemberId: 1,
      buyerMemberId: 2,
      itemName: "",
    };
    expect(validateEntry(entry, false, null)).toBe(false);
  });

  it("rejects entry with whitespace-only item name", () => {
    const entry: Partial<QuickEntryData> = {
      sellerMemberId: 1,
      buyerMemberId: 2,
      itemName: "   ",
    };
    expect(validateEntry(entry, false, null)).toBe(false);
  });

  // Simulates form reset logic
  const resetForm = (fixedSellerEnabled: boolean) => {
    const result = {
      sellerCleared: !fixedSellerEnabled,
      itemNameCleared: true,
      unitPriceCleared: true,
      quantityReset: true,
      buyerCleared: true,
      typeReset: true,
      notesCleared: true,
    };
    return result;
  };

  it("clears all fields when seller is not fixed", () => {
    const result = resetForm(false);
    expect(result.sellerCleared).toBe(true);
    expect(result.itemNameCleared).toBe(true);
    expect(result.buyerCleared).toBe(true);
  });

  it("keeps seller when fixed, clears other fields", () => {
    const result = resetForm(true);
    expect(result.sellerCleared).toBe(false);
    expect(result.itemNameCleared).toBe(true);
    expect(result.buyerCleared).toBe(true);
    expect(result.quantityReset).toBe(true);
  });
});

// Test row insertion logic from quick entry
describe("row insertion from quick entry", () => {
  type SimpleRow = {
    rowNumber: number;
    isNew: boolean;
    sellerMemberId: number;
    itemName: string;
  };

  const insertRow = (
    rows: SimpleRow[],
    newEntry: { sellerMemberId: number; itemName: string }
  ): SimpleRow[] => {
    const lastRow = rows[rows.length - 1];
    const newRow: SimpleRow = {
      rowNumber: lastRow ? lastRow.rowNumber + 1 : 1,
      isNew: true,
      sellerMemberId: newEntry.sellerMemberId,
      itemName: newEntry.itemName,
    };

    let updated: SimpleRow[];
    // Replace trailing empty row
    if (lastRow && lastRow.isNew && lastRow.sellerMemberId === 0 && !lastRow.itemName) {
      updated = [...rows.slice(0, -1), { ...newRow, rowNumber: lastRow.rowNumber }];
    } else {
      updated = [...rows, newRow];
    }

    // Add trailing empty row
    updated.push({
      rowNumber: updated[updated.length - 1].rowNumber + 1,
      isNew: true,
      sellerMemberId: 0,
      itemName: "",
    });

    return updated;
  };

  it("replaces trailing empty row with new entry", () => {
    const rows: SimpleRow[] = [
      { rowNumber: 1, isNew: false, sellerMemberId: 1, itemName: "冷蔵庫" },
      { rowNumber: 2, isNew: true, sellerMemberId: 0, itemName: "" },
    ];

    const result = insertRow(rows, { sellerMemberId: 3, itemName: "洗濯機" });

    expect(result.length).toBe(3); // original + new entry + new empty
    expect(result[1].sellerMemberId).toBe(3);
    expect(result[1].itemName).toBe("洗濯機");
    expect(result[1].rowNumber).toBe(2);
    expect(result[2].sellerMemberId).toBe(0); // trailing empty
    expect(result[2].itemName).toBe("");
  });

  it("appends when no trailing empty row", () => {
    const rows: SimpleRow[] = [
      { rowNumber: 1, isNew: false, sellerMemberId: 1, itemName: "冷蔵庫" },
    ];

    const result = insertRow(rows, { sellerMemberId: 3, itemName: "洗濯機" });

    expect(result.length).toBe(3);
    expect(result[1].sellerMemberId).toBe(3);
    expect(result[1].itemName).toBe("洗濯機");
    expect(result[2].sellerMemberId).toBe(0);
  });

  it("handles empty rows array", () => {
    const result = insertRow([], { sellerMemberId: 1, itemName: "テスト" });

    expect(result.length).toBe(2);
    expect(result[0].sellerMemberId).toBe(1);
    expect(result[0].itemName).toBe("テスト");
    expect(result[0].rowNumber).toBe(1);
    expect(result[1].sellerMemberId).toBe(0);
  });
});
