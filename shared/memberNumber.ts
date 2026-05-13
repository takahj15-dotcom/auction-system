/**
 * 会員番号の枝番（A/B/C）対応ユーティリティ
 *
 * 形式:
 *   - 数値のみ: "123"     → { number: 123, suffix: null }
 *   - 枝番付き: "123-A"   → { number: 123, suffix: "A" }
 *   - ハイフン無しも許容: "123A" → { number: 123, suffix: "A" }
 *   - 小文字も大文字化: "123-b" → { number: 123, suffix: "B" }
 *
 * 表示は常に "123-A"（ハイフン区切り）に統一する。
 */

export type MemberNumberSuffix = "A" | "B" | "C" | null;

export type ParsedMemberNumber = {
  number: number;
  suffix: MemberNumberSuffix;
};

/**
 * 入力文字列を会員番号と枝番に分解。
 * パース失敗時は { number: NaN, suffix: null } を返す。
 */
export function parseMemberNumberInput(input: string | number | null | undefined): ParsedMemberNumber {
  if (input === null || input === undefined) return { number: NaN, suffix: null };
  const raw = String(input).trim();
  if (raw === "") return { number: NaN, suffix: null };

  // 全角数字を半角化
  const normalized = raw.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  // パターン: 数字 + 任意のハイフン/スペース + A/B/C（半角・大小区別なし）
  const m = normalized.match(/^\s*(\d+)\s*[-‐ー－]?\s*([abcABC])?\s*$/);
  if (!m) return { number: NaN, suffix: null };
  const num = parseInt(m[1], 10);
  if (isNaN(num)) return { number: NaN, suffix: null };
  const suffixRaw = m[2];
  const suffix = suffixRaw ? (suffixRaw.toUpperCase() as MemberNumberSuffix) : null;
  return { number: num, suffix };
}

/**
 * 会員番号と枝番を表示用文字列にフォーマット。
 *   formatMemberNumber(1, null) → "1"
 *   formatMemberNumber(1, "A")  → "1-A"
 */
export function formatMemberNumber(
  memberNumber: number | null | undefined,
  suffix?: string | null,
): string {
  if (memberNumber === null || memberNumber === undefined) return "";
  const num = String(memberNumber);
  const s = suffix ? String(suffix).toUpperCase() : "";
  if (s && /^[ABC]$/.test(s)) return `${num}-${s}`;
  return num;
}

/**
 * 枝番のバリデーション（A/B/C のみ許可、null/空も可）。
 * 不正な値は null に正規化。
 */
export function normalizeSuffix(suffix: unknown): MemberNumberSuffix {
  if (suffix === null || suffix === undefined || suffix === "") return null;
  const s = String(suffix).toUpperCase();
  if (s === "A" || s === "B" || s === "C") return s;
  return null;
}
