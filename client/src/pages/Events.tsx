import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, FileSpreadsheet, Calculator } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "オープン", variant: "default" },
  closed: { label: "締め済み", variant: "secondary" },
  settled: { label: "精算済み", variant: "outline" },
};

export default function Events() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [title, setTitle] = useState("");
  const [, setLocation] = useLocation();

  const utils = trpc.useUtils();
  const { data: events = [], isLoading } = trpc.events.list.useQuery(undefined, { refetchInterval: 10000 });
  const createMutation = trpc.events.create.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      setDialogOpen(false);
      setEventDate("");
      setTitle("");
      toast.success("イベントを作成しました");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!eventDate) {
      toast.error("開催日を入力してください");
      return;
    }
    createMutation.mutate({ eventDate, title: title || undefined });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">イベント管理</h1>
          <p className="text-muted-foreground mt-1">開催日ごとのイベントを管理します</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新規イベント
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>開催日</TableHead>
                <TableHead>タイトル</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    イベントがありません
                  </TableCell>
                </TableRow>
              ) : (
                events.map((ev) => {
                  const s = statusLabels[ev.status] ?? statusLabels.open;
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono">{ev.eventDate}</TableCell>
                      <TableCell>{ev.title ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/transactions?eventId=${ev.id}`)}
                          >
                            <FileSpreadsheet className="h-4 w-4 mr-1" />
                            取引入力
                          </Button>
                          {ev.status === "open" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(`/closing?eventId=${ev.id}`)}
                            >
                              <Calculator className="h-4 w-4 mr-1" />
                              締め処理
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
