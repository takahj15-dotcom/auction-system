import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Eye, Printer, Download } from "lucide-react";
import { useLocation } from "wouter";
import { useEvent } from "@/contexts/EventContext";
import { toast } from "sonner";

export default function Settlements() {
  const { selectedEventId: globalEventId, selectEvent } = useEvent();
  const selectedEventId = globalEventId ? String(globalEventId) : "";
  const [, setLocation] = useLocation();
  const [bulkPdfLoading, setBulkPdfLoading] = useState(false);

  const { data: events = [] } = trpc.events.list.useQuery(undefined, { refetchInterval: 10000 });
  const closedEvents = events.filter((e) => e.status !== "open");
  const { data: settlements = [], isLoading } = trpc.settlements.list.useQuery(
    { eventId: parseInt(selectedEventId) },
    { enabled: !!selectedEventId, refetchInterval: 5000 }
  );

  const handleBulkPrint = () => {
    if (!selectedEventId) return;
    // Open HTML-based print page in a new tab so the design matches
    // individual print exactly (shared <SettlementSheet /> component).
    const url = `/settlements/print-all/${selectedEventId}`;
    const win = window.open(url, "_blank");
    if (!win) {
      toast.error("ポップアップがブロックされました。ブラウザの設定をご確認ください。");
    } else {
      toast.success("印刷プレビューを新しいタブで開きました");
    }
  };

  const handleBulkDownload = async () => {
    if (!selectedEventId) return;
    setBulkPdfLoading(true);
    try {
      toast.info("一括PDFを生成中です。しばらくお待ちください...");
      const response = await fetch(`/api/pdf/bulk/${selectedEventId}`);
      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const ev = closedEvents.find(e => String(e.id) === selectedEventId);
      link.download = `精算書一括_${ev?.eventDate ?? selectedEventId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      toast.success("一括PDFをダウンロードしました");
    } catch (err) {
      toast.error("一括PDFダウンロードに失敗しました");
      console.error(err);
    } finally {
      setBulkPdfLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">精算書</h1>
          <p className="text-muted-foreground mt-1">
            締め処理済みイベントの精算書を確認・PDF出力します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedEventId} onValueChange={(v) => selectEvent(v ? parseInt(v) : null)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="イベントを選択..." />
            </SelectTrigger>
            <SelectContent>
              {closedEvents.length === 0 ? (
                <SelectItem value="none" disabled>
                  締め済みイベントがありません
                </SelectItem>
              ) : (
                closedEvents.map((ev) => (
                  <SelectItem key={ev.id} value={String(ev.id)}>
                    {ev.eventDate} {ev.title ?? ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedEventId && settlements.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={handleBulkPrint}
            disabled={bulkPdfLoading}
          >
            <Printer className="h-4 w-4 mr-2" />
            {bulkPdfLoading ? "生成中..." : "一括印刷"}
          </Button>
          <Button
            variant="outline"
            onClick={handleBulkDownload}
            disabled={bulkPdfLoading}
          >
            <Download className="h-4 w-4 mr-2" />
            一括PDF保存
          </Button>
          <span className="text-sm text-muted-foreground">
            {settlements.length}件の精算書
          </span>
        </div>
      )}

      {selectedEventId ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>会員番号</TableHead>
                    <TableHead>会員名</TableHead>
                    <TableHead className="text-right">売合計</TableHead>
                    <TableHead className="text-right">買合計</TableHead>
                    <TableHead className="text-right font-bold">精算額</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        読み込み中...
                      </TableCell>
                    </TableRow>
                  ) : settlements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        精算データがありません
                      </TableCell>
                    </TableRow>
                  ) : (
                    settlements.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono">{s.member?.memberNumber ?? "-"}</TableCell>
                        <TableCell>{s.member?.displayName ?? "-"}</TableCell>
                        <TableCell className="text-right">¥{s.salesTotal.toLocaleString()}</TableCell>
                        <TableCell className="text-right">¥{s.purchaseTotal.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold">
                          <span className={s.settlementAmount >= 0 ? "text-emerald-600" : "text-red-600"}>
                            ¥{s.settlementAmount.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/settlements/${s.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            詳細・PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            イベントを選択して精算書を表示してください
          </CardContent>
        </Card>
      )}
    </div>
  );
}
