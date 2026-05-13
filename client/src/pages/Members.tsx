import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, Key, Printer, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Hash, LogIn } from "lucide-react";
import { toast } from "sonner";

type MemberForm = {
  memberNumber: number;
  displayName: string;
  displayNameKana: string;
  tradeName: string;
  tradeNameKana: string;
  representative: string;
  invoiceNumber: string;
  antiquePermitPrefecture: string;
  antiquePermitNumber: string;

  phone: string;
  mobile: string;
  email: string;
  postalCode: string;
  prefecture: string;
  address: string;
  isTaxable: boolean;
  useCustomCommission: boolean;
  sellCommissionRate: string;
  buyCommissionRate: string;
};

const defaultForm: MemberForm = {
  memberNumber: 0,
  displayName: "",
  displayNameKana: "",
  tradeName: "",
  tradeNameKana: "",
  representative: "",
  invoiceNumber: "",
  antiquePermitPrefecture: "",
  antiquePermitNumber: "",

  phone: "",
  mobile: "",
  email: "",
  postalCode: "",
  prefecture: "",
  address: "",
  isTaxable: true,
  useCustomCommission: false,
  sellCommissionRate: "10.00",
  buyCommissionRate: "5.00",
};

// 古物商番号を「○○県第XXXX号」形式に整形
function formatAntiquePermit(m: { antiquePermitPrefecture?: string | null; antiquePermitNumber?: string | null }): string {
  const pref = m.antiquePermitPrefecture?.trim();
  const num = m.antiquePermitNumber?.trim();
  if (!pref && !num) return "-";
  return `${pref ?? ""}第${num ?? ""}号`;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function Members() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<MemberForm>(defaultForm);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordMemberId, setPasswordMemberId] = useState<number | null>(null);
  const [passwordMemberName, setPasswordMemberName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [issuedTemporaryPassword, setIssuedTemporaryPassword] = useState("");
  const [showVacant, setShowVacant] = useState(false);
  const [showExpiredOnly, setShowExpiredOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [gridPage, setGridPage] = useState(1);

  const utils = trpc.useUtils();
  const { data: members = [], isLoading } = trpc.members.listWithActivity.useQuery({ activeOnly: true }, { refetchInterval: 10000 });
  const createMutation = trpc.members.create.useMutation({
    onSuccess: () => {
      utils.members.list.invalidate();
      utils.members.listWithActivity.invalidate();
      setDialogOpen(false);
      toast.success("会員を登録しました");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMutation = trpc.members.update.useMutation({
    onSuccess: () => {
      utils.members.list.invalidate();
      utils.members.listWithActivity.invalidate();
      setDialogOpen(false);
      toast.success("会員情報を更新しました");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMutation = trpc.members.delete.useMutation({
    onSuccess: () => {
      utils.members.list.invalidate();
      utils.members.listWithActivity.invalidate();
      setDeleteId(null);
      toast.success("会員を削除しました");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const setPasswordMutation = trpc.members.setPassword.useMutation({
    onSuccess: () => {
      setPasswordDialogOpen(false);
      setNewPassword("");
      setIssuedTemporaryPassword("");
      toast.success("パスワードを設定しました（初回ログイン時に変更が求められます）");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const resetPasswordMutation = trpc.members.resetPassword.useMutation({
    onSuccess: (data) => {
      setIssuedTemporaryPassword(data.temporaryPassword);
      toast.success("仮パスワードを発行しました。本人へ安全な経路で伝えてください。");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const impersonateMutation = trpc.portal.adminImpersonate.useMutation({
    onSuccess: (data) => {
      // 管理者の元セッションは残したまま、別タブでポータルを開く
      const portalUrl = `${window.location.origin}/portal?impersonate_token=${encodeURIComponent(
        data.token,
      )}&impersonate_member=${encodeURIComponent(JSON.stringify(data.member))}`;
      window.open(portalUrl, "_blank", "noopener");
      toast.success(`${data.member.memberNumber} ${data.member.displayName} のポータルを新しいタブで開きました`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openMemberPortal = (m: typeof members[0]) => {
    if (!confirm(`${m.memberNumber} ${m.displayName} の会員ポータルを管理者権限で開きます。よろしいですか？\n（操作は監査ログに記録されます）`)) {
      return;
    }
    impersonateMutation.mutate({ memberId: m.id });
  };

  const openPasswordDialog = (m: typeof members[0]) => {
    setPasswordMemberId(m.id);
    setPasswordMemberName(`${m.memberNumber} ${m.displayName}`);
    setNewPassword("");
    setIssuedTemporaryPassword("");
    setPasswordDialogOpen(true);
  };

  // Filtered members
  const expiredCount = useMemo(() => members.filter((m: any) => m.isExpired).length, [members]);
  const filtered = useMemo(() => {
    return members.filter(
      (m) =>
        (showExpiredOnly ? (m as any).isExpired : true) &&
        (
        m.displayName.includes(search) ||
        m.tradeName?.includes(search) ||
        (m as any).tradeNameKana?.includes(search) ||
        (m as any).displayNameKana?.includes(search) ||
        (m as any).antiquePermitNumber?.includes(search) ||
        String(m.memberNumber).includes(search))
    );
  }, [members, search]);

  // Vacant numbers (1-1000 range)
  const vacantNumbers = useMemo(() => {
    const usedNumbers = new Set(members.map((m) => m.memberNumber));
    const vacant: number[] = [];
    for (let i = 1; i <= 1000; i++) {
      if (!usedNumbers.has(i)) vacant.push(i);
    }
    return vacant;
  }, [members]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedMembers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

  const openCreate = () => {
    setEditId(null);
    // Auto-suggest next vacant number
    const nextVacant = vacantNumbers.length > 0 ? vacantNumbers[0] : 0;
    setForm({ ...defaultForm, memberNumber: nextVacant });
    setDialogOpen(true);
  };

  const openEdit = (m: typeof members[0]) => {
    setEditId(m.id);
    setForm({
      memberNumber: m.memberNumber,
      displayName: m.displayName,
      displayNameKana: (m as any).displayNameKana ?? "",
      tradeName: m.tradeName ?? "",
      tradeNameKana: (m as any).tradeNameKana ?? "",
      representative: m.representative ?? "",
      invoiceNumber: m.invoiceNumber ?? "",
      antiquePermitPrefecture: (m as any).antiquePermitPrefecture ?? "",
      antiquePermitNumber: (m as any).antiquePermitNumber ?? "",

      phone: m.phone ?? "",
      mobile: (m as any).mobile ?? "",
      email: m.email ?? "",
      postalCode: (m as any).postalCode ?? "",
      prefecture: (m as any).prefecture ?? "",
      address: m.address ?? "",
      isTaxable: m.isTaxable,
      useCustomCommission: (m as any).useCustomCommission ?? false,
      sellCommissionRate: (m as any).sellCommissionRate ?? "10.00",
      buyCommissionRate: (m as any).buyCommissionRate ?? "5.00",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.displayName || !form.memberNumber) {
      toast.error("会員番号と表示名は必須です");
      return;
    }
    if (form.memberNumber < 1 || form.memberNumber > 1000) {
      toast.error("会員番号は1〜1000の範囲で入力してください");
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  // Helper: print HTML content via hidden iframe (avoids popup blocker issues)
  const printViaIframe = (htmlContent: string) => {
    const existingFrame = document.getElementById("print-frame") as HTMLIFrameElement;
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "print-frame";
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      toast.error("印刷用フレームを作成できませんでした");
      return;
    }
    doc.open();
    doc.write(htmlContent);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
      }, 300);
    };
  };

  // Print functions
  const printNameOnly = () => {
    const sortedMembers = [...members].sort((a, b) => a.memberNumber - b.memberNumber);
    
    let rows = "";
    for (let i = 1; i <= 1000; i++) {
      const member = sortedMembers.find((m) => m.memberNumber === i);
      if (member) {
        rows += `<tr><td style="padding:3px 8px;border:1px solid #ccc;text-align:center;font-weight:bold;">${i}</td><td style="padding:3px 8px;border:1px solid #ccc;">${member.displayName}</td></tr>`;
      } else {
        rows += `<tr style="color:#999;background:#f9f9f9;"><td style="padding:3px 8px;border:1px solid #ccc;text-align:center;">${i}</td><td style="padding:3px 8px;border:1px solid #ccc;"></td></tr>`;
      }
    }
    
    printViaIframe(`<!DOCTYPE html><html><head><title>会員番号一覧</title>
      <style>
        @media print { body { margin: 0; } @page { size: A4; margin: 10mm; } }
        body { font-family: 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif; font-size: 10px; }
        h1 { font-size: 16px; margin-bottom: 8px; }
        .info { font-size: 10px; color: #666; margin-bottom: 8px; }
        table { border-collapse: collapse; width: 100%; }
        .cols { column-count: 4; column-gap: 8px; }
        .col-table { break-inside: avoid; width: 100%; margin-bottom: 4px; }
      </style>
    </head><body>
      <h1>会員番号一覧（番号・名前）</h1>
      <p class="info">登録: ${members.length}名 / 空き: ${1000 - members.length}番号 ― 印刷日: ${new Date().toLocaleDateString("ja-JP")}</p>
      <div class="cols"><table class="col-table">${rows}</table></div>
    </body></html>`);
  };

  const printFullInfo = () => {
    const sortedMembers = [...members].sort((a, b) => a.memberNumber - b.memberNumber);
    
    let rows = "";
    sortedMembers.forEach((m) => {
      rows += `<tr>
        <td style="padding:4px 6px;border:1px solid #ccc;text-align:center;font-weight:bold;">${m.memberNumber}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;">${m.displayName}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;">${m.tradeName ?? "-"}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;">${m.representative ?? "-"}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;">${(m as any).antiquePermitNumber ?? "-"}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;">${m.invoiceNumber ?? "-"}</td>

        <td style="padding:4px 6px;border:1px solid #ccc;">${m.phone ?? "-"}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;">${(m as any).mobile ?? "-"}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;font-size:8px;">${(m as any).postalCode ? "\u3012" + (m as any).postalCode : "-"} ${m.address ?? ""}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;font-size:8px;">${m.email ?? "-"}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;">${m.isTaxable ? "課税" : "免税"}</td>
      </tr>`;
    });
    
    printViaIframe(`<!DOCTYPE html><html><head><title>会員一覧（全情報）</title>
      <style>
        @media print { body { margin: 0; } @page { size: A4 landscape; margin: 10mm; } }
        body { font-family: 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif; font-size: 10px; }
        h1 { font-size: 16px; margin-bottom: 8px; }
        .info { font-size: 10px; color: #666; margin-bottom: 8px; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #f0f0f0; padding: 4px 6px; border: 1px solid #ccc; font-size: 10px; white-space: nowrap; }
      </style>
    </head><body>
      <h1>会員一覧（全情報）</h1>
      <p class="info">登録: ${members.length}名 ― 印刷日: ${new Date().toLocaleDateString("ja-JP")}</p>
      <table>
        <thead><tr>
          <th>番号</th><th>表示名</th><th>屋号</th><th>代表者</th><th>古物番号</th><th>インボイス</th><th>電話</th><th>携帯</th><th>住所</th><th>メール</th><th>課税</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`);
  };

  // Member map for grid display (number -> member)
  const memberMap = useMemo(() => {
    const map = new Map<number, typeof members[0]>();
    members.forEach((m) => map.set(m.memberNumber, m));
    return map;
  }, [members]);

  // Grid pagination for vacant number view
  const GRID_PAGE_SIZE = 100;
  const gridTotalPages = Math.ceil(1000 / GRID_PAGE_SIZE);
  const gridStart = (gridPage - 1) * GRID_PAGE_SIZE + 1;
  const gridEnd = Math.min(gridPage * GRID_PAGE_SIZE, 1000);
  const gridNumbers = useMemo(() => {
    const nums: number[] = [];
    for (let i = gridStart; i <= gridEnd; i++) nums.push(i);
    return nums;
  }, [gridStart, gridEnd]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">会員管理</h1>
          <p className="text-muted-foreground mt-1">
            登録: <strong>{members.length}</strong>名 / 空き: <strong>{vacantNumbers.length}</strong>番号（上限1000）
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowVacant(!showVacant)}>
            <Hash className="h-4 w-4 mr-1" />
            {showVacant ? "空き番号を隠す" : "空き番号を表示"}
          </Button>
          <Button variant="outline" size="sm" onClick={printNameOnly}>
            <Printer className="h-4 w-4 mr-1" />
            番号・名前印刷
          </Button>
          <Button variant="outline" size="sm" onClick={printFullInfo}>
            <Printer className="h-4 w-4 mr-1" />
            全情報印刷
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新規登録
          </Button>
        </div>
      </div>

      {/* Number grid display */}
      {showVacant && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                番号一覧（{gridStart}〜{gridEnd}） ― 登録: {members.length}名 / 空き: {vacantNumbers.length}番号
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setGridPage(1)}
                  disabled={gridPage <= 1}
                >
                  <ChevronsLeft className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setGridPage(gridPage - 1)}
                  disabled={gridPage <= 1}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs px-2 text-muted-foreground">
                  {gridPage} / {gridTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setGridPage(gridPage + 1)}
                  disabled={gridPage >= gridTotalPages}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setGridPage(gridTotalPages)}
                  disabled={gridPage >= gridTotalPages}
                >
                  <ChevronsRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="border border-gray-200 bg-gray-50 px-2 py-1 text-center w-16 font-medium">番号</th>
                    <th className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-medium">会員名</th>
                  </tr>
                </thead>
                <tbody>
                  {gridNumbers.map((num) => {
                    const member = memberMap.get(num);
                    return (
                      <tr
                        key={num}
                        className={member ? "bg-white hover:bg-gray-50" : "bg-gray-50/50"}
                      >
                        <td className={`border border-gray-200 px-2 py-0.5 text-center font-mono ${
                          member ? "font-bold text-gray-900" : "text-gray-300"
                        }`}>
                          {num}
                        </td>
                        <td className={`border border-gray-200 px-2 py-0.5 ${
                          member ? "text-gray-900" : ""
                        }`}>
                          {member ? member.displayName : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="会員番号・名前で検索..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="max-w-sm"
            />
            <Button
              variant={showExpiredOnly ? "destructive" : "outline"}
              size="sm"
              onClick={() => { setShowExpiredOnly((v) => !v); setCurrentPage(1); }}
              title="1年以上取引がない会員のみ表示"
            >
              失効会員のみ表示（{expiredCount}名）
            </Button>
            <span className="text-sm text-muted-foreground ml-auto">
              {filtered.length}件表示
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">番号</TableHead>
                  <TableHead>屋号（表示名）</TableHead>
                  <TableHead>名前</TableHead>
                  <TableHead>古物商番号</TableHead>
                  <TableHead className="w-32 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      読み込み中...
                    </TableCell>
                  </TableRow>
                ) : paginatedMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {search ? "該当する会員が見つかりません" : "会員が登録されていません"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedMembers.map((m) => {
                    const expired = (m as any).isExpired;
                    const lastAt = (m as any).lastActivityAt as number | null;
                    const lastLabel = lastAt
                      ? new Date(lastAt * 1000).toLocaleDateString("ja-JP")
                      : "取引履歴なし";
                    return (
                    <TableRow key={m.id} className={expired ? "bg-red-50 hover:bg-red-100" : undefined}>
                      <TableCell className="font-mono">
                        {m.memberNumber}
                        {expired && (
                          <span
                            className="ml-2 inline-block rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white align-middle"
                            title={`最終取引: ${lastLabel}（1年以上経過）`}
                          >
                            失効
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={`font-medium ${expired ? "text-red-700" : ""}`}>{m.tradeName || m.displayName}</TableCell>
                      <TableCell className={expired ? "text-red-700" : ""}>{m.representative ?? "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{formatAntiquePermit(m as any)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)} title="編集">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openMemberPortal(m)} title="会員ポータルを開く（管理者権限）" disabled={impersonateMutation.isPending}>
                            <LogIn className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openPasswordDialog(m)} title="パスワード設定">
                            <Key className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(m.id)}
                            title={expired ? `削除提案：最終取引 ${lastLabel}（1年以上）。削除しますか？` : "削除"}
                          >
                            <Trash2 className={`h-4 w-4 ${expired ? "text-red-600" : "text-destructive"}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>表示件数:</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}件</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="ml-2">
                  {(safeCurrentPage - 1) * pageSize + 1}〜{Math.min(safeCurrentPage * pageSize, filtered.length)} / {filtered.length}件
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage <= 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(safeCurrentPage - 1)}
                  disabled={safeCurrentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  {safeCurrentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(safeCurrentPage + 1)}
                  disabled={safeCurrentPage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "会員情報の編集" : "新規会員登録"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>会員番号 *</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                placeholder="1〜1000"
                value={form.memberNumber || ""}
                onChange={(e) => setForm({ ...form, memberNumber: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                1〜1000の範囲で入力
                {!editId && vacantNumbers.length > 0 && (
                  <> ― 次の空き番号: <strong className="text-amber-600">{vacantNumbers[0]}</strong></>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label>フリガナ（屋号）</Label>
              <Input
                value={form.tradeNameKana}
                onChange={(e) => setForm({ ...form, tradeNameKana: e.target.value })}
                placeholder="例: ヤマダショウテン"
              />
            </div>
            <div className="space-y-2">
              <Label>屋号（表示名） *</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value, tradeName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>フリガナ（代表者名）</Label>
              <Input
                value={form.displayNameKana}
                onChange={(e) => setForm({ ...form, displayNameKana: e.target.value })}
                placeholder="例: ヤマダタロウ"
              />
            </div>
            <div className="space-y-2">
              <Label>代表者名</Label>
              <Input
                value={form.representative}
                onChange={(e) => setForm({ ...form, representative: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>インボイス番号</Label>
              <Input
                value={form.invoiceNumber}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                placeholder="T0-0000-0000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>古物商 都道府県</Label>
              <Input
                value={form.antiquePermitPrefecture}
                onChange={(e) => setForm({ ...form, antiquePermitPrefecture: e.target.value })}
                placeholder="例: 愛知県"
              />
            </div>
            <div className="space-y-2">
              <Label>古物商番号</Label>
              <Input
                value={form.antiquePermitNumber}
                onChange={(e) => setForm({ ...form, antiquePermitNumber: e.target.value })}
                placeholder="例: 541234567890"
              />
              <p className="text-xs text-muted-foreground">
                表示例: {formatAntiquePermit(form)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>電話番号</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>携帯番号</Label>
              <Input
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>メールアドレス</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>郵便番号</Label>
              <Input
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                placeholder="000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>都道府県</Label>
              <Input
                value={form.prefecture}
                onChange={(e) => setForm({ ...form, prefecture: e.target.value })}
                placeholder="例: 岐阜"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>住所</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isTaxable}
                onCheckedChange={(v) => setForm({ ...form, isTaxable: v })}
              />
              <Label>課税事業者</Label>
            </div>

            {/* 個別歩合設定 */}
            <div className="col-span-2 border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">個別歩合設定</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ONにするとイベントの歩合よりこの会員の個別歩合が優先されます
                  </p>
                </div>
                <Switch
                  checked={form.useCustomCommission}
                  onCheckedChange={(v) => setForm({ ...form, useCustomCommission: v })}
                />
              </div>
              {form.useCustomCommission && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label>売歩合（%）</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={form.sellCommissionRate}
                      onChange={(e) => setForm({ ...form, sellCommissionRate: e.target.value })}
                      placeholder="10.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>買歩合（%）</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={form.buyCommissionRate}
                      onChange={(e) => setForm({ ...form, buyCommissionRate: e.target.value })}
                      placeholder="5.00"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editId ? "更新" : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(() => {
                const target: any = members.find((mm: any) => mm.id === deleteId);
                return target?.isExpired ? "失効会員の削除提案" : "会員を削除しますか？";
              })()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const target: any = members.find((mm: any) => mm.id === deleteId);
                if (target?.isExpired) {
                  const lastLabel = target.lastActivityAt
                    ? new Date(target.lastActivityAt * 1000).toLocaleDateString("ja-JP")
                    : "取引履歴なし";
                  return `${target.memberNumber} ${target.tradeName || target.displayName} は最終取引が ${lastLabel} で1年以上経過しているため、会員権が失効しています。削除しますか？（取引データは保持されます。判断は管理者にお任せします）`;
                }
                return "この操作により会員は非アクティブになります。取引データは保持されます。";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Setting Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ポータルパスワード設定</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              <strong>{passwordMemberName}</strong> のポータルログインパスワードを設定します。
              初回ログイン時にパスワード変更が求められます。
            </p>
            {issuedTemporaryPassword && (
              <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                <Label>発行済み仮パスワード（一度だけ表示）</Label>
                <Input type="text" value={issuedTemporaryPassword} readOnly />
                <p className="text-xs text-amber-800">
                  この値は保存されません。本人へ安全な経路で伝えてください。
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>仮パスワード（手入力）</Label>
              <Input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="4文字以上"
                minLength={4}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (!passwordMemberId) return;
                if (confirm("ランダムな仮パスワードを発行しますか？")) {
                  resetPasswordMutation.mutate({ id: passwordMemberId });
                }
              }}
              disabled={resetPasswordMutation.isPending}
              className="sm:mr-auto"
            >
              {resetPasswordMutation.isPending ? "発行中..." : "仮パスワードを発行"}
            </Button>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                if (!passwordMemberId || newPassword.length < 4) {
                  toast.error("パスワードは4文字以上で入力してください");
                  return;
                }
                setPasswordMutation.mutate({ id: passwordMemberId, password: newPassword });
              }}
              disabled={setPasswordMutation.isPending}
            >
              {setPasswordMutation.isPending ? "設定中..." : "設定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
