import { useMemo, useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Settings as SettingsIcon, Upload, Trash2, Image, Loader2, Banknote, Save, Calendar, AlertTriangle } from "lucide-react";
import { useEvent } from "@/contexts/EventContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function Settings() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.settings.getAll.useQuery();
  const { selectedEventId, selectEvent } = useEvent();
  const { data: events = [], isLoading: eventsLoading } = trpc.events.list.useQuery(undefined, { refetchInterval: 10000 });

  const deleteEventMutation = trpc.events.delete.useMutation({
    onSuccess: (_data, vars) => {
      utils.events.list.invalidate();
      utils.dashboard.stats.invalidate();
      if (selectedEventId === vars.id) {
        selectEvent(null);
      }
      toast.success("イベントを削除しました");
    },
    onError: (err) => toast.error(`削除に失敗しました: ${err.message}`),
  });

  const [deleteStep1Open, setDeleteStep1Open] = useState(false);
  const [deleteStep2Open, setDeleteStep2Open] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const deleteTarget = useMemo(
    () => events.find((e) => e.id === deleteTargetId) ?? null,
    [events, deleteTargetId]
  );
  const uploadMutation = trpc.settings.uploadSealImage.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      toast.success("印鑑画像をアップロードしました");
    },
    onError: (err) => {
      toast.error(`アップロードに失敗しました: ${err.message}`);
    },
  });
  const removeMutation = trpc.settings.removeSealImage.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      toast.success("印鑑画像を削除しました");
    },
    onError: (err) => {
      toast.error(`削除に失敗しました: ${err.message}`);
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const sealImageUrl = settings?.seal_image_url || null;

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.match(/^image\/(png|jpeg|gif|webp)$/)) {
      toast.error("PNG、JPEG、GIF、WebP形式の画像のみアップロードできます");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("ファイルサイズは5MB以下にしてください");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Convert to base64 and upload
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    uploadMutation.mutate({
      base64Data: base64,
      mimeType: file.type,
      fileName: file.name,
    });
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [handleFileSelect]);

  const handleRemove = useCallback(() => {
    if (confirm("印鑑画像を削除しますか？")) {
      removeMutation.mutate();
      setPreviewUrl(null);
    }
  }, [removeMutation]);

  const openDeleteFlow = (eventId: number) => {
    setDeleteTargetId(eventId);
    setDeleteConfirmText("");
    setDeleteStep2Open(false);
    setDeleteStep1Open(true);
  };

  const proceedDeleteStep2 = () => {
    setDeleteStep1Open(false);
    setDeleteConfirmText("");
    setDeleteStep2Open(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const required = deleteTarget.eventDate;
    if (deleteConfirmText.trim() !== required) {
      toast.error(`確認のため「${required}」と入力してください`);
      return;
    }
    deleteEventMutation.mutate({ id: deleteTarget.id });
    setDeleteStep2Open(false);
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0", color: "#888" }}>
        読み込み中...
      </div>
    );
  }

  const displayUrl = previewUrl || sealImageUrl;
  const isUploading = uploadMutation.isPending;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <SettingsIcon size={24} style={{ color: "#16a34a" }} />
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>各種設定</h1>
      </div>

      {/* イベント削除セクション */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-green-600" />
            イベント管理（削除）
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            ダッシュボードのイベント一覧に表示されるイベントを削除できます。削除すると、取引・精算・出欠・レジ記録も同時に削除されます。
          </p>
        </CardHeader>
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
              {eventsLoading ? (
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
                  const isSelected = ev.id === selectedEventId;
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono">
                        {ev.eventDate}
                        {isSelected ? (
                          <Badge variant="secondary" className="ml-2">
                            選択中
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{ev.title ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant={ev.status === "open" ? "default" : ev.status === "closed" ? "secondary" : "outline"}>
                          {ev.status === "open" ? "オープン" : ev.status === "closed" ? "締め済み" : "精算済み"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDeleteFlow(ev.id)}
                          disabled={deleteEventMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          削除
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 印鑑画像設定セクション */}
      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Image size={18} style={{ color: "#16a34a" }} />
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>印鑑画像</h2>
        </div>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
          精算書PDFに表示する印鑑画像を設定します。「岐阜リサイクルオークション」の横に印鑑が表示されます。
          PNG、JPEG、GIF、WebP形式（5MB以下）に対応しています。背景が透明なPNG画像を推奨します。
        </p>

        {/* Current image display */}
        {displayUrl && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            padding: 20,
            background: "#f9fafb",
            borderRadius: 8,
            marginBottom: 20,
            border: "1px solid #e5e7eb",
          }}>
            <div style={{
              width: 120,
              height: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              overflow: "hidden",
            }}>
              <img
                src={displayUrl}
                alt="印鑑画像"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>現在の印鑑画像</p>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                この画像が精算書PDFに表示されます
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 14px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: isUploading ? "not-allowed" : "pointer",
                    fontSize: 13,
                    opacity: isUploading ? 0.5 : 1,
                  }}
                >
                  <Upload size={14} />
                  変更
                </button>
                <button
                  onClick={handleRemove}
                  disabled={removeMutation.isPending || isUploading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 14px",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: removeMutation.isPending ? "not-allowed" : "pointer",
                    fontSize: 13,
                    color: "#dc2626",
                    opacity: removeMutation.isPending ? 0.5 : 1,
                  }}
                >
                  <Trash2 size={14} />
                  削除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload area (shown when no image or as fallback) */}
        {!displayUrl && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragOver ? "#16a34a" : "#d1d5db"}`,
              borderRadius: 8,
              padding: "40px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: isDragOver ? "#f0fdf4" : "#fafafa",
              transition: "all 0.2s",
            }}
          >
            {isUploading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Loader2 size={32} style={{ color: "#16a34a", animation: "spin 1s linear infinite" }} />
                <p style={{ fontSize: 14, color: "#16a34a", fontWeight: 500 }}>アップロード中...</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Upload size={32} style={{ color: "#9ca3af" }} />
                <p style={{ fontSize: 14, color: "#374151" }}>
                  クリックまたはドラッグ＆ドロップで画像をアップロード
                </p>
                <p style={{ fontSize: 12, color: "#9ca3af" }}>
                  PNG, JPEG, GIF, WebP（5MB以下）
                </p>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleInputChange}
          style={{ display: "none" }}
        />
      </div>

      {/* Preview section - how it looks on settlement */}
      {displayUrl && (
        <div style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>精算書での表示プレビュー</h2>
          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 24,
            fontFamily: "'Noto Sans JP', sans-serif",
          }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <p style={{ fontWeight: 700, fontSize: 14 }}>岐阜リサイクルオークション</p>
              <p style={{ fontSize: 11 }}>TEL:0575-24-3200</p>
              <p style={{ fontSize: 11 }}>住所:岐阜県多治見市大原町8-1-1</p>
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 10 }}>運営　総合リサイクルセンター JPH合同会社</p>
                <p style={{ fontSize: 10 }}>登録番号：T7-2000-0300-4293</p>
              </div>
              <img
                src={displayUrl}
                alt="印鑑"
                style={{
                  position: "absolute",
                  top: -10,
                  left: 200,
                  width: 70,
                  height: 70,
                  objectFit: "contain",
                  opacity: 0.85,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* レジ準備金設定セクション */}
      <RegisterFundSetting settings={settings} />

      {/* 2段階確認: Step1 */}
      <Dialog
        open={deleteStep1Open}
        onOpenChange={(open) => {
          setDeleteStep1Open(open);
          if (!open) setDeleteTargetId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              イベントを削除しますか？
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              対象: <span className="font-mono font-semibold">{deleteTarget?.eventDate ?? "-"}</span>{" "}
              {deleteTarget?.title ? <span>（{deleteTarget.title}）</span> : null}
            </p>
            <p className="text-muted-foreground">この操作は取り消せません。次の画面で最終確認を行います。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStep1Open(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={proceedDeleteStep2} disabled={!deleteTarget}>
              続行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2段階確認: Step2（文言入力） */}
      <Dialog
        open={deleteStep2Open}
        onOpenChange={(open) => {
          setDeleteStep2Open(open);
          if (!open) setDeleteTargetId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              最終確認
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              イベント <span className="font-mono font-semibold">{deleteTarget?.eventDate ?? "-"}</span>{" "}
              {deleteTarget?.title ? <span>（{deleteTarget.title}）</span> : null} を削除します。
            </p>
            <p className="text-muted-foreground">
              確認のため、下に開催日（<span className="font-mono">{deleteTarget?.eventDate ?? ""}</span>）を入力してください。
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={deleteTarget?.eventDate ?? "YYYY-MM-DD"}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStep2Open(false)} disabled={deleteEventMutation.isPending}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteEventMutation.isPending || !deleteTarget}
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// レジ準備金設定コンポーネント
function RegisterFundSetting({ settings }: { settings: Record<string, string | null> | undefined }) {
  const utils = trpc.useUtils();
  const upsertMutation = trpc.settings.upsert.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      toast.success("レジ準備金を保存しました");
    },
    onError: (err) => {
      toast.error(`保存に失敗しました: ${err.message}`);
    },
  });

  const currentValue = settings?.register_initial_fund || "50000";
  const [fundAmount, setFundAmount] = useState(currentValue);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    const num = parseInt(fundAmount, 10);
    if (isNaN(num) || num < 0) {
      toast.error("有効な金額を入力してください");
      return;
    }
    upsertMutation.mutate({
      key: "register_initial_fund",
      value: String(num),
      description: "レジのお釣り用準備金",
    });
    setIsEditing(false);
  };

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 24,
      marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Banknote size={18} style={{ color: "#16a34a" }} />
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>レジ準備金</h2>
      </div>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
        レジ開始時にお釣り用としてレジに入れておく金額を設定します。レジ締め時の理論残高計算に使用されます。
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <span style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#6b7280",
            fontSize: 16,
            fontWeight: 600,
          }}>¥</span>
          <input
            type="text"
            inputMode="numeric"
            value={isEditing ? fundAmount : parseInt(currentValue, 10).toLocaleString()}
            onChange={(e) => {
              setIsEditing(true);
              setFundAmount(e.target.value.replace(/[^0-9]/g, ""));
            }}
            onFocus={() => {
              setIsEditing(true);
              setFundAmount(currentValue);
            }}
            style={{
              width: "100%",
              padding: "10px 12px 10px 28px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 18,
              fontWeight: 600,
              textAlign: "right",
              outline: "none",
            }}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={upsertMutation.isPending}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            background: "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: upsertMutation.isPending ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 600,
            opacity: upsertMutation.isPending ? 0.6 : 1,
          }}
        >
          <Save size={16} />
          保存
        </button>
      </div>
    </div>
  );
}
