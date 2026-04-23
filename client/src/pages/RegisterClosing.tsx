import { useState, useRef } from "react";
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
  ArrowLeft,
  Printer,
  Calculator,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  FileText,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function fmt(n: number): string {
  return `¥${Math.abs(n).toLocaleString()}`;
}

function fmtSigned(n: number): string {
  if (n > 0) return `+¥${n.toLocaleString()}`;
  if (n < 0) return `-¥${Math.abs(n).toLocaleString()}`;
  return "¥0";
}

export default function RegisterClosing() {
  const { selectedEventId: globalEventId } = useEvent();
  const selectedEventId = globalEventId ? String(globalEventId) : "";
  const [, navigate] = useLocation();
  const [actualBalance, setActualBalance] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const [cancelTarget, setCancelTarget] = useState<{ settlementId: number; memberName: string; memberNumber: number } | null>(null);

  const utils = trpc.useUtils();

  // レジ精算取り消しmutation
  const cancelCompleteMutation = trpc.register.cancelComplete.useMutation({
    onSuccess: () => {
      utils.register.closingSummary.invalidate();
      utils.settlements.list.invalidate();
      utils.register.list.invalidate();
      toast.success("精算を取り消しました。レジ画面で再度精算できます。");
      setCancelTarget(null);
    },
    onError: (err) => {
      toast.error(`精算取り消しに失敗しました: ${err.message}`);
    },
  });

  const { data: summary, isLoading } = trpc.register.closingSummary.useQuery(
    { eventId: parseInt(selectedEventId) },
    { enabled: !!selectedEventId, refetchInterval: 5000 }
  );

  const actualBalanceNum = parseInt(actualBalance.replace(/[^0-9]/g, ""), 10) || 0;
  const difference = summary ? actualBalanceNum - summary.theoreticalBalance : 0;

  const handlePrint = () => {
    // レジ締めレシートPDFをダウンロード
    if (!selectedEventId) return;
    const url = `/api/pdf/register-closing/${selectedEventId}?actualBalance=${actualBalanceNum}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBrowserPrint = () => {
    // ブラウザの印刷機能で印刷
    window.print();
  };

  if (!selectedEventId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">レジ締め</h1>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            ダッシュボードでイベントを選択してください
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">レジ締め</h1>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">読み込み中...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header - hidden when printing */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate("/register")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          レジに戻る
        </Button>
        <h1 className="text-xl font-bold">レジ締め</h1>
      </div>

      {/* 精算状況カード */}
      {summary && (
        <Card className={`print:hidden ${
          summary.allSettled
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-2">
              {summary.allSettled ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              <span className={`font-bold ${
                summary.allSettled ? "text-emerald-800" : "text-amber-800"
              }`}>
                {summary.allSettled
                  ? "全員レジ精算完了"
                  : `未精算: ${summary.unsettledCount}名`}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-emerald-700">精算済み: {summary.settledCount}名</span>
              <span className="text-amber-700">未精算: {summary.unsettledCount}名</span>
              <span className="text-muted-foreground">合計: {summary.totalSettlements}名</span>
            </div>
            {!summary.allSettled && summary.unsettledMembers && summary.unsettledMembers.length > 0 && (
              <div className="mt-2 text-xs text-amber-700">
                未精算: {summary.unsettledMembers.map((m: any) => `${m.memberNumber} ${m.displayName}`).join(", ")}
                {summary.unsettledCount > 10 && ` 他${summary.unsettledCount - 10}名`}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Printable area */}
      <div ref={printRef}>
        {/* Print header - only visible when printing */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-xl font-bold">レジ締めレシート</h1>
          <p className="text-sm text-gray-600">
            {new Date().toLocaleDateString("ja-JP")} {new Date().toLocaleTimeString("ja-JP")}
          </p>
        </div>

        {/* レジ金サマリー */}
        <Card className="print:hidden print:shadow-none print:border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              レジ金サマリー
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">レジ準備金（お釣り用）</span>
                <span className="font-mono font-bold">{fmt(summary?.initialFund ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">お預かり合計（お客様から）</span>
                <span className="font-mono font-bold text-emerald-600">+{fmt(summary?.totalReceived ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">お釣り合計</span>
                <span className="font-mono font-bold text-red-500">-{fmt(summary?.totalChange ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">支払い合計（お客様へ）</span>
                <span className="font-mono font-bold text-red-500">-{fmt(summary?.totalPayments ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center py-3 bg-muted/50 rounded-lg px-3">
                <span className="font-bold">理論残高</span>
                <span className="font-mono font-bold text-xl">{fmt(summary?.theoreticalBalance ?? 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 実際残高入力 */}
        <Card className="print:hidden print:shadow-none print:border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              実際のレジ残高
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="print:hidden">
                <label className="text-sm text-muted-foreground block mb-2">
                  レジの中にある現金の合計を入力してください
                </label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">¥</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={actualBalance}
                    onChange={(e) => setActualBalance(e.target.value.replace(/[^0-9]/g, ""))}
                    className="pl-8 text-right text-xl font-mono font-bold h-14"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* 印刷時の実際残高表示 */}
              <div className="hidden print:block">
                <div className="flex justify-between items-center py-2">
                  <span>実際残高:</span>
                  <span className="font-mono font-bold text-xl">{fmt(actualBalanceNum)}</span>
                </div>
              </div>

              {actualBalance && (
                <div className={`p-4 rounded-lg ${
                  difference === 0
                    ? "bg-emerald-50 border border-emerald-200"
                    : Math.abs(difference) <= 100
                    ? "bg-yellow-50 border border-yellow-200"
                    : "bg-red-50 border border-red-200"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {difference === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    )}
                    <span className="font-bold">
                      {difference === 0 ? "一致" : "差異あり"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">差額:</span>
                    <span className={`font-mono font-bold text-2xl ${
                      difference === 0
                        ? "text-emerald-600"
                        : difference > 0
                        ? "text-blue-600"
                        : "text-red-600"
                    }`}>
                      {fmtSigned(difference)}
                    </span>
                  </div>
                  {difference !== 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {difference > 0 ? "レジに余剰金があります" : "レジに不足金があります"}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 取引一覧 */}
        <Card className="print:shadow-none print:border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              レジ取引一覧（{summary?.transactionCount ?? 0}件）
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(!summary?.transactions || summary.transactions.length === 0) ? (
              <div className="py-8 text-center text-muted-foreground">
                レジ取引記録がありません
              </div>
            ) : (
              <>
                {/* 画面表示用（従来） */}
                <div className="overflow-x-auto print:hidden">
                  <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium">会員番号</th>
                      <th className="text-left px-3 py-2 font-medium">名前</th>
                      <th className="text-right px-3 py-2 font-medium">入金</th>
                      <th className="text-right px-3 py-2 font-medium">預かり</th>
                      <th className="text-right px-3 py-2 font-medium">お釣り</th>
                      <th className="text-right px-3 py-2 font-medium">支払い</th>
                      <th className="text-center px-3 py-2 font-medium">サイン</th>
                      <th className="text-center px-3 py-2 font-medium print:hidden">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.transactions.map((tx: any) => (
                      <tr key={tx.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono">{tx.memberNumber}</td>
                        <td className="px-3 py-2">{tx.memberName}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {tx.depositAmount > 0 ? fmt(tx.depositAmount) : ""}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {tx.receivedAmount > 0 ? fmt(tx.receivedAmount) : ""}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {tx.changeAmount > 0 ? fmt(tx.changeAmount) : ""}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {tx.paymentAmount > 0 ? fmt(tx.paymentAmount) : ""}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {tx.signatureUrl ? (
                            <img
                              src={tx.signatureUrl}
                              alt="サイン"
                              className="h-8 inline-block"
                            />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center print:hidden">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                            onClick={() => setCancelTarget({
                              settlementId: tx.settlementId,
                              memberName: tx.memberName,
                              memberNumber: tx.memberNumber,
                            })}
                            disabled={cancelCompleteMutation.isPending}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            取消
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold bg-muted/30">
                      <td className="px-3 py-2" colSpan={2}>合計</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {summary.totalDeposits > 0 ? fmt(summary.totalDeposits) : ""}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {summary.totalReceived > 0 ? fmt(summary.totalReceived) : ""}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {summary.totalChange > 0 ? fmt(summary.totalChange) : ""}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {summary.totalPayments > 0 ? fmt(summary.totalPayments) : ""}
                      </td>
                      <td></td>
                      <td className="print:hidden"></td>
                    </tr>
                  </tfoot>
                  </table>
                </div>

                {/* 印刷用（A4に収める・2列・入金/支払い/サインのみ） */}
                <div className="hidden print:block px-2 pb-3">
                  <div className="text-sm font-bold mb-2">レジ取引一覧</div>
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 pr-2">会員番号</th>
                        <th className="text-right py-1 pr-2">入金</th>
                        <th className="text-right py-1 pr-2">支払い</th>
                        <th className="text-center py-1 pr-2">サイン</th>
                        <th className="text-left py-1 pr-2 pl-2 border-l border-black">会員番号</th>
                        <th className="text-right py-1 pr-2">入金</th>
                        <th className="text-right py-1 pr-2">支払い</th>
                        <th className="text-center py-1">サイン</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: Math.ceil(summary.transactions.length / 2) }).map((_, i) => {
                        const left = summary.transactions[i * 2];
                        const right = summary.transactions[i * 2 + 1];
                        return (
                          <tr key={i} className="border-b">
                            <td className="py-1 pr-2 font-mono whitespace-nowrap">
                              {left ? String(left.memberNumber) : ""}
                            </td>
                            <td className="text-right py-1 pr-2 font-mono whitespace-nowrap">
                              {left?.depositAmount > 0 ? fmt(left.depositAmount) : ""}
                            </td>
                            <td className="text-right py-1 pr-2 font-mono whitespace-nowrap">
                              {left?.paymentAmount > 0 ? fmt(left.paymentAmount) : ""}
                            </td>
                            <td className="text-center py-1 pr-2">
                              {left?.signatureUrl ? (
                                <img src={left.signatureUrl} alt="サイン" className="h-6 inline-block" />
                              ) : (
                                ""
                              )}
                            </td>
                            <td className="py-1 pr-2 pl-2 font-mono whitespace-nowrap border-l border-black">
                              {right ? String(right.memberNumber) : ""}
                            </td>
                            <td className="text-right py-1 pr-2 font-mono whitespace-nowrap">
                              {right?.depositAmount > 0 ? fmt(right.depositAmount) : ""}
                            </td>
                            <td className="text-right py-1 pr-2 font-mono whitespace-nowrap">
                              {right?.paymentAmount > 0 ? fmt(right.paymentAmount) : ""}
                            </td>
                            <td className="text-center py-1">
                              {right?.signatureUrl ? (
                                <img src={right.signatureUrl} alt="サイン" className="h-6 inline-block" />
                              ) : (
                                ""
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action buttons - hidden when printing */}
      <div className="flex gap-3 justify-center print:hidden">
        <Button variant="outline" onClick={handleBrowserPrint}>
          <Printer className="h-4 w-4 mr-2" />
          印刷
        </Button>
        <Button onClick={handlePrint}>
          <FileText className="h-4 w-4 mr-2" />
          PDF出力
        </Button>
      </div>

      {/* 取り消し確認ダイアログ */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>精算取り消し確認</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{cancelTarget?.memberName}</span>
              （No.{cancelTarget?.memberNumber}）のレジ精算を取り消します。
            </p>
            <p className="text-sm text-muted-foreground">
              レジ取引記録（お預かり・お釣り・サイン）が削除され、レジ画面で再度精算できる状態に戻ります。
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setCancelTarget(null)}>
                キャンセル
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (cancelTarget) {
                    cancelCompleteMutation.mutate({ settlementId: cancelTarget.settlementId });
                  }
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

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          .hidden.print\\:block {
            display: block !important;
          }
          [class*="print:shadow-none"] {
            box-shadow: none !important;
          }
          .border {
            border-color: #ddd !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}
