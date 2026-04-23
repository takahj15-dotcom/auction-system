import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEvent } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  FileSpreadsheet,
  Calculator,
  FileText,
  TrendingUp,
  ArrowRight,
  Plus,
  CheckCircle2,
  CreditCard,
  BarChart3,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "オープン", variant: "default" },
  settled: { label: "精算済み", variant: "outline" },
  closed: { label: "締め済み", variant: "secondary" },
};

// カスタムツールチップ
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {entry.name === "売上合計"
              ? `¥${Number(entry.value).toLocaleString()}`
              : entry.name === "出席率"
              ? `${entry.value}%`
              : Number(entry.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function EventSalesTrendChart() {
  const { data: trendData = [], isLoading } = trpc.dashboard.eventSalesTrend.useQuery(
    { limit: 20 },
    { refetchInterval: 30000 }
  );

  const salesAxis = useMemo(() => {
    const max = trendData.reduce((m, d) => Math.max(m, Number(d.totalSales ?? 0)), 0);
    // 日本の金額表示として視覚的に読み取りやすい単位に寄せる（円/千円/万円）
    if (max >= 5_000_000) return { divisor: 10_000, unit: "万円", decimals: 1, max };
    if (max >= 200_000) return { divisor: 10_000, unit: "万円", decimals: 0, max };
    if (max >= 50_000) return { divisor: 1_000, unit: "千円", decimals: 0, max };
    return { divisor: 1, unit: "円", decimals: 0, max };
  }, [trendData]);

  const chartData = useMemo(() => {
    return trendData.map((d) => ({
      name: d.eventDate.slice(5), // MM-DD形式
      fullDate: d.eventDate,
      title: d.title || d.eventDate,
      売上合計: d.totalSales,
      取引件数: d.transactionCount,
      出席率: d.totalMembers > 0 ? Math.round((d.presentCount / d.totalMembers) * 100) : 0,
      出席者数: d.presentCount,
    }));
  }, [trendData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            イベント別売上推移
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">読み込み中...</div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            イベント別売上推移
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            イベントデータがありません
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          イベント別売上推移
        </CardTitle>
        <p className="text-xs text-muted-foreground">直近{chartData.length}件のイベント実績</p>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                tickCount={7}
                tickFormatter={(v) => {
                  const scaled = Number(v) / salesAxis.divisor;
                  const s = scaled.toFixed(salesAxis.decimals);
                  // ".0" を落としてスッキリ表示
                  const trimmed = salesAxis.decimals > 0 ? s.replace(/\.0$/, "") : s;
                  return `${trimmed}${salesAxis.unit}`;
                }}
                label={{
                  value: `売上（${salesAxis.unit}）`,
                  angle: -90,
                  position: "insideLeft",
                  offset: -5,
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                domain={[0, 'auto']}
                tickCount={7}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar
                yAxisId="left"
                dataKey="売上合計"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="取引件数"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="出席者数"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3 }}
                strokeDasharray="5 5"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Summary stats below chart */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">平均売上</p>
            <p className="text-sm font-bold text-green-600">
              ¥{chartData.length > 0
                ? Math.round(chartData.reduce((s, d) => s + Number(d.売上合計), 0) / chartData.length).toLocaleString()
                : 0}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">平均取引件数</p>
            <p className="text-sm font-bold text-blue-600">
              {chartData.length > 0
                ? Math.round(chartData.reduce((s, d) => s + Number(d.取引件数), 0) / chartData.length)
                : 0}件
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">平均出席者数</p>
            <p className="text-sm font-bold text-amber-600">
              {chartData.length > 0
                ? Math.round(chartData.reduce((s, d) => s + Number(d.出席者数), 0) / chartData.length)
                : 0}名
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedEventId, selectEvent } = useEvent();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery({}, { refetchInterval: 10000 });
  const { data: events = [], isLoading: eventsLoading } = trpc.events.list.useQuery(undefined, { refetchInterval: 10000 });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventDate, setEventDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [title, setTitle] = useState("");
  const [sellRate, setSellRate] = useState("10.00");
  const [buyRate, setBuyRate] = useState("5.00");
  const [absentSellRate, setAbsentSellRate] = useState("15.00");
  const [absentBuyRate, setAbsentBuyRate] = useState("5.00");
  const [participationFee, setParticipationFee] = useState("2000");
  const [companionFee, setCompanionFee] = useState("1000");

  const utils = trpc.useUtils();
  const createMutation = trpc.events.create.useMutation({
    onSuccess: (data) => {
      utils.events.list.invalidate();
      utils.dashboard.stats.invalidate();
      setDialogOpen(false);
      setEventDate(new Date().toISOString().split("T")[0]);
      setTitle("");
      setSellRate("10.00");
      setBuyRate("5.00");
      setAbsentSellRate("15.00");
      setAbsentBuyRate("5.00");
      setParticipationFee("2000");
      setCompanionFee("1000");
      selectEvent(data.id);
      toast.success("イベントを作成しました");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!eventDate) {
      toast.error("開催日を入力してください");
      return;
    }
    createMutation.mutate({
      eventDate,
      title: title || undefined,
      sellCommissionRate: sellRate,
      buyCommissionRate: buyRate,
      absentSellCommissionRate: absentSellRate,
      absentBuyCommissionRate: absentBuyRate,
      participationFee: parseInt(participationFee) || 0,
      companionFee: parseInt(companionFee) || 0,
    });
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  // Quick actions based on selected event status
  const getQuickActions = () => {
    if (!selectedEvent) {
      return [
        { icon: FileSpreadsheet, label: "取引入力", path: "/transactions", color: "text-emerald-600", bg: "bg-emerald-50" },
        { icon: Calculator, label: "締め処理", path: "/closing", color: "text-amber-600", bg: "bg-amber-50" },
        { icon: FileText, label: "精算書", path: "/settlements", color: "text-purple-600", bg: "bg-purple-50" },
        { icon: CreditCard, label: "レジ", path: "/register", color: "text-blue-600", bg: "bg-blue-50" },
      ];
    }
    const actions = [];
    if (selectedEvent.status === "open") {
      actions.push({ icon: FileSpreadsheet, label: "取引入力", path: "/transactions", color: "text-emerald-600", bg: "bg-emerald-50" });
      actions.push({ icon: Calculator, label: "締め処理", path: "/closing", color: "text-amber-600", bg: "bg-amber-50" });
    }
    if (selectedEvent.status === "settled") {
      actions.push({ icon: FileSpreadsheet, label: "取引入力", path: "/transactions", color: "text-emerald-600", bg: "bg-emerald-50" });
      actions.push({ icon: Calculator, label: "締め処理", path: "/closing", color: "text-amber-600", bg: "bg-amber-50" });
      actions.push({ icon: FileText, label: "精算書", path: "/settlements", color: "text-purple-600", bg: "bg-purple-50" });
      actions.push({ icon: CreditCard, label: "レジ", path: "/register", color: "text-blue-600", bg: "bg-blue-50" });
    }
    if (selectedEvent.status === "closed") {
      actions.push({ icon: FileText, label: "精算書", path: "/settlements", color: "text-purple-600", bg: "bg-purple-50" });
      actions.push({ icon: CreditCard, label: "レジ", path: "/register", color: "text-blue-600", bg: "bg-blue-50" });
    }
    return actions;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
          <p className="text-muted-foreground mt-1">
            {user?.name ? `${user.name}さん、` : ""}おかえりなさい
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新規イベント
        </Button>
      </div>

      {/* Current Event Selection */}
      <Card className={selectedEvent ? "border-primary/50 bg-primary/5" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            選択中のイベント
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedEvent ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">{selectedEvent.eventDate}</span>
                {selectedEvent.title && <span className="text-muted-foreground">{selectedEvent.title}</span>}
                <Badge variant={statusLabels[selectedEvent.status]?.variant ?? "default"}>
                  {statusLabels[selectedEvent.status]?.label ?? selectedEvent.status}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => selectEvent(null)}>
                選択解除
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              下のイベント一覧からイベントを選択してください。選択したイベントは取引入力・締め処理・精算書で自動的に引き継がれます。
            </p>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">登録会員数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : (stats?.totalMembers ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">アクティブ会員</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">本日の取引件数</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : (stats?.todayTransactions ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">件</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">本日の取引総額</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : `¥${(stats?.todayTotal ?? 0).toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">合計金額</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">オープンイベント</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : (stats?.openEvents ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">未締めイベント</p>
          </CardContent>
        </Card>
      </div>

      {/* Event Sales Trend Chart */}
      <EventSalesTrendChart />

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">クイックアクション</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {getQuickActions().map((s) => (
            <Button
              key={s.path}
              variant="outline"
              className="h-auto py-4 px-4 justify-start gap-3 bg-card hover:bg-accent/50"
              onClick={() => setLocation(s.path)}
            >
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div className="text-left">
                <div className="font-medium">{s.label}</div>
              </div>
              <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </Button>
          ))}
        </div>
      </div>

      {/* Event List (integrated from Events page) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            イベント一覧
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>開催日</TableHead>
                <TableHead>タイトル</TableHead>
                <TableHead>出席歩合(売/買)</TableHead>
                <TableHead>欠席歩合(売/買)</TableHead>
                <TableHead>参加費</TableHead>
                <TableHead>同伴者料金</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventsLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    イベントがありません。「新規イベント」ボタンで作成してください。
                  </TableCell>
                </TableRow>
              ) : (
                events.map((ev) => {
                  const s = statusLabels[ev.status] ?? statusLabels.open;
                  const isSelected = ev.id === selectedEventId;
                  return (
                    <TableRow
                      key={ev.id}
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/10" : "hover:bg-muted/50"}`}
                      onClick={() => selectEvent(ev.id)}
                    >
                      <TableCell className="font-mono">{ev.eventDate}</TableCell>
                      <TableCell>{ev.title ?? "-"}</TableCell>
                      <TableCell className="text-sm font-mono">{ev.sellCommissionRate}/{ev.buyCommissionRate}</TableCell>
                      <TableCell className="text-sm font-mono">{ev.absentSellCommissionRate}/{ev.absentBuyCommissionRate}</TableCell>
                      <TableCell className="text-sm font-mono">¥{(ev.participationFee ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm font-mono">¥{(ev.companionFee ?? 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {isSelected ? (
                            <Badge variant="default" className="bg-primary">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              選択中
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectEvent(ev.id);
                              }}
                            >
                              選択
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規イベント作成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>開催日 *</Label>
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>タイトル</Label>
              <Input
                placeholder="例: 第100回定期市"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">出席者歩合</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">売歩合 (%)</Label>
                  <Input type="number" step="0.01" min="0" max="100" value={sellRate} onChange={(e) => setSellRate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">買歩合 (%)</Label>
                  <Input type="number" step="0.01" min="0" max="100" value={buyRate} onChange={(e) => setBuyRate(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">参加費</p>
              <div className="space-y-1">
                <Label className="text-xs">参加費 (円)</Label>
                <Input type="number" min="0" step="100" value={participationFee} onChange={(e) => setParticipationFee(e.target.value)} placeholder="例: 2000" />
                <p className="text-xs text-muted-foreground">リサイクル: 2000円 / がらくた市: 1500円</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">同伴者料金 (円/人)</Label>
                <Input type="number" min="0" step="100" value={companionFee} onChange={(e) => setCompanionFee(e.target.value)} placeholder="例: 1000" />
                <p className="text-xs text-muted-foreground">2人目以降の同伴者1人あたりの料金</p>
              </div>
            </div>
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">欠席者歩合</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">売歩合 (%)</Label>
                  <Input type="number" step="0.01" min="0" max="100" value={absentSellRate} onChange={(e) => setAbsentSellRate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">買歩合 (%)</Label>
                  <Input type="number" step="0.01" min="0" max="100" value={absentBuyRate} onChange={(e) => setAbsentBuyRate(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
