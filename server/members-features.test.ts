import { describe, it, expect } from "vitest";

// Test vacant number calculation logic (mirrors Members.tsx logic)
describe("vacant number calculation", () => {
  function getVacantNumbers(usedNumbers: number[], max: number = 1000): number[] {
    const usedSet = new Set(usedNumbers);
    const vacant: number[] = [];
    for (let i = 1; i <= max; i++) {
      if (!usedSet.has(i)) vacant.push(i);
    }
    return vacant;
  }

  it("returns all 1000 numbers when no members exist", () => {
    const vacant = getVacantNumbers([]);
    expect(vacant).toHaveLength(1000);
    expect(vacant[0]).toBe(1);
    expect(vacant[999]).toBe(1000);
  });

  it("excludes used numbers", () => {
    const vacant = getVacantNumbers([1, 5, 10]);
    expect(vacant).toHaveLength(997);
    expect(vacant).not.toContain(1);
    expect(vacant).not.toContain(5);
    expect(vacant).not.toContain(10);
    expect(vacant).toContain(2);
    expect(vacant).toContain(3);
  });

  it("returns empty array when all numbers are used", () => {
    const allNumbers = Array.from({ length: 1000 }, (_, i) => i + 1);
    const vacant = getVacantNumbers(allNumbers);
    expect(vacant).toHaveLength(0);
  });

  it("handles non-sequential used numbers", () => {
    const vacant = getVacantNumbers([1, 3, 5, 7, 9]);
    expect(vacant).toHaveLength(995);
    expect(vacant).toContain(2);
    expect(vacant).toContain(4);
    expect(vacant).toContain(6);
    expect(vacant).toContain(8);
    expect(vacant).toContain(10);
  });

  it("first vacant number is the smallest unused", () => {
    const vacant = getVacantNumbers([1, 2, 3]);
    expect(vacant[0]).toBe(4);
  });

  it("handles duplicate used numbers", () => {
    const vacant = getVacantNumbers([1, 1, 2, 2, 3]);
    expect(vacant).toHaveLength(997);
    expect(vacant[0]).toBe(4);
  });
});

