import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useEvent } from "@/contexts/EventContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Search, UserCheck, UserPlus, Users, RefreshCw, Printer, X, ShieldCheck, Minus, Plus, Banknote, Hash, Type, CircleCheck, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function Reception() {
  const { selectedEventId } = useEvent();
  const [search, setSearch] = useState("");
  const [initConfirm, setInitConfirm] = useState(false);
  const [showAddMode, setShowAddMode] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  // 検索入力モード: "number" = 数字キーパッド, "text" = 文字入力
  const [addSearchMode, setAddSearchMode] = useState<"number" | "text">("number");
  const [autoCollect, setAutoCollect] = useState(true); // 受付と同時に徴収済み
  const addSearchRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: event } = trpc.events.getById.useQuery(
    { id: selectedEventId! },
    { enabled: !!selectedEventId, refetchInterval: 10000 }
  );
  const { data: attendance = [], isLoading } = trpc.events.listAttendance.useQuery(
    { eventId: selectedEventId! },
    { enabled: !!selectedEventId, refetchInterval: 5000 }
  );
  const { data: allMembers = [] } = trpc.members.list.useQuery(
    { activeOnly: true },
    { refetchInterval: 30000 }
  );

  // イベントが変わったら検索をリセット
  useEffect(() => {
    setSearch("");
    setShowAddMode(false);
    setAddSearch("");
  }, [selectedEventId]);

  const initMutation = trpc.events.initAttendance.useMutation({
    onSuccess: (data) => {
      utils.events.listAttendance.invalidate({ eventId: selectedEventId! });
      toast.success(`出欠データを初期化しました（新規: ${data.initialized}名）`);
      setInitConfirm(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const checkInMutation = trpc.events.checkIn.useMutation({
    onMutate: async ({ memberId, isPresent, isFeeExempt, autoCollect: ac }) => {
      await utils.events.listAttendance.cancel({ eventId: selectedEventId! });
      const prev = utils.events.listAttendance.getData({ eventId: selectedEventId! });
      utils.events.listAttendance.setData({ eventId: selectedEventId! }, (old) =>
        old?.map((a) =>
          a.memberId === memberId
            ? {
                ...a,
                isPresent,
                isFeeExempt: isFeeExempt ?? a.isFeeExempt,
                checkedInAt: isPresent ? new Date() : null,
                feeCollected: (isPresent && ac) ? true : (a as any).feeCollected,
              }
            : a
        )
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) {
        utils.events.listAttendance.setData({ eventId: selectedEventId! }, ctx.prev);
      }
      toast.error(e.message);
    },
    onSettled: () => {
      utils.events.listAttendance.invalidate({ eventId: selectedEventId! });
    },
  });

  const feeExemptMutation = trpc.events.toggleFeeExempt.useMutation({
    onMutate: async ({ memberId, isFeeExempt }) => {
      await utils.events.listAttendance.cancel({ eventId: selectedEventId! });
      const prev = utils.events.listAttendance.getData({ eventId: selectedEventId! });
      utils.events.listAttendance.setData({ eventId: selectedEventId! }, (old) =>
        old?.map((a) =>
          a.memberId === memberId ? { ...a, isFeeExempt } : a
        )
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) {
        utils.events.listAttendance.setData({ eventId: selectedEventId! }, ctx.prev);
      }
      toast.error(e.message);
    },
    onSettled: () => {
      utils.events.listAttendance.invalidate({ eventId: selectedEventId! });
    },
  });

  const feeCollectedMutation = trpc.events.toggleFeeCollected.useMutation({
    onMutate: async ({ memberId, feeCollected }: { memberId: number; feeCollected: boolean }) => {
      await utils.events.listAttendance.cancel({ eventId: selectedEventId! });
      const prev = utils.events.listAttendance.getData({ eventId: selectedEventId! });
      utils.events.listAttendance.setData({ eventId: selectedEventId! }, (old) =>
        old?.map((a) =>
          a.memberId === memberId ? { ...a, feeCollected } : a
        )
      );
      return { prev };
    },
    onError: (e: any, _v: any, ctx: any) => {
      if (ctx?.prev) {
        utils.events.listAttendance.setData({ eventId: selectedEventId! }, ctx.prev);
      }
      toast.error(e.message);
    },
    onSettled: () => {
      utils.events.listAttendance.invalidate({ eventId: selectedEventId! });
    },
  });

  const companionMutation = trpc.events.updateCompanionCount.useMutation({
    onMutate: async ({ memberId, companionCount }: { memberId: number; companionCount: number }) => {
      await utils.events.listAttendance.cancel({ eventId: selectedEventId! });
      const prev = utils.events.listAttendance.getData({ eventId: selectedEventId! });
      utils.events.listAttendance.setData({ eventId: selectedEventId! }, (old) =>
        old?.map((a) =>
          a.memberId === memberId ? { ...a, companionCount } : a
        )
      );
      return { prev };
    },
    onError: (e: any, _v: any, ctx: any) => {
      if (ctx?.prev) {
        utils.events.listAttendance.setData({ eventId: selectedEventId! }, ctx.prev);
      }
      toast.error(e.message);
    },
    onSettled: () => {
      utils.events.listAttendance.invalidate({ eventId: selectedEventId! });
    },
  });

  // 受付完了者のみ（出席者）
  const presentMembers = useMemo(() => {
    return [...attendance]
      .filter((a) => a.isPresent)
      .sort((a, b) => (a.member?.memberNumber ?? 0) - (b.member?.memberNumber ?? 0));
  }, [attendance]);

  // 受付完了者の検索フィルタ
  const filteredPresent = useMemo(() => {
    if (!search.trim()) return presentMembers;
    const q = search.trim().toLowerCase();
    return presentMembers.filter((a) => {
      const m = a.member;
      if (!m) return false;
      return (
        String(m.memberNumber).includes(q) ||
        m.displayName.toLowerCase().includes(q) ||
        (m.tradeName ?? "").toLowerCase().includes(q)
      );
    });
  }, [presentMembers, search]);

  // 未受付の会員一覧（受付追加用）
  const presentMemberIds = useMemo(() => new Set(attendance.filter((a) => a.isPresent).map((a) => a.memberId)), [attendance]);
  const attendanceMemberIds = useMemo(() => new Set(attendance.map((a) => a.memberId)), [attendance]);

  const unregisteredMembers = useMemo(() => {
    if (!addSearch.trim()) return [];
    const q = addSearch.trim().toLowerCase();
    return allMembers.filter((m) => {
      if (presentMemberIds.has(m.id)) return false; // 既に受付済み
      return (
        String(m.memberNumber).includes(q) ||
        m.displayName.toLowerCase().includes(q) ||
        (m.tradeName ?? "").toLowerCase().includes(q)
      );
    }).slice(0, 20); // 最大20件表示
  }, [allMembers, presentMemberIds, addSearch]);

  const presentCount = presentMembers.length;
  const feeExemptCount = presentMembers.filter((a) => (a as any).isFeeExempt).length;
  const totalCount = attendance.length;

  // 同伴者の合計人数
  const totalCompanionCount = useMemo(() => {
    return presentMembers.reduce((sum, a) => sum + ((a as any).companionCount ?? 0), 0);
  }, [presentMembers]);

  // 受付合計金額の計算
  const receptionSummary = useMemo(() => {
    const participationFee = event?.participationFee ?? 0;
    const companionFee = event?.companionFee ?? 0;

    let totalPersons = 0;
    let totalAmount = 0;
    let collectedCount = 0;
    let uncollectedCount = 0;
    let collectedAmount = 0;
    let uncollectedAmount = 0;

    presentMembers.forEach((a) => {
      const exempt = (a as any).isFeeExempt ?? false;
      const companions = (a as any).companionCount ?? 0;
      const collected = (a as any).feeCollected ?? false;

      totalPersons += 1;
      let memberAmount = 0;
      if (!exempt) {
        memberAmount += participationFee;
      }
      memberAmount += companions * companionFee;

      totalPersons += companions;
      totalAmount += memberAmount;

      if (exempt) {
        // 免除者は同伴者料金のみ
        if (memberAmount === 0) {
          collectedCount++; // 徴収不要なので徴収済み扱い
        } else if (collected) {
          collectedCount++;
          collectedAmount += memberAmount;
        } else {
          uncollectedCount++;
          uncollectedAmount += memberAmount;
        }
      } else if (collected) {
        collectedCount++;
        collectedAmount += memberAmount;
      } else {
        uncollectedCount++;
        uncollectedAmount += memberAmount;
      }
    });

    return { totalPersons, totalAmount, participationFee, companionFee, collectedCount, uncollectedCount, collectedAmount, uncollectedAmount };
  }, [presentMembers, event]);

  // 受付処理
  const handleQuickCheckIn = useCallback((memberId: number, isFeeExempt: boolean = false) => {
    if (!attendanceMemberIds.has(memberId)) {
      toast.error("先に「出欠データ初期化」を実行してください");
      return;
    }
    checkInMutation.mutate({
      eventId: selectedEventId!,
      memberId,
      isPresent: true,
      isFeeExempt,
      autoCollect,
    });
    setAddSearch("");
    const msgs = [isFeeExempt ? "受付完了（参加費免除）" : "受付完了"];
    if (autoCollect && !isFeeExempt) msgs.push("徴収済み");
    toast.success(msgs.join("・"));
    // 受付後にフォーカスを戻す
    setTimeout(() => addSearchRef.current?.focus(), 100);
  }, [attendanceMemberIds, checkInMutation, selectedEventId, autoCollect]);

  // 参加費免除トグル
  const handleToggleFeeExempt = useCallback((memberId: number, currentExempt: boolean) => {
    feeExemptMutation.mutate({
      eventId: selectedEventId!,
      memberId,
      isFeeExempt: !currentExempt,
    });
    toast.success(!currentExempt ? "参加費免除に設定しました" : "参加費免除を解除しました");
  }, [feeExemptMutation, selectedEventId]);

  // 徴収済みトグル
  const handleToggleFeeCollected = useCallback((memberId: number, currentCollected: boolean) => {
    feeCollectedMutation.mutate({
      eventId: selectedEventId!,
      memberId,
      feeCollected: !currentCollected,
    });
    toast.success(!currentCollected ? "徴収済みにしました" : "未徴収に戻しました");
  }, [feeCollectedMutation, selectedEventId]);

  // 同伴者人数変更
  const handleCompanionChange = useCallback((memberId: number, newCount: number) => {
    if (newCount < 0) return;
    companionMutation.mutate({
      eventId: selectedEventId!,
      memberId,
      companionCount: newCount,
    });
  }, [companionMutation, selectedEventId]);

  // 検索モード切替
  const toggleSearchMode = useCallback(() => {
    setAddSearchMode((prev) => prev === "number" ? "text" : "number");
    setAddSearch("");
    setTimeout(() => addSearchRef.current?.focus(), 50);
  }, []);

  // Print attendance list
  const printAttendance = () => {
    const participationFee = event?.participationFee ?? 0;
    const companionFeePerPerson = event?.companionFee ?? 0;

    let rows = "";
    let grandTotalPersons = 0;
    let grandTotalAmount = 0;

    presentMembers.forEach((a, idx) => {
      const m = a.member;
      if (!m) return;
      const exempt = (a as any).isFeeExempt ?? false;
      const companions = (a as any).companionCount ?? 0;

      const personCount = 1 + companions;
      const memberFee = exempt ? 0 : participationFee;
      const companionTotal = companions * companionFeePerPerson;
      const rowAmount = memberFee + companionTotal;

      grandTotalPersons += personCount;
      grandTotalAmount += rowAmount;

      const bgColor = idx % 2 === 0 ? "#fff" : "#f9f9f9";
      rows += `<tr style="background:${bgColor};">
        <td class="c num">${m.memberNumber}</td>
        <td class="l">${m.tradeName ?? m.displayName}</td>
        <td class="c">${personCount}</td>
        <td class="r">¥${rowAmount.toLocaleString()}</td>
      </tr>`;
    });

    rows += `<tr class="total-row">
      <td class="c" colspan="2" style="font-weight:bold;">合計</td>
      <td class="c" style="font-weight:bold;">${grandTotalPersons}</td>
      <td class="r" style="font-weight:bold;">¥${grandTotalAmount.toLocaleString()}</td>
    </tr>`;

    const html = `<!DOCTYPE html><html><head><title>出席者一覧</title>
      <style>
        @media print {
          body { margin: 0; }
          @page { size: A4 portrait; margin: 10mm 10mm 10mm 10mm; }
        }
        body {
          font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
          font-size: 11px;
          color: #222;
          max-width: 190mm;
          margin: 0 auto;
        }
        h2 { text-align: center; font-size: 16px; margin: 8px 0 4px; }
        .summary { text-align: center; font-size: 11px; color: #555; margin-bottom: 6px; }
        .summary-detail { text-align: center; font-size: 10px; color: #666; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #f0f0f0; border: 1px solid #ccc; padding: 3px 4px; font-size: 9px; }
        td { border: 1px solid #ddd; padding: 2px 4px; }
        .c { text-align: center; }
        .l { text-align: left; }
        .r { text-align: right; }
        .num { font-family: monospace; }
        .total-row td { border-top: 2px solid #333; background: #f5f5f5; }
        .footer { text-align: right; font-size: 8px; color: #999; margin-top: 6px; }
      </style></head><body>
      <h2>${event?.eventDate ?? ""} ${event?.title ?? ""} 出席者一覧</h2>
      <div class="summary">出席者: ${presentCount}名 / 同伴者: ${totalCompanionCount}名 / 合計: ${receptionSummary.totalPersons}名</div>
      <div class="summary-detail">
        参加費: ¥${participationFee.toLocaleString()}/人　同伴者料金: ¥${companionFeePerPerson.toLocaleString()}/人　
        徴収合計: ¥${receptionSummary.totalAmount.toLocaleString()}　<span style="color:#888;font-size:10px;">※ 事前徴収済（精算書には含まれません）</span>
      </div>
      <table>
        <thead><tr><th style="width:50px;">番号</th><th>屋号</th><th style="width:60px;">人数</th><th style="width:80px;">金額</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">印刷日: ${new Date().toLocaleDateString("ja-JP")} ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</div>
    </body></html>`;

    const iframe = document.getElementById("print-frame") as HTMLIFrameElement | null;
    if (iframe) {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(() => iframe.contentWindow?.print(), 300);
      }
    }
  };

  if (!selectedEventId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">ダッシュボードでイベントを選択してください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 portrait:space-y-3">
      <iframe id="print-frame" style={{ display: "none" }} />

      {/* Header - タブレット縦画面ではコンパクトに */}
      <div className="flex items-start justify-between flex-wrap gap-2 portrait:gap-1">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight portrait:text-lg">受付・出欠管理</h1>
          {event && (
            <p className="text-muted-foreground mt-1 portrait:mt-0 portrait:text-[11px] text-sm">
              <span className="font-medium">{event.eventDate} {event.title ?? ""}</span>
              <span className="landscape:inline portrait:block portrait:mt-0.5">
                <span className="landscape:ml-3">
                  参加費: ¥{(event.participationFee ?? 0).toLocaleString()}/人　
                  同伴者: ¥{(event.companionFee ?? 0).toLocaleString()}/人　
                  <span className="text-muted-foreground">(事前徴収)</span>
                </span>
              </span>
            </p>
          )}
        </div>
        {/* PC/横画面: 通常ボタン配置 */}
        <div className="flex gap-2 portrait:hidden">
          <Button variant="outline" onClick={printAttendance}>
            <Printer className="h-4 w-4 mr-2" />
            出席者一覧印刷
          </Button>
          <Button variant="outline" onClick={() => setShowAddMode(!showAddMode)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {showAddMode ? "受付追加を閉じる" : "受付追加"}
          </Button>
          <Button onClick={() => setInitConfirm(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            出欠データ初期化
          </Button>
        </div>
        {/* タブレット縦画面: コンパクトボタン */}
        <div className="hidden portrait:flex gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={printAttendance}>
            <Printer className="h-3.5 w-3.5 mr-1" />
            印刷
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setShowAddMode(!showAddMode)}>
            <UserPlus className="h-3.5 w-3.5 mr-1" />
            {showAddMode ? "閉じる" : "受付追加"}
          </Button>
          <Button size="sm" className="h-8 px-2 text-xs" onClick={() => setInitConfirm(true)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            初期化
          </Button>
        </div>
      </div>

      {/* Stats - タブレット縦画面では2x3グリッドでコンパクトに */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 portrait:gap-2">
        <Card className="portrait:shadow-sm">
          <CardContent className="pt-3 pb-3 portrait:pt-2 portrait:pb-2 flex items-center gap-2 portrait:gap-1.5">
            <UserCheck className="h-8 w-8 portrait:h-6 portrait:w-6 text-green-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl portrait:text-xl font-bold text-green-600">{presentCount}</p>
              <p className="text-xs portrait:text-[10px] text-muted-foreground truncate">出席者数</p>
            </div>
          </CardContent>
        </Card>
        <Card className="portrait:shadow-sm">
          <CardContent className="pt-3 pb-3 portrait:pt-2 portrait:pb-2 flex items-center gap-2 portrait:gap-1.5">
            <Users className="h-8 w-8 portrait:h-6 portrait:w-6 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl portrait:text-xl font-bold text-blue-600">{totalCompanionCount}</p>
              <p className="text-xs portrait:text-[10px] text-muted-foreground truncate">同伴者数</p>
            </div>
          </CardContent>
        </Card>
        <Card className="portrait:shadow-sm">
          <CardContent className="pt-3 pb-3 portrait:pt-2 portrait:pb-2 flex items-center gap-2 portrait:gap-1.5">
            <Users className="h-8 w-8 portrait:h-6 portrait:w-6 text-purple-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl portrait:text-xl font-bold text-purple-600">{receptionSummary.totalPersons}</p>
              <p className="text-xs portrait:text-[10px] text-muted-foreground truncate">合計人数</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10 portrait:shadow-sm">
          <CardContent className="pt-3 pb-3 portrait:pt-2 portrait:pb-2 flex items-center gap-2 portrait:gap-1.5">
            <Banknote className="h-8 w-8 portrait:h-6 portrait:w-6 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl portrait:text-xl font-bold text-emerald-600">¥{receptionSummary.totalAmount.toLocaleString()}</p>
              <p className="text-xs portrait:text-[10px] text-muted-foreground truncate">徴収合計</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`portrait:shadow-sm ${receptionSummary.uncollectedCount > 0 ? "border-red-300 bg-red-50/30 dark:bg-red-950/10" : "border-green-300 bg-green-50/30 dark:bg-green-950/10"}`}>
          <CardContent className="pt-3 pb-3 portrait:pt-2 portrait:pb-2 flex items-center gap-2 portrait:gap-1.5">
            {receptionSummary.uncollectedCount > 0 ? (
              <AlertTriangle className="h-8 w-8 portrait:h-6 portrait:w-6 text-red-600 shrink-0" />
            ) : (
              <CircleCheck className="h-8 w-8 portrait:h-6 portrait:w-6 text-green-600 shrink-0" />
            )}
            <div className="min-w-0">
              <p className={`text-2xl portrait:text-xl font-bold ${receptionSummary.uncollectedCount > 0 ? "text-red-600" : "text-green-600"}`}>
                {receptionSummary.collectedCount}/{presentCount}
              </p>
              <p className="text-xs portrait:text-[10px] text-muted-foreground truncate">徴収済み</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 未徴収警告 */}
      {presentCount > 0 && receptionSummary.uncollectedCount > 0 && (
        <Card className="border-red-300 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="pt-3 pb-3 portrait:pt-2 portrait:pb-2">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div className="text-sm font-medium">
                未徴収: {receptionSummary.uncollectedCount}名（¥{receptionSummary.uncollectedAmount.toLocaleString()}）
              </div>
              <div className="text-xs text-red-600/70 dark:text-red-400/70 ml-auto">
                徴収済み: {receptionSummary.collectedCount}名（¥{receptionSummary.collectedAmount.toLocaleString()}）
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 徴収内訳 - タブレット縦画面ではコンパクトに */}
      {presentCount > 0 && (
        <Card className="border-slate-200 portrait:shadow-sm">
          <CardContent className="pt-3 pb-3 portrait:pt-2 portrait:pb-2">
            <div className="flex flex-wrap gap-4 portrait:gap-2 text-sm portrait:text-xs">
              <div>
                <span className="text-muted-foreground">参加費:</span>{" "}
                <span className="font-semibold">{presentCount - feeExemptCount}名 × ¥{(receptionSummary.participationFee).toLocaleString()} = ¥{((presentCount - feeExemptCount) * receptionSummary.participationFee).toLocaleString()}</span>
              </div>
              {feeExemptCount > 0 && (
                <div>
                  <span className="text-amber-600">免除:</span>{" "}
                  <span className="font-semibold text-amber-600">{feeExemptCount}名</span>
                </div>
              )}
              {totalCompanionCount > 0 && (
                <div>
                  <span className="text-muted-foreground">同伴者:</span>{" "}
                  <span className="font-semibold">{totalCompanionCount}名 × ¥{(receptionSummary.companionFee).toLocaleString()} = ¥{(totalCompanionCount * receptionSummary.companionFee).toLocaleString()}</span>
                </div>
              )}
              <div className="ml-auto">
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">※ 参加費・同伴者料金は事前徴収済（精算書には含まれません）</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 受付追加パネル - タブレット縦画面最適化 */}
      {showAddMode && (
        <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10">
          <CardHeader className="pb-2 portrait:pb-1 portrait:pt-3 portrait:px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base portrait:text-sm text-green-700 dark:text-green-400">
                <UserPlus className="h-4 w-4 portrait:h-3.5 portrait:w-3.5 inline mr-1.5" />
                受付追加
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowAddMode(false)} className="portrait:h-7 portrait:w-7 portrait:p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="portrait:px-3 portrait:pb-3">
            {/* 検索入力 + モード切替ボタン */}
            <div className="flex items-center gap-2 mb-3 portrait:mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  ref={addSearchRef}
                  type={addSearchMode === "number" ? "tel" : "text"}
                  inputMode={addSearchMode === "number" ? "numeric" : "text"}
                  pattern={addSearchMode === "number" ? "[0-9]*" : undefined}
                  placeholder={addSearchMode === "number" ? "会員番号で検索..." : "名前で検索..."}
                  className="w-full h-12 portrait:h-14 pl-10 pr-4 text-lg portrait:text-xl border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/60"
                  value={addSearch}
                  onChange={(e) => {
                    if (addSearchMode === "number") {
                      // 数字モードでは数字のみ許可
                      const v = e.target.value.replace(/[^0-9]/g, "");
                      setAddSearch(v);
                    } else {
                      setAddSearch(e.target.value);
                    }
                  }}
                  autoFocus
                />
              </div>
              {/* 入力モード切替ボタン */}
              <button
                type="button"
                onClick={toggleSearchMode}
                className="shrink-0 h-12 portrait:h-14 w-12 portrait:w-14 flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent transition-colors"
                title={addSearchMode === "number" ? "文字入力に切替" : "数字入力に切替"}
              >
                {addSearchMode === "number" ? (
                  <Type className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Hash className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </div>
            {/* 現在の入力モード表示 + 自動徴収トグル */}
            <div className="flex items-center justify-between mb-2 portrait:mb-1.5">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                {addSearchMode === "number" ? (
                  <><Hash className="h-3 w-3" /> 数字入力モード（番号検索）</>
                ) : (
                  <><Type className="h-3 w-3" /> 文字入力モード（名前検索）</>
                )}
                <span className="text-muted-foreground/50 ml-1">タップで切替</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className={`text-xs font-medium ${autoCollect ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                  受付と同時に徴収済み
                </span>
                <Switch
                  checked={autoCollect}
                  onCheckedChange={setAutoCollect}
                  className="data-[state=checked]:bg-green-600"
                />
              </label>
            </div>

            {/* 検索結果 - タブレット縦画面ではタッチしやすい大きなボタン */}
            {addSearch.trim() && (
              <div className="space-y-1 portrait:space-y-0 max-h-[50vh] overflow-y-auto">
                {unregisteredMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">該当する未受付の会員が見つかりません</p>
                ) : (
                  unregisteredMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between px-3 py-2 portrait:py-3 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors portrait:border-b portrait:border-green-100 portrait:last:border-b-0"
                    >
                      <div className="flex items-center gap-2 portrait:gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-sm portrait:text-base w-10 portrait:w-12 shrink-0">{m.memberNumber}</span>
                        <div className="min-w-0">
                          <span className="font-medium portrait:text-base block truncate">{m.displayName}</span>
                          {m.tradeName && <span className="text-xs portrait:text-sm text-muted-foreground block truncate">{m.tradeName}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 portrait:gap-1 shrink-0 ml-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-600 border-amber-300 hover:bg-amber-50 portrait:h-10 portrait:px-3 portrait:text-sm"
                          onClick={() => handleQuickCheckIn(m.id, true)}
                        >
                          <ShieldCheck className="h-3 w-3 portrait:h-4 portrait:w-4 mr-1" />
                          <span className="portrait:hidden">参加費免除</span>
                          <span className="hidden portrait:inline">免除</span>
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 portrait:h-10 portrait:px-4 portrait:text-sm portrait:font-bold"
                          onClick={() => handleQuickCheckIn(m.id, false)}
                        >
                          <UserCheck className="h-3 w-3 portrait:h-4 portrait:w-4 mr-1" />
                          受付
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 受付完了者一覧 */}
      <Card>
        <CardHeader className="pb-2 portrait:pb-1 portrait:pt-3 portrait:px-3">
          <div className="flex items-center justify-between flex-wrap gap-2 portrait:gap-1.5">
            <CardTitle className="text-base portrait:text-sm">
              受付完了者一覧
              <Badge variant="secondary" className="ml-2 portrait:ml-1.5">{presentCount}名</Badge>
            </CardTitle>
            <div className="relative w-64 portrait:w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="番号・名前で検索..."
                className="pl-9 portrait:h-10 portrait:text-base"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputMode="text"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {/* PC/横画面: 通常テーブル */}
            <Table className="portrait:hidden">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">徴収</TableHead>
                  <TableHead className="w-20">番号</TableHead>
                  <TableHead>表示名</TableHead>
                  <TableHead>屋号</TableHead>
                  <TableHead className="w-28 text-center">参加費</TableHead>
                  <TableHead className="w-36 text-center">同伴者</TableHead>
                  <TableHead className="w-40 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      読み込み中...
                    </TableCell>
                  </TableRow>
                ) : filteredPresent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {attendance.length === 0
                        ? "出欠データがありません。「出欠データ初期化」ボタンで全会員を登録してください。"
                        : presentCount === 0
                        ? "まだ受付完了者がいません。「受付追加」ボタンから会員を受付してください。"
                        : "該当する会員が見つかりません"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPresent.map((a) => {
                    const m = a.member;
                    if (!m) return null;
                    const exempt = (a as any).isFeeExempt ?? false;
                    const companions = (a as any).companionCount ?? 0;
                    const collected = (a as any).feeCollected ?? false;
                    const needsCollection = !exempt || companions > 0; // 免除者でも同伴者がいれば徴収必要
                    return (
                      <TableRow key={a.id} className={
                        !collected && needsCollection
                          ? "bg-red-50/40 dark:bg-red-950/10 border-l-4 border-l-red-400"
                          : exempt
                          ? "bg-amber-50/50 dark:bg-amber-950/20"
                          : "bg-green-50/50 dark:bg-green-950/20"
                      }>
                        <TableCell className="text-center">
                          {needsCollection ? (
                            <Checkbox
                              checked={collected}
                              onCheckedChange={() => handleToggleFeeCollected(m.id, collected)}
                              className={`h-6 w-6 ${collected ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : "border-red-400"}`}
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono font-bold">{m.memberNumber}</TableCell>
                        <TableCell className="font-medium">{m.displayName}</TableCell>
                        <TableCell className="text-muted-foreground">{m.tradeName ?? "-"}</TableCell>
                        <TableCell className="text-center">
                          {exempt ? (
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 cursor-pointer hover:bg-amber-200" onClick={() => handleToggleFeeExempt(m.id, exempt)}>
                              免除
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 cursor-pointer hover:bg-green-200" onClick={() => handleToggleFeeExempt(m.id, exempt)}>
                              通常
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleCompanionChange(m.id, companions - 1)}
                              disabled={companions <= 0}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="font-mono font-bold w-8 text-center">{companions}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleCompanionChange(m.id, companions + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                            onClick={() =>
                              checkInMutation.mutate({
                                eventId: selectedEventId!,
                                memberId: m.id,
                                isPresent: false,
                              })
                            }
                          >
                            受付取消
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* タブレット縦画面: カード型リスト */}
            <div className="hidden portrait:block">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">読み込み中...</div>
              ) : filteredPresent.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm px-4">
                  {attendance.length === 0
                    ? "出欠データがありません。「初期化」ボタンで全会員を登録してください。"
                    : presentCount === 0
                    ? "まだ受付完了者がいません。「受付追加」から会員を受付してください。"
                    : "該当する会員が見つかりません"}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredPresent.map((a) => {
                    const m = a.member;
                    if (!m) return null;
                    const exempt = (a as any).isFeeExempt ?? false;
                    const companions = (a as any).companionCount ?? 0;
                    const collected = (a as any).feeCollected ?? false;
                    const needsCollection = !exempt || companions > 0;
                    return (
                      <div
                        key={a.id}
                        className={`px-3 py-3 ${
                          !collected && needsCollection
                            ? "bg-red-50/40 dark:bg-red-950/10 border-l-4 border-l-red-400"
                            : exempt
                            ? "bg-amber-50/50 dark:bg-amber-950/20"
                            : "bg-green-50/30 dark:bg-green-950/10"
                        }`}
                      >
                        {/* 上段: 徴収チェック・番号・名前・参加費バッジ */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {needsCollection ? (
                              <Checkbox
                                checked={collected}
                                onCheckedChange={() => handleToggleFeeCollected(m.id, collected)}
                                className={`h-7 w-7 shrink-0 ${collected ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : "border-red-400"}`}
                              />
                            ) : (
                              <span className="h-7 w-7 shrink-0 flex items-center justify-center text-muted-foreground text-xs">—</span>
                            )}
                            <span className="font-mono font-bold text-base w-10 shrink-0">{m.memberNumber}</span>
                            <div className="min-w-0">
                              <span className="font-medium text-base block truncate">{m.displayName}</span>
                              {m.tradeName && <span className="text-xs text-muted-foreground block truncate">{m.tradeName}</span>}
                            </div>
                          </div>
                          {exempt ? (
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 shrink-0 text-xs" onClick={() => handleToggleFeeExempt(m.id, exempt)}>
                              免除
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 shrink-0 text-xs" onClick={() => handleToggleFeeExempt(m.id, exempt)}>
                              通常
                            </Badge>
                          )}
                        </div>
                        {/* 下段: 同伴者コントロール・受付取消 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground mr-1">同伴者:</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => handleCompanionChange(m.id, companions - 1)}
                              disabled={companions <= 0}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="font-mono font-bold w-8 text-center text-lg">{companions}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => handleCompanionChange(m.id, companions + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300 hover:bg-red-50 h-9 px-3"
                            onClick={() =>
                              checkInMutation.mutate({
                                eventId: selectedEventId!,
                                memberId: m.id,
                                isPresent: false,
                              })
                            }
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Init Confirmation Dialog */}
      <AlertDialog open={initConfirm} onOpenChange={setInitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>出欠データを初期化しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              全ての有効会員を出欠リストに追加します（既存の出欠データは保持されます）。
              新しく追加された会員はデフォルトで「未受付」として登録されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => initMutation.mutate({ eventId: selectedEventId! })}
              disabled={initMutation.isPending}
            >
              初期化する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
