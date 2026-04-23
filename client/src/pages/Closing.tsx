import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calculator, Lock, Unlock, FileText, RefreshCw, CheckCircle2, UserCheck, Search, Printer } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useEvent } from "@/contexts/EventContext";

type DialogType = "generate" | "finalize" | "resetSettlements" | "reopen" | null;

export default function Closing() {
  const { selectedEventId: globalEventId, selectEvent } = useEvent();
  const selectedEventId = globalEventId ? String(globalEventId) : "";
  const [openDialog, setOpenDialog] = useState<DialogType>(null);
  const [interimDialogOpen, setInterimDialogOpen] = useState(false);
  const [interimSearch, setInterimSearch] = useState("");
  const [interimMemberId, setInterimMemberId] = useState<number | null>(null);
  const [, setLocation] = useLocation();

  const utils = trpc.useUtils();
  const { data: events = [] } = trpc.events.list.useQuery(undefined, { refetchInterval: 10000 });
  const { data: settlements = [], isLoading } = trpc.settlements.list.useQuery(
    { eventId: parseInt(selectedEventId) },
    { enabled: !!selectedEventId, refetchInterval: 5000 }
  );
  const { data: transactions = [] } = trpc.transactions.list.useQuery(
    { eventId: parseInt(selectedEventId) },
    { enabled: !!selectedEventId, refetchInterval: 5000 }
  );
  const { data: allMembers = [] } = trpc.members.list.useQuery(undefined, { refetchInterval: 30000 });

  const selectedEvent = events.find((e) => e.id === parseInt(selectedEventId));

  // ステップ1: 全体精算処理
  const generateMutation = trpc.settlements.generateSettlements.useMutation({
    onSuccess: (data) => {
      utils.settlements.list.invalidate();
      utils.events.list.invalidate();
      setOpenDialog(null);
      const msg = data.skippedInterim > 0
        ? `精算処理が完了しました（${data.memberCount}会員、${data.transactionCount}件、途中精算済み${data.skippedInterim}名を除外）`
        : `精算処理が完了しました（${data.memberCount}会員、${data.transactionCount}件）`;
      toast.success(msg);
    },
    onError: (e) => toast.error(e.message),
  });

  // ステップ2: 最終締め
  const finalizeMutation = trpc.settlements.finalizeEvent.useMutation({
    onSuccess: () => {
      utils.settlements.list.invalidate();
      utils.events.list.invalidate();
      setOpenDialog(null);
      toast.success("最終締めが完了しました。取引はロックされました。");
    },
    onError: (e) => toast.error(e.message),
  });

  // 精算処理を取消す
  const resetMutation = trpc.settlements.resetSettlements.useMutation({
    onSuccess: () => {
      utils.settlements.list.invalidate();
      utils.events.list.invalidate();
      setOpenDialog(null);
      toast.success("精算処理を取消しました。取引の編集が可能です。");
    },
    onError: (e) => toast.error(e.message),
  });

  // 最終締めを取消す
  const reopenMutation = trpc.settlements.reopenEvent.useMutation({
    onSuccess: () => {
      utils.settlements.list.invalidate();
      utils.events.list.invalidate();
      setOpenDialog(null);
      toast.success("最終締めを取消しました。精算処理済みの状態に戻りました。");
    },
    onError: (e) => toast.error(e.message),
  });

  // 途中個別精算
  const interimMutation = trpc.settlements.generateInterimSettlement.useMutation({
    onSuccess: () => {
      utils.settlements.list.invalidate();
      setInterimDialogOpen(false);
      setInterimMemberId(null);
      setInterimSearch("");
      toast.success("途中精算書を生成しました。レジ画面で精算処理を行ってください。");
    },
    onError: (e) => toast.error(e.message),
  });

  const txSummary = useMemo(() => {
    const total = transactions.reduce((s, t) => s + t.totalPrice, 0);
    return { count: transactions.length, total };
  }, [transactions]);

  // 途中精算対象の会員を検索（取引がある会員のみ）
  const memberIdsInTxns = useMemo(() => {
    const ids = new Set<number>();
    transactions.forEach(t => {
      ids.add(t.sellerMemberId);
      ids.add(t.buyerMemberId);
    });
    return ids;
  }, [transactions]);

  // 既に精算済みの会員ID
  const settledMemberIds = useMemo(() => {
    return new Set(settlements.filter((s: any) => s.isSettled).map((s: any) => s.memberId));
  }, [settlements]);

  // 途中精算ダイアログ用の会員リスト
  const interimCandidates = useMemo(() => {
    return allMembers
      .filter(m => memberIdsInTxns.has(m.id) && !settledMemberIds.has(m.id))
      .filter(m => {
        if (!interimSearch) return true;
        const q = interimSearch.toLowerCase();
        return (
          String(m.memberNumber).includes(q) ||
          m.displayName.toLowerCase().includes(q) ||
          (m.tradeName && m.tradeName.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.memberNumber - b.memberNumber);
  }, [allMembers, memberIdsInTxns, settledMemberIds, interimSearch]);

  const statusLabel = (status: string) => {
    switch (status) {
      case "open": return "オープン";
      case "settled": return "精算処理済み";
      case "closed": return "最終締め済み";
      default: return status;
    }
  };

  const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "open": return "default";
      case "settled": return "outline";
      case "closed": return "secondary";
      default: return "default";
    }
  };

  // 途中精算済みの件数
  const interimSettledCount = settlements.filter((s: any) => s.settlementType === "interim" && s.isSettled).length;
  const interimPendingCount = settlements.filter((s: any) => s.settlementType === "interim" && !s.isSettled).length;

  // 全員精算完了チェック（レジ締め完了判定）
  const totalSettlements = settlements.length;
  const settledSettlements = settlements.filter((s: any) => s.isSettled).length;
  const unsettledSettlements = totalSettlements - settledSettlements;
  const allSettled = totalSettlements > 0 && unsettledSettlements === 0;

  // 印刷機能
  const handlePrintClosing = () => {
    window.print();
  };

  const printRows = useMemo(() => {
    const rows = settlements.map((s: any) => {
      const salesCommissionWithTax = s.salesCommission + Math.round(s.salesCommission * 0.1);
      const purchaseCommissionWithTax = s.purchaseCommission + Math.round(s.purchaseCommission * 0.1);
      return {
        memberNumber: s.member?.memberNumber ?? 0,
        memberName: s.member?.displayName ?? "-",
        salesTotal: s.salesTotal ?? 0,
        salesCommissionWithTax,
        purchaseTotal: s.purchaseTotal ?? 0,
        purchaseCommissionWithTax,
      };
    }).sort((a, b) => a.memberNumber - b.memberNumber);

    const totals = rows.reduce(
      (acc, r) => {
        acc.salesTotal += r.salesTotal;
        acc.salesCommissionWithTax += r.salesCommissionWithTax;
        acc.purchaseTotal += r.purchaseTotal;
        acc.purchaseCommissionWithTax += r.purchaseCommissionWithTax;
        return acc;
      },
      { salesTotal: 0, salesCommissionWithTax: 0, purchaseTotal: 0, purchaseCommissionWithTax: 0 }
    );

    return { rows, totals };
  }, [settlements]);

  return (
    <div className="space-y-4">
      {/* Print-only (A4) */}
      <div className="hidden print:block">
        <div className="text-center mb-4">
          <div className="text-lg font-bold">締め処理 印刷</div>
          <div className="text-sm text-muted-foreground">
            {selectedEvent?.eventDate ?? ""} {selectedEvent?.title ?? ""}
          </div>
          <div className="text-xs text-muted-foreground">
            出力日時: {new Date().toLocaleString("ja-JP")}
          </div>
        </div>

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-2 py-1 font-medium">会員番号</th>
                <th className="text-left px-2 py-1 font-medium">会員名</th>
                <th className="text-right px-2 py-1 font-medium">売合計</th>
                <th className="text-right px-2 py-1 font-medium">売手数料（税込）</th>
                <th className="text-right px-2 py-1 font-medium">買合計</th>
                <th className="text-right px-2 py-1 font-medium">買手数料（税込）</th>
              </tr>
            </thead>
            <tbody>
              {printRows.rows.map((r) => (
                <tr key={r.memberNumber} className="border-b">
                  <td className="px-2 py-1 font-mono">{r.memberNumber}</td>
                  <td className="px-2 py-1">{r.memberName}</td>
                  <td className="px-2 py-1 text-right font-mono">¥{r.salesTotal.toLocaleString()}</td>
                  <td className="px-2 py-1 text-right font-mono">¥{r.salesCommissionWithTax.toLocaleString()}</td>
                  <td className="px-2 py-1 text-right font-mono">¥{r.purchaseTotal.toLocaleString()}</td>
                  <td className="px-2 py-1 text-right font-mono">¥{r.purchaseCommissionWithTax.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold bg-muted/30">
                <td className="px-2 py-1" colSpan={2}>合計</td>
                <td className="px-2 py-1 text-right font-mono">¥{printRows.totals.salesTotal.toLocaleString()}</td>
                <td className="px-2 py-1 text-right font-mono">¥{printRows.totals.salesCommissionWithTax.toLocaleString()}</td>
                <td className="px-2 py-1 text-right font-mono">¥{printRows.totals.purchaseTotal.toLocaleString()}</td>
                <td className="px-2 py-1 text-right font-mono">¥{printRows.totals.purchaseCommissionWithTax.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-2 flex justify-end text-[10px] font-bold">
          <div className="px-2 py-1 border rounded-md">
            売手数料合計＋買手数料合計（税込）:{" "}
            <span className="font-mono">
              ¥{(printRows.totals.salesCommissionWithTax + printRows.totals.purchaseCommissionWithTax).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="print:hidden">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">締め処理</h1>
          <p className="text-muted-foreground mt-1">
            途中個別精算 → 全体精算（精算書生成）→ 最終締め（取引ロック）
          </p>
        </div>
        <select
          value={selectedEventId}
          onChange={(e) => selectEvent(e.target.value ? parseInt(e.target.value) : null)}
          className="w-[260px] h-9 px-3 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">イベントを選択...</option>
          {events.map((ev) => (
            <option key={ev.id} value={String(ev.id)}>
              {ev.eventDate} {ev.title ?? ""} [{statusLabel(ev.status)}]
            </option>
          ))}
        </select>
      </div>

      {selectedEventId && selectedEvent ? (
        <>
          {/* Event Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                {selectedEvent.eventDate} {selectedEvent.title ?? ""}
                <Badge variant={statusVariant(selectedEvent.status)} className="ml-2">
                  {statusLabel(selectedEvent.status)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                <div>
                  <div className="text-sm text-muted-foreground">取引件数</div>
                  <div className="text-xl font-bold">{txSummary.count}件</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">取引総額</div>
                  <div className="text-xl font-bold">¥{txSummary.total.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">精算会員数</div>
                  <div className="text-xl font-bold">{settlements.length}名</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">途中精算済み</div>
                  <div className="text-xl font-bold text-blue-600">{interimSettledCount}名</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">ステータス</div>
                  <div className="text-xl font-bold">{statusLabel(selectedEvent.status)}</div>
                </div>
              </div>

              {/* ステップ表示 */}
              <div className="flex items-center gap-2 mb-6 p-3 bg-muted/50 rounded-lg">
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  selectedEvent.status === "open" ? "text-primary" : "text-muted-foreground"
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    selectedEvent.status === "open" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/30 text-muted-foreground"
                  }`}>1</div>
                  取引入力
                </div>
                <div className="flex-1 h-px bg-border" />
                <div className="flex items-center gap-1 text-sm font-medium text-blue-600">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-blue-600 text-white">
                    ↔
                  </div>
                  途中精算
                </div>
                <div className="flex-1 h-px bg-border" />
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  selectedEvent.status === "settled" ? "text-primary" : "text-muted-foreground"
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    selectedEvent.status === "settled" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/30 text-muted-foreground"
                  }`}>2</div>
                  全体精算
                </div>
                <div className="flex-1 h-px bg-border" />
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  selectedEvent.status === "closed" ? "text-primary" : "text-muted-foreground"
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    selectedEvent.status === "closed" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/30 text-muted-foreground"
                  }`}>3</div>
                  最終締め
                </div>
              </div>

              {/* レジ精算状況（settled状態のとき表示） */}
              {selectedEvent.status === "settled" && totalSettlements > 0 && (
                <div className={`mb-4 p-4 rounded-lg border ${
                  allSettled
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-amber-50 border-amber-200"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {allSettled ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Calculator className="h-5 w-5 text-amber-600" />
                    )}
                    <span className={`font-bold ${
                      allSettled ? "text-emerald-800" : "text-amber-800"
                    }`}>
                      {allSettled
                        ? "レジ精算完了 - 最終締めが可能です"
                        : `レジ精算未完了 - 残り${unsettledSettlements}名`}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-emerald-700">精算済み: {settledSettlements}名</span>
                    <span className="text-amber-700">未精算: {unsettledSettlements}名</span>
                    <span className="text-muted-foreground">合計: {totalSettlements}名</span>
                  </div>
                  {!allSettled && (
                    <p className="text-xs text-amber-700 mt-2">
                      全員のレジ精算を完了してから最終締めを実行してください。
                    </p>
                  )}
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex flex-wrap gap-2 print:hidden">
                {/* 途中個別精算ボタン（openまたはsettledの時に使用可能） */}
                {selectedEvent.status !== "closed" && (
                  <Button
                    variant="outline"
                    className="border-blue-500 text-blue-600 hover:bg-blue-50"
                    onClick={() => setInterimDialogOpen(true)}
                    disabled={txSummary.count === 0}
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    途中個別精算
                  </Button>
                )}

                {selectedEvent.status === "open" && (
                  <>
                    <Button onClick={() => setOpenDialog("generate")} disabled={generateMutation.isPending || txSummary.count === 0}>
                      <Calculator className="h-4 w-4 mr-2" />
                      全体精算処理を実行
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLocation(`/transactions?eventId=${selectedEventId}`)}
                    >
                      取引入力へ
                    </Button>
                  </>
                )}

                {selectedEvent.status === "settled" && (
                  <>
                    <Button
                      onClick={() => setOpenDialog("finalize")}
                      disabled={finalizeMutation.isPending || !allSettled}
                      title={!allSettled ? `未精算: ${unsettledSettlements}名 - 全員のレジ精算を完了してください` : ""}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      最終締めを実行
                      {!allSettled && (
                        <Badge variant="destructive" className="ml-2 text-xs px-1.5 py-0">
                          未精算{unsettledSettlements}
                        </Badge>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => setOpenDialog("generate")} disabled={generateMutation.isPending}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      精算を再計算
                    </Button>
                    <Button variant="outline" onClick={() => setOpenDialog("resetSettlements")} disabled={resetMutation.isPending}>
                      <Unlock className="h-4 w-4 mr-2" />
                      精算処理を取消す
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLocation(`/settlements?eventId=${selectedEventId}`)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      精算書一覧へ
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLocation(`/transactions?eventId=${selectedEventId}`)}
                    >
                      取引入力へ
                    </Button>
                  </>
                )}

                {selectedEvent.status === "closed" && (
                  <>
                    <Button variant="outline" onClick={handlePrintClosing}>
                      <Printer className="h-4 w-4 mr-2" />
                      締め処理を印刷
                    </Button>
                    <Button variant="outline" onClick={() => setOpenDialog("reopen")} disabled={reopenMutation.isPending}>
                      <Unlock className="h-4 w-4 mr-2" />
                      最終締めを取消す
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLocation(`/settlements?eventId=${selectedEventId}`)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      精算書一覧へ
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Settlement List */}
          {settlements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  精算データ一覧
                  {selectedEvent.status === "settled" && (
                    <Badge variant="outline" className="ml-2 text-amber-600 border-amber-600">
                      取引編集可能
                    </Badge>
                  )}
                  {selectedEvent.status === "closed" && (
                    <Badge variant="secondary" className="ml-2">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      確定済み
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>会員番号</TableHead>
                        <TableHead>会員名</TableHead>
                        <TableHead>種別</TableHead>
                        <TableHead className="text-right">売合計</TableHead>
                        <TableHead className="text-right">売手数料(税込)</TableHead>
                        <TableHead className="text-right">買合計</TableHead>
                        <TableHead className="text-right">買手数料(税込)</TableHead>
                        <TableHead className="text-right">参加費</TableHead>
                        <TableHead className="text-right font-bold">精算額</TableHead>
                        <TableHead>状態</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settlements.map((s: any) => (
                        <TableRow key={s.id} className={s.isSettled ? "bg-green-50/50" : ""}>
                          <TableCell className="font-mono">{s.member?.memberNumber ?? "-"}</TableCell>
                          <TableCell>{s.member?.displayName ?? "-"}</TableCell>
                          <TableCell>
                            {s.settlementType === "interim" ? (
                              <Badge variant="outline" className="text-blue-600 border-blue-500 text-xs">途中</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">全体</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">¥{s.salesTotal.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-muted-foreground">¥{(s.salesCommission + Math.round(s.salesCommission * 0.1)).toLocaleString()}</TableCell>
                          <TableCell className="text-right">¥{s.purchaseTotal.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-muted-foreground">¥{(s.purchaseCommission + Math.round(s.purchaseCommission * 0.1)).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {s.participationFee > 0 ? (
                              <span className="text-red-500">¥{s.participationFee.toLocaleString()} 精算書にて差引</span>
                            ) : (
                              <span className="text-green-600">受付時に領収済み</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            <span className={s.settlementAmount >= 0 ? "text-emerald-600" : "text-red-600"}>
                              ¥{s.settlementAmount.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            {s.isSettled ? (
                              <Badge className="bg-green-600 text-xs">精算済</Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-500 text-xs">未精算</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/settlements/${s.id}`)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── 途中個別精算ダイアログ ─── */}
          <Dialog open={interimDialogOpen} onOpenChange={(o) => { if (!o) { setInterimDialogOpen(false); setInterimMemberId(null); setInterimSearch(""); } }}>
            <DialogContent className="max-w-lg max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  途中個別精算
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                精算したい会員を選択してください。取引のある会員のみ表示されます。
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="番号または名前で検索..."
                  value={interimSearch}
                  onChange={(e) => setInterimSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="overflow-y-auto max-h-[40vh] border rounded-md">
                {interimCandidates.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    {interimSearch ? "該当する会員が見つかりません" : "精算可能な会員がいません"}
                  </div>
                ) : (
                  interimCandidates.map(m => (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-accent border-b last:border-b-0 ${
                        interimMemberId === m.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                      }`}
                      onClick={() => setInterimMemberId(m.id)}
                    >
                      <div>
                        <span className="font-mono font-bold mr-2">{m.memberNumber}</span>
                        <span>{m.displayName}</span>
                        {m.tradeName && <span className="text-muted-foreground ml-2 text-sm">({m.tradeName})</span>}
                      </div>
                      {interimMemberId === m.id && (
                        <CheckCircle2 className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  ))
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setInterimDialogOpen(false); setInterimMemberId(null); setInterimSearch(""); }}>
                  キャンセル
                </Button>
                <Button
                  disabled={!interimMemberId || interimMutation.isPending}
                  onClick={() => {
                    if (interimMemberId) {
                      interimMutation.mutate({
                        eventId: parseInt(selectedEventId),
                        memberId: interimMemberId,
                      });
                    }
                  }}
                >
                  {interimMutation.isPending ? "処理中..." : "精算書を生成"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ─── 全体精算処理 確認ダイアログ ─── */}
          <AlertDialog open={openDialog === "generate"} onOpenChange={(o) => !o && setOpenDialog(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>全体精算処理を実行しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  {selectedEvent.eventDate}の全取引({txSummary.count}件)を集計し、精算書を生成します。
                  <br /><br />
                  {interimSettledCount > 0 && (
                    <>
                      <strong className="text-blue-600">途中精算済みの{interimSettledCount}名は除外されます。</strong>
                      <br /><br />
                    </>
                  )}
                  <strong>精算処理後も取引の追加・編集・削除は可能です。</strong>
                  取引を修正した場合は「精算を再計算」で精算書を更新できます。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => generateMutation.mutate({ eventId: parseInt(selectedEventId) })}
                >
                  実行
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* ─── 最終締め 確認ダイアログ ─── */}
          <AlertDialog open={openDialog === "finalize"} onOpenChange={(o) => !o && setOpenDialog(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>最終締めを実行しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  {selectedEvent.eventDate}の取引をロックし、確定します。
                  <br /><br />
                  <span className="text-emerald-600 font-medium">全員のレジ精算が完了しています（{settledSettlements}/{totalSettlements}名）。</span>
                  <br /><br />
                  <strong className="text-red-600">最終締め後は取引の追加・編集・削除ができなくなります。</strong>
                  必要に応じて「最終締めを取消す」で精算処理済みの状態に戻せます。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => finalizeMutation.mutate({ eventId: parseInt(selectedEventId) })}
                  className="bg-red-600 hover:bg-red-700"
                >
                  最終締めを実行
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* ─── 精算処理取消し 確認ダイアログ ─── */}
          <AlertDialog open={openDialog === "resetSettlements"} onOpenChange={(o) => !o && setOpenDialog(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>精算処理を取消しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  精算データが削除され、オープン状態に戻ります。取引データはそのまま残ります。
                  {interimSettledCount > 0 && (
                    <>
                      <br /><br />
                      <strong className="text-red-600">途中精算済みの{interimSettledCount}名の精算データも削除されます。</strong>
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => resetMutation.mutate({ eventId: parseInt(selectedEventId) })}
                >
                  取消す
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* ─── 最終締め取消し 確認ダイアログ ─── */}
          <AlertDialog open={openDialog === "reopen"} onOpenChange={(o) => !o && setOpenDialog(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>最終締めを取消しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  精算処理済みの状態に戻り、取引の編集や精算の再計算が可能になります。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => reopenMutation.mutate({ eventId: parseInt(selectedEventId) })}
                >
                  取消す
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            イベントを選択してください
          </CardContent>
        </Card>
      )}
      </div>
      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          nav, header, aside, [data-sidebar] {
            display: none !important;
          }
          main {
            margin: 0 !important;
            padding: 0 !important;
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
