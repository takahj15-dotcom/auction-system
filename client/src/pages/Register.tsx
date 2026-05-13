import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useEvent } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Check,
  Search,
  RotateCcw,
  Printer,
  CheckCircle2,
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  Delete,
  ClipboardList,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type SettlementItem = {
  id: number;
  memberId: number;
  salesTotal: number;
  salesCommission: number;
  purchaseTotal: number;
  purchaseCommission: number;
  participationFee: number;
  companionCount: number;
  companionFee: number;
  taxAmount: number;
  salesReturnTotal: number;
  purchaseReturnTotal: number;
  settlementAmount: number;
  isSettled: boolean;
  settledAt: string | null;
  settlementType?: string;
  member?: {
    memberNumber: number;
    displayName: string;
  };
};

function fmt(n: number): string {
  return `¥${Math.abs(n).toLocaleString()}`;
}

// Signature canvas component for tablet
function SignatureCanvas({
  onSave,
  onClear,
}: {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    isDrawing.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    onClear();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">
        下の枠内にサインしてください
      </p>
      <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          style={{ height: "350px" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={handleClear}>
          <RotateCcw className="h-4 w-4 mr-1" />
          クリア
        </Button>
        <Button onClick={handleSave}>
          <Check className="h-4 w-4 mr-1" />
          確認
        </Button>
      </div>
    </div>
  );
}

/**
 * settlementAmount の意味（請求書視点）:
 * - 正の値 (> 0): 仕入 > 売上 → お客様から会社へお支払いいただく（入金）
 * - 負の値 (< 0): 売上 > 仕入 → 会社からお客様へお支払いする（支払い）
 * - 0: 差引ゼロ
 */

// テンキー専用コンポーネント - 数字のみ、IME無効
function NumericKeypad({
  value,
  onChange,
  customerPayAmount,
}: {
  value: string;
  onChange: (val: string) => void;
  customerPayAmount: number;
}) {
  const appendDigit = useCallback((digit: string) => {
    onChange(value + digit);
  }, [value, onChange]);

  const deleteLastDigit = useCallback(() => {
    if (value.length <= 1) {
      onChange("");
    } else {
      onChange(value.slice(0, -1));
    }
  }, [value, onChange]);

  const clearAll = useCallback(() => {
    onChange("");
  }, [onChange]);

  const setExact = useCallback(() => {
    onChange(String(customerPayAmount));
  }, [customerPayAmount, onChange]);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm text-muted-foreground block mb-1">お預かり金額</label>
        <div className="text-3xl h-16 flex items-center justify-end px-4 font-mono bg-muted/30 rounded-md border select-none">
          {value ? (
            <span>{`¥${parseInt(value, 10).toLocaleString()}`}</span>
          ) : (
            <span className="text-muted-foreground">¥0</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
          <Button
            key={num}
            variant="outline"
            className="h-14 text-2xl font-mono select-none"
            type="button"
            onClick={() => appendDigit(String(num))}
          >
            {num}
          </Button>
        ))}
        <Button
          variant="outline"
          className="h-14 text-2xl font-mono select-none"
          type="button"
          onClick={() => appendDigit("00")}
        >
          00
        </Button>
        <Button
          variant="outline"
          className="h-14 text-2xl font-mono select-none"
          type="button"
          onClick={() => appendDigit("0")}
        >
          0
        </Button>
        <Button
          variant="destructive"
          className="h-14 text-lg select-none"
          type="button"
          onClick={deleteLastDigit}
        >
          <Delete className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          className="h-12 select-none"
          type="button"
          onClick={clearAll}
        >
          クリア
        </Button>
        <Button
          variant="outline"
          className="h-12 select-none"
          type="button"
          onClick={setExact}
        >
          ちょうど ({fmt(customerPayAmount)})
        </Button>
      </div>
    </div>
  );
}

