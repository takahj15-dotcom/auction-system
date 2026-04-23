import { useState, useEffect, useRef, useMemo, useCallback, KeyboardEvent, ChangeEvent } from "react";
import { trpc } from "@/lib/trpc";
import { useEvent } from "@/contexts/EventContext";
import { Trash2, RefreshCw, ArrowDown, ArrowUp, Unlock, Plus, Download, Search, X } from "lucide-react";
import { toast } from "sonner";

/* ─── 商品名オートコンプリートコンポーネント ─── */
function ItemNameAutocomplete({
  value,
  onChange,
  onKeyDown,
  inputRef,
  className,
  placeholder,
  style,
  onCompositionChange,
}: {
  value: string;
  onChange: (val: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  className: string;
  placeholder: string;
  style?: React.CSSProperties;
  onCompositionChange?: (isComposing: boolean) => void;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchText, setSearchText] = useState(value);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  // 外部からvalueが変更された場合（resetForm等）にinputを同期
  useEffect(() => {
    setSearchText(value);
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value, inputRef]);

  // よく使う商品名を初回ロード
  const { data: frequentNames = [] } = trpc.transactions.frequentItemNames.useQuery(
    undefined,
    { staleTime: 60000 }
  );

  // 入力中のクエリで候補を検索
  const { data: searchResults = [] } = trpc.transactions.itemNameSuggestions.useQuery(
    { query: searchText },
    { enabled: searchText.length >= 1, staleTime: 10000 }
  );

  // 候補リスト: 入力があれば検索結果、なければよく使う商品名
  const suggestions = useMemo(() => {
    if (searchText.length >= 1) return searchResults;
    return frequentNames.slice(0, 15);
  }, [searchText, searchResults, frequentNames]);

  // 外側クリックで候補を閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = useCallback((name: string) => {
    onChange(name);
    setSearchText(name);
    if (inputRef.current) inputRef.current.value = name;
    setShowSuggestions(false);
    setSelectedIndex(-1);
  }, [onChange, inputRef]);

  const handleInputKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        return;
      }
      if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        selectSuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === "Tab" && selectedIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        selectSuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === "Tab" && suggestions.length > 0 && selectedIndex === -1) {
        // Tab押下時に候補があるが未選択の場合、最初の候補を選択
        e.preventDefault();
        e.stopPropagation();
        selectSuggestion(suggestions[0]);
        return;
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        setSelectedIndex(-1);
        return;
      }
    }
    // 候補が選択されていない場合は通常のキーハンドリングを実行
    onKeyDown(e);
  }, [showSuggestions, suggestions, selectedIndex, selectSuggestion, onKeyDown]);

  // 選択中の候補をスクロールで見えるように
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const items = suggestionsRef.current.querySelectorAll('[data-suggestion]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // IME安全な値取得ヘルパー
  const getCurrentValue = useCallback(() => {
    return inputRef.current?.value ?? "";
  }, [inputRef]);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        defaultValue={value}
        className={className}
        placeholder={placeholder}
        style={{ imeMode: "active", ...style } as React.CSSProperties}
        onCompositionStart={() => {
          isComposingRef.current = true;
          onCompositionChange?.(true);
        }}
        onCompositionEnd={() => {
          // Windows IMEではcompositionEndがinputより先に発火する場合がある
          // またisComposingフラグのリセットも少し遅らせる（Enterキーとの競合防止）
          setTimeout(() => {
            isComposingRef.current = false;
            onCompositionChange?.(false);
            const val = getCurrentValue();
            onChange(val);
            setSearchText(val);
            setShowSuggestions(val.length > 0);
            setSelectedIndex(-1);
          }, 20);
        }}
        onInput={() => {
          // IME変換中はstate更新をスキップ（再レンダリングによるIMEリセット防止）
          if (isComposingRef.current) return;
          const val = getCurrentValue();
          onChange(val);
          setSearchText(val);
          setShowSuggestions(val.length > 0);
          setSelectedIndex(-1);
        }}
        onFocus={() => { /* 文字入力時のみ候補表示 */ }}
        onKeyDown={(e) => {
          // IME変換中はキーナビゲーションを無視（isComposing + keyCode 229 チェック）
          if (isComposingRef.current || e.nativeEvent.isComposing || (e.nativeEvent as any).keyCode === 229) return;
          handleInputKeyDown(e);
        }}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          {searchText.length === 0 && (
            <div className="px-2 py-1 text-[10px] text-muted-foreground border-b">
              よく使う商品名
            </div>
          )}
          {suggestions.map((name, i) => (
            <div
              key={name}
              data-suggestion
              className={`px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                i === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(name);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              {searchText.length >= 1 ? (
                <HighlightMatch text={name} query={searchText} />
              ) : (
                name
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* マッチハイライトコンポーネント */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-bold text-primary">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

type GridRow = {
  id?: number;
  rowNumber: number;
  sellerMemberId: number;
  sellerName: string;
  buyerMemberId: number;
  buyerName: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  transactionType: string;
  notes: string;
  version: number;
  isNew: boolean;
  _dirty?: boolean;
};

// 列順: 売主→商品名→単価→買主→合計→数量（種別・備考は非表示）
const COLUMNS = [
  { key: "rowNumber", label: "No.", width: "w-14", editable: false, type: "number" as const },
  { key: "sellerName", label: "売主", width: "w-40", editable: true, type: "member" as const },
  { key: "itemName", label: "商品名", width: "w-48", editable: true, type: "text" as const },
  { key: "unitPrice", label: "単価", width: "w-28", editable: true, type: "number" as const },
  { key: "buyerName", label: "買主", width: "w-40", editable: true, type: "member" as const },
  { key: "totalPrice", label: "合計", width: "w-28", editable: false, type: "number" as const },
  { key: "quantity", label: "数量", width: "w-20", editable: true, type: "number" as const },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const EDITABLE_COLS = COLUMNS.map((c, i) => ({ ...c, idx: i })).filter((c) => c.editable);

function makeEmptyRow(rowNumber: number): GridRow {
  return {
    rowNumber,
    sellerMemberId: 0,
    sellerName: "",
    buyerMemberId: 0,
    buyerName: "",
    itemName: "",
    unitPrice: 0,
    quantity: 1,
    totalPrice: 0,
    transactionType: "normal",
    notes: "",
    version: 1,
    isNew: true,
  };
}

/* ─── Inline Input Component ─── */
function CellInput({
  type,
  value,
  onChange,
  onKeyDown,
  onBlur,
  placeholder,
}: {
  type: "text" | "number";
  value: string | number;
  onChange: (val: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const hasFocusedRef = useRef(false);

  // マウント時のみfocusを実行（hasFocusedRefで二重実行を防止）
  useEffect(() => {
    if (hasFocusedRef.current) return;
    hasFocusedRef.current = true;
    const t = setTimeout(() => {
      if (!ref.current) return;
      ref.current.focus({ preventScroll: true });
      // number型のみselect（テキスト型はselectしない → Windows IMEリセット防止）
      if (type === "number") ref.current.select();
    }, 10);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // テキスト型: uncontrolled input + compositionイベントでIME保護
  if (type === "text") {
    return (
      <input
        ref={ref}
        type="text"
        inputMode="text"
        defaultValue={value ?? ""}
        className="w-full h-8 px-2 py-1 text-sm border-0 bg-blue-50/40 focus:outline-none rounded"
        style={{ imeMode: "active" } as React.CSSProperties}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          // Windows IMEではcompositionEndがinputイベントより先に発火する場合がある
          // requestAnimationFrameで次フレームまで待ってから値を取得
          requestAnimationFrame(() => {
            const val = (e.target as HTMLInputElement).value;
            onChange(val);
          });
        }}
        onInput={(e) => {
          // IME変換中はReact stateを更新しない（再レンダリング防止）
          if (!isComposingRef.current) {
            onChange((e.target as HTMLInputElement).value);
          }
        }}
        onBlur={(e) => {
          // blur時にも最終値を確実に反映
          onChange(e.target.value);
          onBlur();
        }}
        onKeyDown={(e) => {
          // IME変換中はキーナビゲーションを無視（isComposing + keyCode 229チェック）
          if (isComposingRef.current || e.nativeEvent.isComposing || (e.nativeEvent as any).keyCode === 229) return;
          onKeyDown(e);
        }}
        placeholder={placeholder}
      />
    );
  }

  // number型: controlled inputのまま（IME不要）
  return (
    <input
      ref={ref}
      type={type}
      inputMode="numeric"
      value={value ?? ""}
      className="w-full h-8 px-2 py-1 text-sm border-0 bg-blue-50/40 focus:outline-none rounded"
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
    />
  );
}



/* ─── Quick Entry Form (Full Field Input Box) ─── */
type QuickEntryData = {
  sellerMemberId: number;
  sellerName: string;
  buyerMemberId: number;
  buyerName: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  transactionType: string;
};

function QuickEntryForm({
  members,
  onAddRow,
  onSellerChange,
}: {
  members: Array<{ id: number; memberNumber: number; displayName: string }>;
  onAddRow: (entry: QuickEntryData) => void;
  onSellerChange: (seller: { id: number; name: string } | null) => void;
}) {
  // Build lookup maps
  const memberByNumber = useMemo(() => {
    const map = new Map<number, { id: number; memberNumber: number; displayName: string }>();
    members.forEach((m) => map.set(m.memberNumber, m));
    return map;
  }, [members]);

  const [sellerNumber, setSellerNumber] = useState("");
  const [sellerMemberId, setSellerMemberId] = useState(0);
  const [sellerDisplayName, setSellerDisplayName] = useState("");
  const [itemName, setItemName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [buyerNumber, setBuyerNumber] = useState("");
  const [buyerMemberId, setBuyerMemberId] = useState(0);
  const [buyerDisplayName, setBuyerDisplayName] = useState("");
  const [transactionType, setTransactionType] = useState("normal");
  const [sameNumberError, setSameNumberError] = useState(false);

  // Refs for focus management
  const sellerRef = useRef<HTMLInputElement>(null);
  const itemNameRef = useRef<HTMLInputElement>(null);
  const unitPriceRef = useRef<HTMLInputElement>(null);
  const buyerRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);

  // Prevent Enter event propagation to next focused field
  const justNavigatedRef = useRef(false);
  // IME変換中フラグ（QuickEntryForm全体で共有）
  const formComposingRef = useRef(false);

  // Double-Enter navigation: track consecutive Enter presses per field
  const enterCountRef = useRef(0);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve member number to member
  const resolveSeller = useCallback((numStr: string) => {
    const num = parseInt(numStr);
    if (!isNaN(num)) {
      const m = memberByNumber.get(num);
      if (m) {
        setSellerMemberId(m.id);
        setSellerDisplayName(m.displayName);
        onSellerChange({ id: m.id, name: `${m.memberNumber} ${m.displayName}` });
        return;
      }
    }
    setSellerMemberId(0);
    setSellerDisplayName("");
    onSellerChange(null);
  }, [memberByNumber, onSellerChange]);

  const resolveBuyer = useCallback((numStr: string) => {
    const num = parseInt(numStr);
    if (!isNaN(num)) {
      const m = memberByNumber.get(num);
      if (m) {
        setBuyerMemberId(m.id);
        setBuyerDisplayName(m.displayName);
        // Check same number
        if (sellerNumber && parseInt(sellerNumber) === num) {
          setSameNumberError(true);
        } else {
          setSameNumberError(false);
        }
        return;
      }
    }
    setBuyerMemberId(0);
    setBuyerDisplayName("");
    setSameNumberError(false);
  }, [memberByNumber, sellerNumber]);

  // Check same number when seller changes
  useEffect(() => {
    if (sellerNumber && buyerNumber && sellerNumber === buyerNumber) {
      setSameNumberError(true);
    } else {
      setSameNumberError(false);
    }
  }, [sellerNumber, buyerNumber]);

  // Computed total
  const total = (Number(unitPrice) || 0) * (Number(quantity) || 1);

  // Reset form after adding (keep seller always)
  const resetForm = useCallback(() => {
    // Seller stays as-is
    setItemName("");
    setUnitPrice("");
    setQuantity("1");
    setBuyerNumber("");
    setBuyerMemberId(0);
    setBuyerDisplayName("");
    setSameNumberError(false);
    // Focus to itemName since seller is kept
    setTimeout(() => {
      itemNameRef.current?.focus();
    }, 50);
  }, []);

  // Handle add
  const handleAdd = useCallback(() => {
    if (sellerMemberId <= 0) {
      toast.error("売主番号を正しく入力してください");
      sellerRef.current?.focus();
      return;
    }
    if (buyerMemberId <= 0) {
      toast.error("買主番号を正しく入力してください");
      buyerRef.current?.focus();
      return;
    }
    if (!itemName.trim()) {
      toast.error("商品名を入力してください");
      itemNameRef.current?.focus();
      return;
    }
    if (sameNumberError) {
      toast.error("売主と買主が同じ番号です。異なる番号を入力してください");
      buyerRef.current?.focus();
      return;
    }
    const sellerLabel = `${sellerNumber} ${sellerDisplayName}`;
    const buyerLabel = `${buyerNumber} ${buyerDisplayName}`;
    onAddRow({
      sellerMemberId,
      sellerName: sellerLabel,
      buyerMemberId,
      buyerName: buyerLabel,
      itemName: itemName.trim(),
      unitPrice: Number(unitPrice) || 0,
      quantity: Number(quantity) || 1,
      transactionType,
    });
    resetForm();
  }, [sellerMemberId, buyerMemberId, itemName, sameNumberError, sellerNumber, sellerDisplayName, buyerNumber, buyerDisplayName, unitPrice, quantity, transactionType, onAddRow, resetForm]);

  // Safe focus helper
  const safeFocus = useCallback((ref: React.RefObject<HTMLElement | null>) => {
    justNavigatedRef.current = true;
    enterCountRef.current = 0;
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    setTimeout(() => {
      ref.current?.focus();
      setTimeout(() => { justNavigatedRef.current = false; }, 100);
    }, 10);
  }, []);

  // Double-Enter navigation helper
  const handleDoubleEnter = useCallback((e: KeyboardEvent<HTMLElement>, nextRef: React.RefObject<HTMLElement | null> | null) => {
    // IME変換中は全てのキーナビゲーションを無視（Windows IME対応）
    if (formComposingRef.current) return;
    if (justNavigatedRef.current && e.key === "Enter") { e.preventDefault(); return; }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault(); e.stopPropagation();
      enterCountRef.current = 0;
      if (nextRef) safeFocus(nextRef); else handleAdd();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault(); e.stopPropagation();
      enterCountRef.current += 1;
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      if (enterCountRef.current >= 2) {
        enterCountRef.current = 0;
        if (nextRef) safeFocus(nextRef); else handleAdd();
      } else {
        enterTimerRef.current = setTimeout(() => { enterCountRef.current = 0; }, 800);
      }
    }
  }, [handleAdd, safeFocus]);

  const inputClass = "w-full h-8 px-2 py-1 text-sm border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary rounded";

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-visible">
      <div className="px-3 py-2">
        {/* Header row with add button */}
        <div className="flex items-center gap-2 mb-2">
          {sameNumberError && (
            <span className="text-xs text-destructive font-medium">
              売主と買主が同じ番号です
            </span>
          )}
          <div className="ml-auto">
            <button
              onClick={handleAdd}
              disabled={sameNumberError}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
            >
              追加
            </button>
          </div>
        </div>
        {/* Column labels */}
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "3.5rem 7rem 1fr 7rem 7rem 7rem 5rem" }}>
          <div className="text-[10px] text-muted-foreground text-center">種別</div>
          <div className="text-[10px] text-muted-foreground text-center">売主No.</div>
          <div className="text-[10px] text-muted-foreground text-center">商品名</div>
          <div className="text-[10px] text-muted-foreground text-center">単価</div>
          <div className="text-[10px] text-muted-foreground text-center">買主No.</div>
          <div className="text-[10px] text-muted-foreground text-center">合計</div>
          <div className="text-[10px] text-muted-foreground text-center">数量</div>
        </div>
        {/* Input fields row */}
        <div className="grid gap-1" style={{ gridTemplateColumns: "3.5rem 7rem 1fr 7rem 7rem 7rem 5rem" }}>
          {/* No. → 種別切替ボタン */}
          <button
            type="button"
            onClick={() => setTransactionType((prev) => prev === "normal" ? "return" : "normal")}
            className={`flex items-center justify-center text-[10px] font-bold rounded h-8 transition-colors cursor-pointer ${
              transactionType === "normal"
                ? "bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-200"
                : "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
            }`}
            title={transactionType === "normal" ? "通常（クリックで返品に切替）" : "返品（クリックで通常に切替）"}
          >
            {transactionType === "normal" ? "通常" : "返品"}
          </button>
          {/* 売主番号 */}
          <input
            ref={sellerRef}
            type="number"
            inputMode="numeric"
            value={sellerNumber}
            className={`${inputClass} text-center font-mono ${sameNumberError ? "border-destructive ring-destructive" : ""}`}
            placeholder="番号"
            min={1}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "");
              setSellerNumber(v);
              resolveSeller(v);
            }}
            onBlur={() => resolveSeller(sellerNumber)}
            onKeyDown={(e) => handleDoubleEnter(e, itemNameRef)}
          />
          {/* 商品名（オートコンプリート付き） */}
          <ItemNameAutocomplete
            inputRef={itemNameRef}
            value={itemName}
            onChange={setItemName}
            className={inputClass}
            placeholder="商品名"
            onCompositionChange={(composing) => { formComposingRef.current = composing; }}
            onKeyDown={(e) => {
              if (justNavigatedRef.current && e.key === "Enter") { e.preventDefault(); return; }
              handleDoubleEnter(e, unitPriceRef);
            }}
          />
          {/* 単価 */}
          <input
            ref={unitPriceRef}
            type="number"
            inputMode="numeric"
            value={unitPrice}
            className={inputClass}
            placeholder="単価"
            onChange={(e) => setUnitPrice(e.target.value)}
            onKeyDown={(e) => {
              if (justNavigatedRef.current && e.key === "Enter") { e.preventDefault(); return; }
              handleDoubleEnter(e, buyerRef);
            }}
          />
          {/* 買主番号 */}
          <input
            ref={buyerRef}
            type="number"
            inputMode="numeric"
            value={buyerNumber}
            className={`${inputClass} text-center font-mono ${sameNumberError ? "border-destructive ring-destructive" : ""}`}
            placeholder="番号"
            min={1}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "");
              setBuyerNumber(v);
              resolveBuyer(v);
            }}
            onBlur={() => resolveBuyer(buyerNumber)}
            onKeyDown={(e) => {
              if (justNavigatedRef.current && e.key === "Enter") { e.preventDefault(); return; }
              handleDoubleEnter(e, quantityRef);
            }}
          />
          {/* 合計 */}
          <div className="flex items-center justify-end px-2 text-sm font-semibold bg-muted/30 rounded h-8">
            {total > 0 ? `¥${total.toLocaleString()}` : "—"}
          </div>
          {/* 数量 */}
          <input
            ref={quantityRef}
            type="number"
            inputMode="numeric"
            value={quantity}
            className={inputClass}
            placeholder="数量"
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={(e) => {
              if (justNavigatedRef.current && e.key === "Enter") { e.preventDefault(); return; }
              handleDoubleEnter(e, null);
            }}
          />
        </div>
        {/* Display names row */}
        <div className="grid gap-1 mt-0.5" style={{ gridTemplateColumns: "3.5rem 7rem 1fr 7rem 7rem 7rem 5rem" }}>
          <div />
          <div className={`text-[10px] text-center truncate ${sellerDisplayName ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            {sellerDisplayName || "—"}
          </div>
          <div /><div />
          <div className={`text-[10px] text-center truncate ${buyerDisplayName ? (sameNumberError ? "text-destructive font-medium" : "text-foreground font-medium") : "text-muted-foreground"}`}>
            {buyerDisplayName || "—"}
          </div>
          <div /><div />
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function Transactions() {
  const { selectedEventId: globalEventId, selectEvent } = useEvent();
  const selectedEventId = globalEventId ? String(globalEventId) : "";
  const [rows, setRows] = useState<GridRow[]>([]);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  // グリッドセル商品名用の安定したref（インラインref生成を排除して再マウントを防止）
  const gridItemNameRef = useRef<HTMLInputElement>(null);
  const gridItemNameFocusedRef = useRef(false);

  // activeCellが変わったら商品名refのfocusフラグをリセット（次のアクティブ化で再度focusするため）
  useEffect(() => {
    gridItemNameFocusedRef.current = false;
  }, [activeCell?.row, activeCell?.col]);

  // 検索窓
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 売り主（クイック入力から自動保持）
  const [fixedSeller, setFixedSeller] = useState<{ id: number; name: string } | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const savedRowKeysRef = useRef(new Set<string>());

  const utils = trpc.useUtils();
  const { data: events = [] } = trpc.events.list.useQuery(undefined, { refetchInterval: 10000 });
  const { data: members = [] } = trpc.members.list.useQuery({ activeOnly: true }, { refetchInterval: 30000 });
  const { data: transactions = [], isLoading: txLoading } = trpc.transactions.list.useQuery(
    { eventId: parseInt(selectedEventId) },
    { enabled: !!selectedEventId && !isNaN(parseInt(selectedEventId)), refetchInterval: 3000 }
  );

  const selectedEvent = events.find((e) => e.id === parseInt(selectedEventId));
  // closedのみロック（settled/openは編集可能）
  const isLocked = selectedEvent ? selectedEvent.status === "closed" : false;

  // 取消しmutation（settled/closed → open）
  const resetMutation = trpc.settlements.resetSettlements.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      utils.transactions.list.invalidate();
      toast.success("取消しました。編集可能な状態になりました。");
    },
    onError: (e) => toast.error(e.message),
  });

  const memberMapRef = useRef(new Map<number, string>());
  useEffect(() => {
    const map = new Map<number, string>();
    members.forEach((m) => map.set(m.id, `${m.memberNumber} ${m.displayName}`));
    memberMapRef.current = map;
  }, [members]);

  // Stable reference to transaction data
  const txDataRef = useRef<string>("");

  // Load transactions into grid + always have one empty row at the end
  // ポーリング時: IDリスト or データ内容が変わった場合のみ更新
  // アクティブ編集中のセルがある場合は、編集中の行を保護
  useEffect(() => {
    if (!selectedEventId) return;
    const txKey = JSON.stringify(transactions.map((t) => `${t.id}:${t.version}:${t.itemName}:${t.unitPrice}:${t.quantity}:${t.sellerMemberId}:${t.buyerMemberId}:${t.notes}:${t.transactionType}`));
    if (txKey === txDataRef.current && rows.length > 0) return;
    txDataRef.current = txKey;
    const mMap = memberMapRef.current;
    const loaded: GridRow[] = transactions.map((t, i) => ({
      id: t.id,
      rowNumber: t.rowNumber ?? i + 1,
      sellerMemberId: t.sellerMemberId,
      sellerName: mMap.get(t.sellerMemberId) ?? String(t.sellerMemberId),
      buyerMemberId: t.buyerMemberId,
      buyerName: mMap.get(t.buyerMemberId) ?? String(t.buyerMemberId),
      itemName: t.itemName,
      unitPrice: t.unitPrice,
      quantity: t.quantity,
      totalPrice: t.totalPrice,
      transactionType: t.transactionType,
      notes: t.notes ?? "",
      version: t.version,
      isNew: false,
    }));

    // 未保存の新規行を保持
    const existingNewRows = rows.filter((r) => r.isNew && (r.sellerMemberId > 0 || r.itemName.trim() !== ""));
    existingNewRows.forEach((nr) => {
      nr.rowNumber = loaded.length + 1;
      loaded.push(nr);
    });

    if (!isLocked) {
      // 末尾に空行がなければ追加
      const lastRow = loaded[loaded.length - 1];
      if (!lastRow || !lastRow.isNew || lastRow.sellerMemberId > 0 || lastRow.itemName.trim() !== "") {
        loaded.push(makeEmptyRow(loaded.length + 1));
      }
    }
    setRows(loaded);
  }, [transactions, selectedEventId, isLocked]);

  const createMutation = trpc.transactions.bulkCreate.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      toast.success("取引データを保存しました");
      // 追加後に最下部にスクロール
      setTimeout(() => {
        if (tableScrollRef.current) {
          tableScrollRef.current.scrollTop = tableScrollRef.current.scrollHeight;
        }
      }, 300);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.transactions.update.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      toast.success("取引を削除しました");
    },
    onError: (e) => toast.error(e.message),
  });

  // 自動行追加: 最終行に入力があれば新しい空行を追加
  const ensureTrailingEmptyRow = useCallback(() => {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      if (
        last.isNew &&
        (last.sellerMemberId > 0 || last.itemName.trim() !== "" || last.unitPrice > 0)
      ) {
        const newRow = makeEmptyRow(prev.length + 1);
        // 売り主が設定されている場合、新しい行に売り主を自動設定
        if (fixedSeller) {
          newRow.sellerMemberId = fixedSeller.id;
          newRow.sellerName = fixedSeller.name;
        }
        return [...prev, newRow];
      }
      return prev;
    });
  }, [fixedSeller]);

  const updateRow = useCallback(
    (rowIdx: number, key: ColumnKey, value: string | number, memberId?: number) => {
      setRows((prev) => {
        const updated = [...prev];
        const row = { ...updated[rowIdx] };

        if (key === "sellerName" && memberId !== undefined) {
          row.sellerMemberId = memberId;
          row.sellerName = String(value);
        } else if (key === "buyerName" && memberId !== undefined) {
          row.buyerMemberId = memberId;
          row.buyerName = String(value);
        } else if (key === "unitPrice") {
          row.unitPrice = Number(value) || 0;
          row.totalPrice = row.unitPrice * row.quantity;
        } else if (key === "quantity") {
          row.quantity = Number(value) || 1;
          row.totalPrice = row.unitPrice * row.quantity;
        } else {
          (row as any)[key] = value;
        }

        row._dirty = true;
        updated[rowIdx] = row;
        return updated;
      });
    },
    []
  );

  // 自動保存: 既存行の更新
  const saveExistingRow = useCallback(
    (row: GridRow) => {
      if (!row.isNew && row.id && row._dirty) {
        updateMutation.mutate({
          id: row.id,
          version: row.version,
          sellerMemberId: row.sellerMemberId || undefined,
          buyerMemberId: row.buyerMemberId || undefined,
          itemName: row.itemName || undefined,
          unitPrice: row.unitPrice,
          quantity: row.quantity,
          totalPrice: row.totalPrice,
          notes: row.notes || undefined,
        });
      }
    },
    [updateMutation]
  );

  // 自動保存: 新規行の保存（必須項目が揃ったら自動で保存）
  // 二重登録防止: isSavingRef + savedRowKeysRef で同一行の重複保存を防ぐ
  const autoSaveNewRows = useCallback(() => {
    if (isSavingRef.current) return;
    const validNewRows = rows.filter((r) => {
      if (!r.isNew || r.sellerMemberId <= 0 || r.buyerMemberId <= 0 || r.itemName.trim() === "") return false;
      // 同一行の重複保存チェック（売主+買主+商品名+単価+数量+行番号をキーに）
      const rowKey = `${r.rowNumber}-${r.sellerMemberId}-${r.buyerMemberId}-${r.itemName}-${r.unitPrice}-${r.quantity}`;
      return !savedRowKeysRef.current.has(rowKey);
    });
    if (validNewRows.length === 0) return;

    // 保存前にキーを登録して二重実行を防止
    isSavingRef.current = true;
    const keys = validNewRows.map((r) =>
      `${r.rowNumber}-${r.sellerMemberId}-${r.buyerMemberId}-${r.itemName}-${r.unitPrice}-${r.quantity}`
    );
    keys.forEach((k) => savedRowKeysRef.current.add(k));

    createMutation.mutate(
      {
        eventId: parseInt(selectedEventId),
        rows: validNewRows.map((r) => ({
          rowNumber: r.rowNumber,
          sellerMemberId: r.sellerMemberId,
          buyerMemberId: r.buyerMemberId,
          itemName: r.itemName,
          unitPrice: r.unitPrice,
          quantity: r.quantity,
          totalPrice: r.totalPrice,
          transactionType: r.transactionType as "normal" | "return" | "defect",
          notes: r.notes || undefined,
        })),
      },
      {
        onSettled: () => {
          isSavingRef.current = false;
        },
        onError: () => {
          // 保存失敗時はキーを削除してリトライ可能にする
          keys.forEach((k) => savedRowKeysRef.current.delete(k));
        },
      }
    );
  }, [rows, selectedEventId, createMutation]);

  // デバウンスされた自動保存
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveNewRows();
    }, 1500);
  }, [autoSaveNewRows]);

  // セル移動後に自動保存と自動行追加をトリガー
  const onCellLeave = useCallback(
    (rowIdx: number) => {
      const row = rows[rowIdx];
      if (!row) return;
      saveExistingRow(row);
      ensureTrailingEmptyRow();
      scheduleAutoSave();
    },
    [rows, saveExistingRow, ensureTrailingEmptyRow, scheduleAutoSave]
  );

  const pendingCount = rows.filter(
    (r) => r.isNew && r.sellerMemberId > 0 && r.buyerMemberId > 0 && r.itemName.trim() !== ""
  ).length;

  const typeLabels: Record<string, string> = {
    normal: "通常",
    return: "返品",
    defect: "欠損",
  };

  const grandTotal = useMemo(
    () => rows.reduce((sum, r) => sum + (r.totalPrice || 0), 0),
    [rows]
  );

  // 検索フィルタリング
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      // No.（行番号）で検索
      if (String(r.rowNumber) === q) return true;
      // 商品名で検索
      if (r.itemName.toLowerCase().includes(q)) return true;
      // 金額（単価・合計）で検索
      const numQ = Number(q);
      if (!isNaN(numQ) && numQ > 0) {
        if (r.unitPrice === numQ || r.totalPrice === numQ) return true;
      }
      // 売り主で検索（番号 or 名前）
      if (r.sellerName.toLowerCase().includes(q)) return true;
      // 買い主でも検索できるようにする
      if (r.buyerName.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [rows, searchQuery]);

  // 検索中かどうか
  const isSearching = searchQuery.trim().length > 0;

  // 編集可能列リスト
  const activeEditableCols = useMemo(() => {
    return EDITABLE_COLS;
  }, []);

  // Double-Enter tracking for grid table navigation
  const gridEnterCountRef = useRef(0);
  const gridEnterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // キーボードナビゲーション
  const handleKeyNavigation = useCallback(
    (e: KeyboardEvent<HTMLElement>, rowIdx: number, colIdx: number) => {
      // IME変換中は全てのキーナビゲーションを無視（Windows/Mac両対応）
      if (e.nativeEvent.isComposing || (e.nativeEvent as any).keyCode === 229) return;
      const moveToNext = () => {
        const currentEditIdx = activeEditableCols.findIndex((c) => c.idx === colIdx);
        if (e.shiftKey) {
          if (currentEditIdx > 0) {
            setActiveCell({ row: rowIdx, col: activeEditableCols[currentEditIdx - 1].idx });
          } else if (rowIdx > 0) {
            setActiveCell({
              row: rowIdx - 1,
              col: activeEditableCols[activeEditableCols.length - 1].idx,
            });
          }
        } else {
          if (currentEditIdx < activeEditableCols.length - 1) {
            setActiveCell({ row: rowIdx, col: activeEditableCols[currentEditIdx + 1].idx });
          } else {
            // 次の行の最初の編集可能列へ
            setActiveCell({ row: rowIdx + 1, col: activeEditableCols[0].idx });
          }
        }
        onCellLeave(rowIdx);
      };

      // Tab always moves immediately
      if (e.key === "Tab") {
        e.preventDefault();
        gridEnterCountRef.current = 0;
        moveToNext();
      } else if (e.key === "Enter" && !e.shiftKey && COLUMNS[colIdx].type !== "member") {
        // Enter: require 2 presses within 800ms
        e.preventDefault();
        gridEnterCountRef.current += 1;
        if (gridEnterTimerRef.current) clearTimeout(gridEnterTimerRef.current);
        if (gridEnterCountRef.current >= 2) {
          gridEnterCountRef.current = 0;
          moveToNext();
        } else {
          gridEnterTimerRef.current = setTimeout(() => { gridEnterCountRef.current = 0; }, 800);
        }
      } else if (e.key === "ArrowDown" && COLUMNS[colIdx].type !== "member") {
        e.preventDefault();
        if (rowIdx < rows.length - 1) {
          setActiveCell({ row: rowIdx + 1, col: colIdx });
          onCellLeave(rowIdx);
        }
      } else if (e.key === "ArrowUp" && COLUMNS[colIdx].type !== "member") {
        e.preventDefault();
        if (rowIdx > 0) {
          setActiveCell({ row: rowIdx - 1, col: colIdx });
          onCellLeave(rowIdx);
        }
      } else if (e.key === "Escape") {
        setActiveCell(null);
      }
    },
    [rows.length, onCellLeave, activeEditableCols]
  );

  /* ─── Cell Rendering ─── */
  const renderCell = (
    row: GridRow,
    rowIdx: number,
    col: (typeof COLUMNS)[number],
    colIdx: number
  ) => {
    const isActive = activeCell?.row === rowIdx && activeCell?.col === colIdx;
    const value = (row as any)[col.key];

    // Non-editable or locked, or seller column when fixed
    if (!col.editable || isLocked) {
      if (col.key === "totalPrice" || col.key === "unitPrice") {
        return (
          <span className={`px-2 ${col.key === "totalPrice" ? "font-semibold" : ""}`}>
            {value ? `¥${Number(value).toLocaleString()}` : ""}
          </span>
        );
      }
      if (col.key === "rowNumber") {
        return <span className="px-2 text-muted-foreground">{value}</span>;
      }
      return <span className="px-2">{value}</span>;
    }

    // Member number-only fields (seller/buyer)
    if (col.type === "member") {
      // Extract member number from stored value (e.g., "123 山田太郎" -> "123")
      const memberNum = col.key === "sellerName" ? row.sellerMemberId : row.buyerMemberId;
      const memberInfo = members.find((m) => m.id === memberNum);
      const displayNum = memberInfo ? String(memberInfo.memberNumber) : (memberNum > 0 ? String(memberNum) : "");
      const displayName = memberInfo?.displayName || "";

      if (!isActive) {
        return (
          <div className="w-full h-full px-1 py-0.5 cursor-text min-h-[28px] flex flex-col justify-center">
            <span className="text-sm font-mono text-center">{displayNum || <span className="text-muted-foreground/40 text-xs">番号</span>}</span>
            {displayName && <span className="text-[9px] text-muted-foreground text-center truncate">{displayName}</span>}
          </div>
        );
      }
      return (
        <div className="w-full">
          <input
            type="number"
            inputMode="numeric"
            defaultValue={displayNum}
            className="w-full h-7 px-2 py-0.5 text-sm font-mono text-center border-0 bg-blue-50/40 focus:outline-none rounded"
            placeholder="番号"
            min={1}
            autoFocus
            onChange={(e) => {
              const num = parseInt(e.target.value);
              const m = members.find((mem) => mem.memberNumber === num);
              if (m) {
                const label = `${m.memberNumber} ${m.displayName}`;
                updateRow(rowIdx, col.key as ColumnKey, label, m.id);
                // Check same seller/buyer
                if (col.key === "buyerName" && row.sellerMemberId === m.id) {
                  toast.error("売主と買主が同じ番号です");
                } else if (col.key === "sellerName" && row.buyerMemberId === m.id) {
                  toast.error("売主と買主が同じ番号です");
                }
              }
            }}
            onKeyDown={(e) => handleKeyNavigation(e as any, rowIdx, colIdx)}
            onBlur={() => onCellLeave(rowIdx)}
          />
        </div>
      );
    }

    // Text / Number input - inactive state
    if (!isActive) {
      return (
        <div className="w-full h-full px-2 py-1 cursor-text min-h-[28px] flex items-center text-sm">
          {col.type === "number" && value
            ? col.key === "unitPrice"
              ? `¥${Number(value).toLocaleString()}`
              : value
            : value || (
                <span className="text-muted-foreground/40 text-xs">
                  {col.type === "number" ? "0" : "-"}
                </span>
              )}
        </div>
      );
    }

    // Text / Number input - active state
    // 商品名セルはItemNameAutocompleteを使用（オートコンプリート+上下キー選択対応）
    // 安定したrefを使用し、マウント時に1回だけfocusを実行
    if (col.key === "itemName") {
      // アクティブになったらfocusフラグをリセット（次回のアクティブ化で再度focusするため）
      if (!gridItemNameFocusedRef.current) {
        gridItemNameFocusedRef.current = true;
        setTimeout(() => {
          gridItemNameRef.current?.focus({ preventScroll: true });
        }, 10);
      }
      return (
        <ItemNameAutocomplete
          inputRef={gridItemNameRef}
          value={value ?? ""}
          onChange={(val) => updateRow(rowIdx, col.key as ColumnKey, val)}
          className="w-full h-8 px-2 py-1 text-sm border-0 bg-blue-50/40 focus:outline-none rounded"
          style={{ imeMode: "active" } as React.CSSProperties}
          placeholder=""
          onKeyDown={(e) => {
            // 上下キーは候補リストが処理するので、それ以外のキーのみグリッドナビゲーションに渡す
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") {
              handleKeyNavigation(e, rowIdx, colIdx);
            }
          }}
        />
      );
    }
    return (
      <CellInput
        type={col.type === "number" ? "number" : "text"}
        value={value ?? ""}
        onChange={(val) =>
          updateRow(
            rowIdx,
            col.key as ColumnKey,
            col.type === "number" ? Number(val) : val
          )
        }
        onBlur={() => onCellLeave(rowIdx)}
        onKeyDown={(e) => handleKeyNavigation(e, rowIdx, colIdx)}
        placeholder={col.type === "number" ? "0" : ""}
      />
    );
  };

  const getRowBg = (row: GridRow, rowIdx: number) => {
    if (row.isNew && !row.sellerMemberId && !row.itemName && rowIdx === rows.length - 1) {
      return "bg-muted/20";
    }
    if (row.isNew) return "bg-green-50";
    if (row.transactionType === "return") return "bg-red-50";
    if (row.transactionType === "defect") return "bg-amber-50";
    return "hover:bg-muted/50";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">取引入力</h1>
          <p className="text-muted-foreground mt-1">
            スプレッドシート形式で取引データを入力します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedEventId}
            onChange={(e) => {
              selectEvent(e.target.value ? parseInt(e.target.value) : null);
              setRows([]);
              setActiveCell(null);
              txDataRef.current = "";
              savedRowKeysRef.current.clear();
            }}
            className="w-[260px] h-9 px-3 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">イベントを選択...</option>
            {events.map((ev) => (
              <option key={ev.id} value={String(ev.id)}>
                {ev.eventDate} {ev.title ?? ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedEventId ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {isLocked && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                このイベントは最終締め済みです（読み取り専用）
              </span>
            )}
            {selectedEvent?.status === "settled" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                精算処理済み（取引編集可能）
              </span>
            )}
            {(selectedEvent?.status === "settled" || selectedEvent?.status === "closed") && (
              <button
                onClick={() => {
                  if (confirm(`このイベントの${selectedEvent.status === "closed" ? "最終締めと精算処理" : "精算処理"}を取消し、編集可能な状態に戻しますか？`)) {
                    resetMutation.mutate({ eventId: parseInt(selectedEventId) });
                  }
                }}
                disabled={resetMutation.isPending}
                className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Unlock className="h-4 w-4 mr-1" />
                {resetMutation.isPending ? "取消中..." : "取消し"}
              </button>
            )}
            {!isLocked && (
              <button
                onClick={() => {
                  txDataRef.current = "";
                  utils.transactions.list.invalidate();
                }}
                className="inline-flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                更新
              </button>
            )}
            <button
              onClick={() => {
                const link = document.createElement("a");
                link.href = `/api/excel/transactions/${selectedEventId}`;
                link.download = "";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success("Excelファイルのダウンロードを開始しました");
              }}
              className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
            >
              <Download className="h-4 w-4 mr-1" />
              Excel出力
            </button>
            <div className="ml-auto text-sm text-muted-foreground">
              {rows.filter((r) => !r.isNew || r.sellerMemberId > 0).length}件 | 合計:{" "}
              <span className="font-bold text-foreground">
                ¥{grandTotal.toLocaleString()}
              </span>
              {pendingCount > 0 && (
                <span className="ml-2 text-amber-600">
                  ({pendingCount}件 未保存 - 自動保存されます)
                </span>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Tab</kbd>: 次のセル</span>
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter×2</kbd>: 次のセル</span>
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Shift+Tab</kbd>: 前のセル</span>
            <span>
              <ArrowUp className="h-3 w-3 inline" />/
              <ArrowDown className="h-3 w-3 inline" />: 上下移動
            </span>
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>: 選択解除</span>
            <span className="text-primary font-medium">最終行に入力すると自動で行が追加されます</span>
            {activeCell && (() => {
              const col = COLUMNS[activeCell.col];
              if (!col) return null;
              const isTextInput = col.type === "text";
              const isMemberInput = col.type === "member";
              const isNumberInput = col.type === "number";
              return (
                <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  isTextInput
                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                    : isMemberInput
                    ? "bg-amber-100 text-amber-700 border border-amber-200"
                    : isNumberInput
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {isTextInput && <>⌨ 日本語入力</>}
                  {isMemberInput && <># 番号入力</>}
                  {isNumberInput && <># 数値入力</>}
                </span>
              );
            })()}
          </div>

          {/* 検索窓 */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="検索（番号・商品名・金額・売主・買主）"
                  className="w-full h-9 pl-9 pr-9 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/60"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              {isSearching && (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {filteredRows.length}件 / {rows.filter((r) => !r.isNew || r.sellerMemberId > 0).length}件
                </span>
              )}
            </div>
          </div>

          {/* クイック入力ボックス（全フィールド対応） */}
          {!isLocked && (
            <QuickEntryForm
              members={members}
              onSellerChange={(seller: { id: number; name: string } | null) => {
                setFixedSeller(seller);
              }}
              onAddRow={(entry) => {
                // 即座にDBに保存（stale closure問題を回避）
                const totalPrice = (entry.unitPrice || 0) * (entry.quantity || 1);
                createMutation.mutate(
                  {
                    eventId: parseInt(selectedEventId),
                    rows: [{
                      rowNumber: rows.length > 0 ? rows[rows.length - 1].rowNumber + 1 : 1,
                      sellerMemberId: entry.sellerMemberId,
                      buyerMemberId: entry.buyerMemberId,
                      itemName: entry.itemName,
                      unitPrice: entry.unitPrice,
                      quantity: entry.quantity,
                      totalPrice,
                      transactionType: entry.transactionType as "normal" | "return" | "defect",
                      notes: undefined,
                    }],
                  },
                );
              }}
            />
          )}

          <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
            <div
              ref={tableScrollRef}
              className="overflow-auto"
              style={{ maxHeight: "calc(100vh - 320px)", minHeight: 400 }}
            >
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted/80 backdrop-blur">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={`${col.width} px-2 py-2 text-left font-medium text-muted-foreground border-b border-r border-border last:border-r-0 whitespace-nowrap`}
                      >
                        {col.label}
                      </th>
                    ))}
                    {!isLocked && (
                      <th className="w-10 px-1 py-2 border-b border-border"></th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {txLoading ? (
                    <tr>
                      <td
                        colSpan={COLUMNS.length + 1}
                        className="text-center py-12 text-muted-foreground"
                      >
                        読み込み中...
                      </td>
                    </tr>
                  ) : isSearching && filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={COLUMNS.length + 1}
                        className="text-center py-12 text-muted-foreground"
                      >
                        「{searchQuery}」に一致する取引が見つかりません
                      </td>
                    </tr>
                  ) : (
                    (isSearching ? filteredRows : rows).map((row, rowIdx) => {
                      const originalRowIdx = isSearching ? rows.indexOf(row) : rowIdx;
                      return <tr
                        key={row.id ?? `new-${originalRowIdx}`}
                        className={`${getRowBg(row, originalRowIdx)} border-b border-border transition-colors ${isSearching ? 'bg-yellow-50/30' : ''}`}
                      >
                        {COLUMNS.map((col, colIdx) => (
                          <td
                            key={col.key}
                            className={`${col.width} px-0 py-0 border-r border-border last:border-r-0 ${
                              activeCell?.row === originalRowIdx && activeCell?.col === colIdx
                                ? "ring-2 ring-primary ring-inset bg-blue-50/30"
                                : ""
                            }`}
                            onClick={() => {
                              if (col.editable && !isLocked && !isSearching) {
                                setActiveCell({ row: originalRowIdx, col: colIdx });
                              }
                            }}
                          >
                            <div className="min-h-[32px] flex items-center">
                              {renderCell(row, originalRowIdx, col, colIdx)}
                            </div>
                          </td>
                        ))}
                        {!isLocked && (
                          <td className="w-10 px-1 py-0 text-center">
                            {row.id ? (
                              <button
                                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                title="削除"
                                onClick={() => {
                                  if (row.id) deleteMutation.mutate({ id: row.id });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : !isSearching && originalRowIdx < rows.length - 1 ? (
                              <button
                                className="text-muted-foreground hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                title="行を除去"
                                onClick={() => {
                                  setRows((prev) => prev.filter((_, i) => i !== originalRowIdx));
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </td>
                        )}
                      </tr>;
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="py-16 text-center text-muted-foreground">
            イベントを選択して取引入力を開始してください
          </div>
        </div>
      )}
    </div>
  );
}