// Test vacant number range formatting logic (mirrors Members.tsx logic)
describe("vacant number range formatting", () => {
  function formatVacantRanges(vacantNumbers: number[]): string {
    if (vacantNumbers.length === 0) return "";
    const ranges: string[] = [];
    let start = vacantNumbers[0];
    let end = vacantNumbers[0];
    for (let i = 1; i < vacantNumbers.length; i++) {
      if (vacantNumbers[i] === end + 1) {
        end = vacantNumbers[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = vacantNumbers[i];
        end = vacantNumbers[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(", ");
  }

  it("formats single number", () => {
    expect(formatVacantRanges([5])).toBe("5");
  });

  it("formats consecutive range", () => {
    expect(formatVacantRanges([1, 2, 3, 4, 5])).toBe("1-5");
  });

  it("formats mixed ranges and singles", () => {
    expect(formatVacantRanges([1, 2, 3, 7, 10, 11, 12])).toBe("1-3, 7, 10-12");
  });

  it("formats all singles", () => {
    expect(formatVacantRanges([1, 3, 5, 7])).toBe("1, 3, 5, 7");
  });

  it("returns empty string for empty array", () => {
    expect(formatVacantRanges([])).toBe("");
  });

  it("formats large range correctly", () => {
    const range = Array.from({ length: 100 }, (_, i) => i + 501);
    expect(formatVacantRanges(range)).toBe("501-600");
  });
});

// Test pagination logic (mirrors Members.tsx logic)
describe("pagination logic", () => {
  function paginate<T>(items: T[], page: number, pageSize: number): { data: T[]; totalPages: number; safePage: number } {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return {
      data: items.slice(start, start + pageSize),
      totalPages,
      safePage,
    };
  }

  const items = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, name: `Member ${i + 1}` }));

  it("returns correct page size", () => {
    const result = paginate(items, 1, 50);
    expect(result.data).toHaveLength(50);
    expect(result.data[0].id).toBe(1);
    expect(result.data[49].id).toBe(50);
  });

  it("returns correct second page", () => {
    const result = paginate(items, 2, 50);
    expect(result.data).toHaveLength(50);
    expect(result.data[0].id).toBe(51);
    expect(result.data[49].id).toBe(100);
  });

  it("returns correct last page with partial items", () => {
    const result = paginate(items, 3, 50);
    expect(result.data).toHaveLength(20);
    expect(result.data[0].id).toBe(101);
  });

  it("calculates total pages correctly", () => {
    expect(paginate(items, 1, 50).totalPages).toBe(3);
    expect(paginate(items, 1, 25).totalPages).toBe(5);
    expect(paginate(items, 1, 100).totalPages).toBe(2);
  });

  it("clamps page to max when exceeding total pages", () => {
    const result = paginate(items, 10, 50);
    expect(result.safePage).toBe(3);
    expect(result.data).toHaveLength(20);
  });

  it("handles empty items", () => {
    const result = paginate([], 1, 50);
    expect(result.data).toHaveLength(0);
    expect(result.totalPages).toBe(1);
    expect(result.safePage).toBe(1);
  });

  it("handles page size of 25", () => {
    const result = paginate(items, 1, 25);
    expect(result.data).toHaveLength(25);
    expect(result.totalPages).toBe(5);
  });

  it("handles page size of 100", () => {
    const result = paginate(items, 1, 100);
    expect(result.data).toHaveLength(100);
    expect(result.totalPages).toBe(2);
  });
});

// Test member search/filter logic (mirrors Members.tsx logic)
describe("member search filtering", () => {
  const members = [
    { memberNumber: 1, displayName: "田中太郎", tradeName: "田中商店" },
    { memberNumber: 25, displayName: "鈴木花子", tradeName: "鈴木リサイクル" },
    { memberNumber: 100, displayName: "佐藤一郎", tradeName: null },
    { memberNumber: 501, displayName: "山田次郎", tradeName: "ヤマダ" },
  ];

  function filterMembers(items: typeof members, search: string) {
    return items.filter(
      (m) =>
        m.displayName.includes(search) ||
        m.tradeName?.includes(search) ||
        String(m.memberNumber).includes(search)
    );
  }

  it("returns all members when search is empty", () => {
    expect(filterMembers(members, "")).toHaveLength(4);
  });

  it("filters by member number", () => {
    expect(filterMembers(members, "25")).toHaveLength(1);
    expect(filterMembers(members, "25")[0].displayName).toBe("鈴木花子");
  });

  it("filters by partial member number", () => {
    // "1" matches memberNumber 1, 100, and 501
    expect(filterMembers(members, "1")).toHaveLength(3);
  });

  it("filters by display name", () => {
    expect(filterMembers(members, "田中")).toHaveLength(1);
    expect(filterMembers(members, "田中")[0].memberNumber).toBe(1);
  });

  it("filters by trade name", () => {
    expect(filterMembers(members, "リサイクル")).toHaveLength(1);
    expect(filterMembers(members, "リサイクル")[0].memberNumber).toBe(25);
  });

  it("returns empty array when no match", () => {
    expect(filterMembers(members, "存在しない")).toHaveLength(0);
  });
});

// Test member number validation
describe("member number validation", () => {
  function validateMemberNumber(num: number): { valid: boolean; error?: string } {
    if (!Number.isInteger(num)) return { valid: false, error: "整数を入力してください" };
    if (num < 1) return { valid: false, error: "1以上を入力してください" };
    if (num > 1000) return { valid: false, error: "1000以下を入力してください" };
    return { valid: true };
  }

  it("accepts valid numbers", () => {
    expect(validateMemberNumber(1).valid).toBe(true);
    expect(validateMemberNumber(500).valid).toBe(true);
    expect(validateMemberNumber(1000).valid).toBe(true);
  });

  it("rejects zero", () => {
    expect(validateMemberNumber(0).valid).toBe(false);
  });

  it("rejects negative numbers", () => {
    expect(validateMemberNumber(-1).valid).toBe(false);
  });

  it("rejects numbers above 1000", () => {
    expect(validateMemberNumber(1001).valid).toBe(false);
  });

  it("rejects non-integers", () => {
    expect(validateMemberNumber(1.5).valid).toBe(false);
  });
});