export default function Register() {
  const { selectedEventId: globalEventId } = useEvent();
  const selectedEventId = globalEventId ? String(globalEventId) : "";
  const [, navigate] = useLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementItem | null>(null);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: settlements = [], isLoading } = trpc.settlements.list.useQuery(
    { eventId: parseInt(selectedEventId) },
    { enabled: !!selectedEventId, refetchInterval: 5000 }
  );

  // レジ取引記録を取得（完了済みかどうかの判定に使用）
  const { data: registerTxns = [] } = trpc.register.list.useQuery(
    { eventId: parseInt(selectedEventId) },
    { enabled: !!selectedEventId, refetchInterval: 5000 }
  );

  // レジ精算完了mutation（お預かり・お釣り・サインをDB保存）
  const registerCompleteMutation = trpc.register.complete.useMutation({
    onSuccess: () => {
      utils.settlements.list.invalidate();
      utils.register.list.invalidate();
    },
    onError: (err) => {
      toast.error(`精算完了の保存に失敗しました: ${err.message}`);
    },
  });

  // レジ精算取り消しmutation（管理者のみ）
  const cancelCompleteMutation = trpc.register.cancelComplete.useMutation({
    onSuccess: () => {
      utils.settlements.list.invalidate();
      utils.register.list.invalidate();
      toast.success("精算を取り消しました。再度精算できます。");
      setSelectedSettlement((prev) =>
        prev ? { ...prev, isSettled: false, settledAt: null } : null
      );
    },
    onError: (err) => {
      toast.error(`精算取り消しに失敗しました: ${err.message}`);
    },
  });

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  // settlementIdからレジ取引記録を検索
  const getRegisterTxn = useCallback((settlementId: number) => {
    return registerTxns.find((tx: any) => tx.settlementId === settlementId);
  }, [registerTxns]);

  // Filter settlements by search
  const filteredSettlements = settlements
    .filter((s: any) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const memberNum = String(s.member?.memberNumber ?? "");
      const memberName = (s.member?.displayName ?? "").toLowerCase();
      return memberNum.includes(q) || memberName.includes(q);
    })
    // 未精算を上、精算済みを下にソート（同じステータス内は会員番号順）
    .sort((a: any, b: any) => {
      if (a.isSettled !== b.isSettled) return a.isSettled ? 1 : -1;
      return (a.member?.memberNumber ?? 0) - (b.member?.memberNumber ?? 0);
    });

  const settlementAmount = selectedSettlement?.settlementAmount ?? 0;
  // 入金: お客様から会社がいただく金額（settlementAmount > 0 = 買い主）
  const customerPayAmount = settlementAmount > 0 ? settlementAmount : 0;
  // 支払い: 会社からお客様にお支払いする金額（settlementAmount < 0 = 売り主）
  const customerReceiveAmount = settlementAmount < 0 ? Math.abs(settlementAmount) : 0;

  const received = parseInt(receivedAmount, 10) || 0;
  const change = received - customerPayAmount;

  // 選択中のsettlementの最新データを取得
  const currentSettlement = selectedSettlement
    ? settlements.find((s: any) => s.id === selectedSettlement.id) ?? selectedSettlement
    : null;

  // 現在のsettlementのレジ取引記録
  const currentRegTxn = currentSettlement ? getRegisterTxn(currentSettlement.id) : null;

  const handleSelectSettlement = useCallback((s: SettlementItem) => {
    setSelectedSettlement(s);
    setReceivedAmount("");
    setSignatureData(null);
  }, []);

  const handleComplete = () => {
    if (!selectedSettlement) return;
    setSignatureDialogOpen(true);
  };

  const handleSignatureSave = (dataUrl: string) => {
    setSignatureData(dataUrl);
    setSignatureDialogOpen(false);

    if (!selectedSettlement) return;

    // レジ取引記録をDBに保存
    registerCompleteMutation.mutate(
      {
        settlementId: selectedSettlement.id,
        receivedAmount: customerPayAmount > 0 ? received : 0,
        changeAmount: customerPayAmount > 0 ? Math.max(0, change) : 0,
        signatureBase64: dataUrl,
      },
      {
        onSuccess: () => {
          toast.success(`${selectedSettlement.member?.displayName ?? ""}の精算が完了しました（保存済み）`);
          setSelectedSettlement((prev) =>
            prev ? { ...prev, isSettled: true, settledAt: new Date().toISOString() } : null
          );
        },
      }
    );
  };

  const handlePrintReceipt = () => {
    if (!selectedSettlement) return;
    const link = document.createElement("a");
    link.href = `/api/pdf/settlement/${selectedSettlement.id}`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBack = () => {
    setSelectedSettlement(null);
    setReceivedAmount("");
    setSignatureData(null);
  };

  // If no event selected
  if (!selectedEventId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">レジ</h1>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            ダッシュボードでイベントを選択してください
          </CardContent>
        </Card>
      </div>
    );
  }

  // Detail view (selected settlement)
  if (currentSettlement) {
    const isCompleted = currentSettlement.isSettled;
    const regTxn = currentRegTxn;

    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            戻る
          </Button>
          <h1 className="text-xl font-bold">レジ精算</h1>
          {registerCompleteMutation.isPending && (
            <span className="text-sm text-muted-foreground animate-pulse">保存中...</span>
          )}
        </div>

        {/* Member & Amount Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-lg text-muted-foreground">
                {currentSettlement.member?.memberNumber ?? "-"}
                {(currentSettlement as any).suffix && (
                  <span className="ml-1 text-blue-600 font-bold">-{(currentSettlement as any).suffix}</span>
                )}
              </p>
              <p className="text-2xl font-bold">
                {currentSettlement.member?.displayName ?? "-"}
              </p>

              {/* 内訳表示 */}
              <div className="pt-2 text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between px-8">
                  <span>売合計:</span>
                  <span className="font-mono">{fmt(currentSettlement.salesTotal)}</span>
                </div>
                <div className="flex justify-between px-8">
                  <span>売歩合(税込):</span>
                  <span className="font-mono text-red-500">-{fmt(currentSettlement.salesCommission + Math.floor(currentSettlement.salesCommission * 0.1))}</span>
                </div>
                <div className="flex justify-between px-8">
                  <span>買合計:</span>
                  <span className="font-mono">{fmt(currentSettlement.purchaseTotal)}</span>
                </div>
                <div className="flex justify-between px-8">
                  <span>買歩合(税込):</span>
                  <span className="font-mono text-red-500">-{fmt(currentSettlement.purchaseCommission + Math.floor(currentSettlement.purchaseCommission * 0.1))}</span>
                </div>
                {(currentSettlement.salesReturnTotal ?? 0) > 0 && (
                  <div className="flex justify-between px-8" style={{ background: "#ffffcc", borderRadius: 4, padding: "2px 32px" }}>
                    <span className="font-semibold">売返品:</span>
                    <span className="font-mono text-red-500">-{fmt(currentSettlement.salesReturnTotal)}</span>
                  </div>
                )}
                {(currentSettlement.purchaseReturnTotal ?? 0) > 0 && (
                  <div className="flex justify-between px-8" style={{ background: "#ffffcc", borderRadius: 4, padding: "2px 32px" }}>
                    <span className="font-semibold">買返品:</span>
                    <span className="font-mono text-green-600">+{fmt(currentSettlement.purchaseReturnTotal)}</span>
                  </div>
                )}
                {/* 参加費: 受付情報に基づく表示 */}
                {currentSettlement.participationFee > 0 && (
                  <div style={{ background: "#ffe6e6", borderRadius: 4, padding: "2px 32px" }}>
                    <div className="flex justify-between">
                      <span className="font-semibold">参加費:</span>
                      <span className="font-mono text-red-500">-{fmt(currentSettlement.participationFee)}</span>
                    </div>
                    <div className="text-xs text-red-400 text-right">精算書にて差し引かせていただきます</div>
                  </div>
                )}
                {currentSettlement.participationFee === 0 && (currentSettlement as any).participationFeeStatus === "collected" && (
                  <div className="flex justify-between px-8" style={{ background: "#e6ffe6", borderRadius: 4, padding: "2px 32px" }}>
                    <span className="font-semibold">参加費:</span>
                    <span className="font-mono text-green-600">受付時に領収済み</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                {settlementAmount < 0 ? (
                  <>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <ArrowUpCircle className="h-4 w-4 text-blue-600" />
                      <span>お客様へお支払い</span>
                    </div>
                    <p className="text-4xl font-bold text-blue-600 mt-1">
                      {fmt(customerReceiveAmount)}
                    </p>
                  </>
                ) : settlementAmount > 0 ? (
                  <>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                      <span>お客様からの入金</span>
                    </div>
                    <p className="text-4xl font-bold text-emerald-600 mt-1">
                      {fmt(customerPayAmount)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">差引金額</p>
                    <p className="text-4xl font-bold text-gray-500 mt-1">¥0</p>
                    <p className="text-sm text-muted-foreground mt-1">金銭の授受はありません</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Calculator - only when customer needs to pay (deposit) */}
        {customerPayAmount > 0 && !isCompleted && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">お釣り計算</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NumericKeypad
                value={receivedAmount}
                onChange={setReceivedAmount}
                customerPayAmount={customerPayAmount}
              />

              {received > 0 && (
                <div className={`text-center p-4 rounded-lg ${change >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                  <p className="text-sm text-muted-foreground">お釣り</p>
                  <p className={`text-3xl font-bold font-mono ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {change >= 0 ? fmt(change) : `-${fmt(Math.abs(change))}`}
                  </p>
                  {change < 0 && (
                    <p className="text-sm text-red-500 mt-1">不足しています</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Completed state - show saved register transaction details */}
        {isCompleted && regTxn && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">レジ取引記録（保存済み）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {regTxn.depositAmount > 0 && (
                  <div className="flex justify-between">
                    <span>入金（お客様から）:</span>
                    <span className="font-mono font-bold">{fmt(regTxn.depositAmount)}</span>
                  </div>
                )}
                {regTxn.paymentAmount > 0 && (
                  <div className="flex justify-between">
                    <span>支払い（お客様へ）:</span>
                    <span className="font-mono font-bold">{fmt(regTxn.paymentAmount)}</span>
                  </div>
                )}
                {regTxn.receivedAmount > 0 && (
                  <div className="flex justify-between">
                    <span>お預かり:</span>
                    <span className="font-mono">{fmt(regTxn.receivedAmount)}</span>
                  </div>
                )}
                {regTxn.changeAmount > 0 && (
                  <div className="flex justify-between">
                    <span>お釣り:</span>
                    <span className="font-mono">{fmt(regTxn.changeAmount)}</span>
                  </div>
                )}
                {regTxn.signatureUrl && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground mb-1">サイン:</p>
                    <div className="border rounded-lg p-2 bg-white inline-block">
                      <img src={regTxn.signatureUrl} alt="署名" className="h-16" />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {isCompleted ? (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-lg font-bold">精算完了（保存済み）</span>
              </div>
              {/* お客様への挨拶メッセージ */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mx-auto max-w-sm">
                <p className="text-base text-amber-900 font-medium">
                  {currentSettlement.member?.displayName ?? ""} 様、本日はご参加ありがとうございました。
                </p>
                <p className="text-sm text-amber-800 mt-1">
                  また次回もよろしくお願いいたします。
                </p>
              </div>
              {signatureData && !regTxn?.signatureUrl && (
                <div className="border rounded-lg p-2 bg-white inline-block">
                  <img src={signatureData} alt="署名" className="h-20" />
                </div>
              )}
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" onClick={handlePrintReceipt}>
                  <Printer className="h-4 w-4 mr-2" />
                  精算書PDF
                </Button>
                <Button variant="outline" onClick={handleBack}>
                  次のお客様へ
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={cancelCompleteMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  精算取消
                </Button>
              </div>

              {/* 取り消し確認ダイアログ */}
              <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>精算取り消し確認</DialogTitle>
                  </DialogHeader>
                  <div className="py-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-bold text-foreground">{currentSettlement.member?.displayName}</span>
                      （No.{currentSettlement.member?.memberNumber}）のレジ精算を取り消します。
                    </p>
                    <p className="text-sm text-muted-foreground">
                      レジ取引記録（お預かり・お釣り・サイン）が削除され、再度精算できる状態に戻ります。
                    </p>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button variant="outline" onClick={() => setCancelConfirmOpen(false)}>
                        キャンセル
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          cancelCompleteMutation.mutate({ settlementId: currentSettlement.id });
                          setCancelConfirmOpen(false);
                        }}
                        disabled={cancelCompleteMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        取り消す
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <Button
              className="w-full h-14 text-lg"
              onClick={handleComplete}
              disabled={(customerPayAmount > 0 && change < 0) || registerCompleteMutation.isPending}
            >
              <CreditCard className="h-5 w-5 mr-2" />
              精算完了・サインへ
            </Button>
          )}
        </div>

        {/* Signature Dialog */}
        <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>お客様確認サイン</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">
                  {currentSettlement.member?.displayName ?? ""} 様
                </p>
                {settlementAmount < 0 ? (
                  <p className="text-2xl font-bold text-blue-600">
                    お支払い: {fmt(customerReceiveAmount)}
                  </p>
                ) : settlementAmount > 0 ? (
                  <>
                    <p className="text-2xl font-bold text-emerald-600">
                      入金: {fmt(customerPayAmount)}
                    </p>
                    {received > 0 && (
                      <div className="text-sm text-muted-foreground mt-1">
                        お預かり: {fmt(received)} / お釣り: {fmt(Math.max(0, change))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-2xl font-bold text-gray-500">差引: ¥0</p>
                )}
              </div>
              <SignatureCanvas
                onSave={handleSignatureSave}
                onClear={() => setSignatureData(null)}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const unsettledCount = settlements.filter((s: any) => !s.isSettled).length;
  const settledCount = settlements.filter((s: any) => s.isSettled).length;

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">レジ</h1>
          <p className="text-muted-foreground mt-1">
            精算書に基づいてお客様への支払い・受け取りを行います
          </p>
        </div>
        <div className="flex items-center gap-3">
          {settlements.length > 0 && (
            <Button
              variant={unsettledCount === 0 ? "default" : "outline"}
              onClick={() => navigate("/register/closing")}
              disabled={unsettledCount > 0}
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              レジ締め
              {unsettledCount > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs px-1.5 py-0">
                  残{unsettledCount}
                </Badge>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* 未精算/精算済みカウンター */}
      {settlements.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-lg border p-3 flex items-center gap-3 ${
            unsettledCount > 0 ? "bg-amber-50 border-amber-200" : "bg-muted/30"
          }`}>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg font-bold ${
              unsettledCount > 0 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
            }`}>
              {unsettledCount}
            </div>
            <div>
              <p className={`text-sm font-medium ${
                unsettledCount > 0 ? "text-amber-800" : "text-muted-foreground"
              }`}>未精算</p>
              <p className="text-xs text-muted-foreground">残り</p>
            </div>
          </div>
          <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg font-bold text-emerald-700">
              {settledCount}
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800">精算済み</p>
              <p className="text-xs text-muted-foreground">{settlements.length}件中</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="会員番号または名前で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 text-base"
          inputMode="search"
        />
      </div>

      {/* Settlement List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground">読み込み中...</div>
          ) : filteredSettlements.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              {settlements.length === 0
                ? "精算データがありません。先に締め処理を行ってください。"
                : "検索結果がありません"}
            </div>
          ) : (
            <div className="divide-y">
              {filteredSettlements.map((s: any) => {
                const isCompleted = s.isSettled;
                const amt = s.settlementAmount;
                const regTxn = getRegisterTxn(s.id);
                return (
                  <button
                    key={s.id}
                    className={`w-full text-left px-4 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors ${
                      isCompleted ? "bg-emerald-50/50" : ""
                    }`}
                    onClick={() => handleSelectSettlement(s)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[3rem]">
                        <span className="text-lg font-mono font-bold">
                          {s.member?.memberNumber ?? "-"}
                          {(s as any).suffix && (
                            <span className="ml-0.5 text-blue-600">-{(s as any).suffix}</span>
                          )}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-base">{s.member?.displayName ?? "-"}</p>
                        <p className="text-sm text-muted-foreground">
                          売合計: {fmt(s.salesTotal)} / 買合計: {fmt(s.purchaseTotal)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {s.settlementType === "interim" && (
                        <Badge variant="outline" className="text-blue-600 border-blue-500 text-xs mr-1">
                          途中
                        </Badge>
                      )}
                      {isCompleted && (
                        <Badge variant="default" className="bg-emerald-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          完了
                        </Badge>
                      )}
                      {regTxn?.signatureUrl && (
                        <Badge variant="outline" className="text-gray-500 border-gray-400 text-xs">
                          署名済
                        </Badge>
                      )}
                      <div className="text-right">
                        {amt < 0 ? (
                          <>
                            <p className="text-xs text-muted-foreground">支払い</p>
                            <p className="text-xl font-bold text-blue-600 font-mono">{fmt(amt)}</p>
                          </>
                        ) : amt > 0 ? (
                          <>
                            <p className="text-xs text-muted-foreground">入金</p>
                            <p className="text-xl font-bold text-emerald-600 font-mono">{fmt(amt)}</p>
                          </>
                        ) : (
                          <p className="text-xl font-bold text-gray-400 font-mono">¥0</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {settlements.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
          <span>
            精算済み: {settlements.filter((s: any) => s.isSettled).length} / {settlements.length}件
          </span>
          <span>
            合計精算額: {fmt(settlements.reduce((sum: number, s: any) => sum + s.settlementAmount, 0))}
          </span>
        </div>
      )}
    </div>
  );
}
