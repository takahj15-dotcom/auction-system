import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield } from "lucide-react";

const actionLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  create: { label: "作成", variant: "default" },
  update: { label: "更新", variant: "secondary" },
  delete: { label: "削除", variant: "destructive" },
  bulk_create: { label: "一括作成", variant: "default" },
  close_event: { label: "締め処理", variant: "outline" },
  reopen_event: { label: "締め取消", variant: "outline" },
};

const tableLabels: Record<string, string> = {
  members: "会員",
  events: "イベント",
  transactions: "取引",
  settlements: "精算",
};

export default function AuditLog() {
  const { data: logs = [], isLoading } = trpc.audit.list.useQuery({ limit: 200, offset: 0 }, { refetchInterval: 10000 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" />
          監査ログ
        </h1>
        <p className="text-muted-foreground mt-1">
          全ての操作履歴を記録・追跡します
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">日時</TableHead>
                  <TableHead className="w-20">操作</TableHead>
                  <TableHead className="w-24">対象</TableHead>
                  <TableHead className="w-20">レコードID</TableHead>
                  <TableHead>ユーザーID</TableHead>
                  <TableHead>IPアドレス</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      読み込み中...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      ログがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const a = actionLabels[log.action] ?? { label: log.action, variant: "secondary" as const };
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-mono">
                          {new Date(log.createdAt).toLocaleString("ja-JP")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.variant} className="text-xs">{a.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {tableLabels[log.tableName] ?? log.tableName}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{log.recordId ?? "-"}</TableCell>
                        <TableCell className="text-sm">{log.userId ?? "-"}</TableCell>
                        <TableCell className="text-xs font-mono">{log.ipAddress ?? "-"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
