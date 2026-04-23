import { useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Printer, FileDown, FileText, LogOut, User, Menu, X, Lock } from "lucide-react";

function usePortalAuth() {
  const [, setLocation] = useLocation();
  const token = localStorage.getItem("portal_token");
  const memberStr = localStorage.getItem("portal_member");
  const member = memberStr ? JSON.parse(memberStr) : null;

  const logout = useCallback(() => {
    localStorage.removeItem("portal_token");
    localStorage.removeItem("portal_member");
    setLocation("/portal/login");
  }, [setLocation]);

  useEffect(() => {
    if (!token) {
      setLocation("/portal/login");
    }
  }, [token, setLocation]);

  return { token, member, logout };
}

// Detect if running on iOS
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// Detect if running on Android
function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

// Detect mobile device
function isMobile(): boolean {
  return isIOS() || isAndroid() || /Mobile|webOS|Opera Mini/i.test(navigator.userAgent);
}

export default function PortalSettlementDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { token, member, logout } = usePortalAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Use portal-specific API instead of admin-only trpc.pdf.getSettlementPdfData
  const { data, isLoading, error } = trpc.portal.getSettlementDetail.useQuery(
    { token: token ?? "", settlementId: parseInt(params.id ?? "0") },
    { enabled: !!params.id && !!token, retry: 1 }
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (!params.id) return;
    setPdfLoading(true);
    try {
      if (isMobile()) {
        // Mobile: Open PDF directly in browser tab using inline mode
        // This is the most reliable method for iOS Safari and Android Chrome
        window.open(`/api/pdf/settlement/${params.id}?inline=1`, "_blank");
      } else {
        // Desktop: Use fetch + blob for proper download with filename
        const response = await fetch(`/api/pdf/settlement/${params.id}`);
        if (!response.ok) throw new Error("PDF generation failed");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `精算書_${data?.member?.displayName ?? ""}_${data?.event?.eventDate ?? ""}.pdf`;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1000);
      }
    } catch (err) {
      // Fallback: try window.open as last resort
      try {
        window.open(`/api/pdf/settlement/${params.id}?inline=1`, "_blank");
      } catch {
        alert("PDFの生成に失敗しました。しばらくしてからもう一度お試しください。");
      }
    } finally {
      // Delay clearing loading state on mobile to give time for new tab to open
      setTimeout(() => setPdfLoading(false), isMobile() ? 2000 : 500);
    }
  }, [params.id, data]);

  if (!token) return null;

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f7fa", fontFamily: "'Noto Sans JP', sans-serif" }}>
        <PortalHeader member={member} logout={logout} menuOpen={menuOpen} setMenuOpen={setMenuOpen} setLocation={setLocation} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0", color: "#888" }}>
          読み込み中...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f7fa", fontFamily: "'Noto Sans JP', sans-serif" }}>
        <PortalHeader member={member} logout={logout} menuOpen={menuOpen} setMenuOpen={setMenuOpen} setLocation={setLocation} />
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <div style={{ color: "#888", marginBottom: 16 }}>
            {error?.message === "セッションが期限切れです。再度ログインしてください。"
              ? "セッションが期限切れです。再度ログインしてください。"
              : "精算データが見つかりません"}
          </div>
          <button
            onClick={() => setLocation("/portal")}
            style={{
              padding: "10px 24px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  const { settlement, member: settlementMember, event, salesTransactions, purchaseTransactions, breakdown, sealImageUrl } = data;
  const participationFeeStatus = (data as any).participationFeeStatus ?? "absent";
  const salesReturnTransactions = (data as any).salesReturnTransactions ?? [];
  const purchaseReturnTransactions = (data as any).purchaseReturnTransactions ?? [];
  const salesReturnTotal = (breakdown as any).salesReturnTotal ?? settlement.salesReturnTotal ?? 0;
  const purchaseReturnTotal = (breakdown as any).purchaseReturnTotal ?? settlement.purchaseReturnTotal ?? 0;
  const fmt = (n: number) => `¥${n.toLocaleString()}`;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa", fontFamily: "'Noto Sans JP', sans-serif" }}>
      <PortalHeader member={member} logout={logout} menuOpen={menuOpen} setMenuOpen={setMenuOpen} setLocation={setLocation} />

      {/* Overlay to close menu */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 48 }}
        />
      )}

      <main style={{ maxWidth: 600, margin: "0 auto", padding: "12px 16px 32px" }}>
        {/* Action buttons - sticky on mobile */}
        <div className="no-print" style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          position: "sticky",
          top: 56,
          zIndex: 40,
          background: "#f5f7fa",
          padding: "8px 0",
        }}>
          <button
            onClick={() => setLocation("/portal")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "8px 14px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              minHeight: 40,
            }}
          >
            <ArrowLeft size={16} />
            戻る
          </button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={handlePrint}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "8px 14px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                minHeight: 40,
              }}
            >
              <Printer size={16} />
              印刷
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "8px 14px",
                border: "none",
                borderRadius: 8,
                background: pdfLoading ? "#94a3b8" : "#16a34a",
                color: "#fff",
                cursor: pdfLoading ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 500,
                minHeight: 40,
              }}
            >
              <FileDown size={16} />
              {pdfLoading ? "生成中..." : "PDF"}
            </button>
          </div>
        </div>

        {/* Settlement Sheet */}
        <div ref={printRef} style={{
          background: "#fff",
          padding: "20px 16px",
          borderRadius: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          fontSize: 11,
          color: "#000",
        }}>
          <style>{`
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
              @page { size: A4; margin: 10mm; }
            }
          `}</style>

          <h1 style={{ textAlign: "center", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            岐阜リサイクルオークション　精算書
          </h1>
          <p style={{ fontSize: 11, marginBottom: 16, textAlign: "center" }}>開催日：{event?.eventDate}</p>

          {/* Member info - stacked on mobile */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              {settlementMember?.memberNumber}　{settlementMember?.displayName}　<span style={{ fontWeight: 400 }}>様</span>
            </p>
            <div style={{ fontSize: 10, lineHeight: 1.8, position: "relative" }}>
              <p style={{ fontWeight: 700 }}>岐阜リサイクルオークション</p>
              <p>TEL:0575-24-3200</p>
              <p>住所:岐阜県多治見市大原町8-1-1</p>
              <div style={{ marginTop: 4 }}>
                <p style={{ fontSize: 9 }}>運営　総合リサイクルセンター JPH合同会社</p>
                <p style={{ fontSize: 9 }}>登録番号：T7-2000-0300-4293</p>
              </div>
              {sealImageUrl && (
                <img
                  src={sealImageUrl}
                  alt="印鑑"
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 0,
                    width: 60,
                    height: 60,
                    objectFit: "contain",
                    opacity: 0.85,
                  }}
                />
              )}
            </div>
          </div>

          {/* Summary table - responsive */}
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 300 }}>
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "28%" }} />
              </colgroup>
              <tbody>
                <tr>
                  <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 700, borderBottom: "1px solid #ccc", whiteSpace: "nowrap" }}>売り合計金額</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(settlement.salesTotal)}</td>
                  <td style={{ textAlign: "right", padding: "4px 4px", fontSize: 9, borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc", color: "#555", whiteSpace: "nowrap" }}>内課税業者</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(breakdown.salesTotalTaxable)}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>手数料</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(settlement.salesCommission)}</td>
                  <td style={{ textAlign: "right", padding: "4px 4px", fontSize: 9, borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc", color: "#555", whiteSpace: "nowrap" }}>内免税業者</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(breakdown.salesTotalNonTaxable)}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>消費税(10%)</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(breakdown.salesCommissionTax)}</td>
                  <td style={{ borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}></td>
                  <td style={{ borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}></td>
                </tr>
                <tr>
                  <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 700, borderBottom: "1px solid #ccc", whiteSpace: "nowrap" }}>買い合計金額</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(settlement.purchaseTotal)}</td>
                  <td style={{ textAlign: "right", padding: "4px 4px", fontSize: 9, borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc", color: "#555", whiteSpace: "nowrap" }}>内課税業者</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(breakdown.purchaseTotalTaxable)}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>手数料</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(settlement.purchaseCommission)}</td>
                  <td style={{ textAlign: "right", padding: "4px 4px", fontSize: 9, borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc", color: "#555", whiteSpace: "nowrap" }}>内免税業者</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(breakdown.purchaseTotalNonTaxable)}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "2px solid #000" }}>消費税(10%)</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "2px solid #000", borderLeft: "1px solid #ccc" }}>{fmt(breakdown.purchaseCommissionTax)}</td>
                  <td style={{ borderBottom: "2px solid #000", borderLeft: "1px solid #ccc" }}></td>
                  <td style={{ borderBottom: "2px solid #000", borderLeft: "1px solid #ccc" }}></td>
                </tr>
                {/* 返品行（黄色背景） */}
                {salesReturnTotal > 0 && (
                  <tr style={{ background: "#ffffcc" }}>
                    <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 700, borderBottom: "1px solid #ccc" }}>売返品</td>
                    <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(salesReturnTotal)}</td>
                    <td style={{ borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}></td>
                    <td style={{ borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}></td>
                  </tr>
                )}
                {purchaseReturnTotal > 0 && (
                  <tr style={{ background: "#ffffcc" }}>
                    <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 700, borderBottom: "1px solid #ccc" }}>買返品</td>
                    <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(purchaseReturnTotal)}</td>
                    <td style={{ borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}></td>
                    <td style={{ borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}></td>
                  </tr>
                )}
                {/* 参加費: 未徴収のときのみ表示（領収済・免除・不参加は非表示） */}
                {participationFeeStatus === "uncollected" && (
                  <tr style={{ background: "#ffe6e6" }}>
                    <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 700, borderBottom: "1px solid #ccc", color: "#c80000" }}>参加費</td>
                    <td style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc", color: "#c80000" }}>{fmt(settlement.participationFee)}</td>
                    <td colSpan={2} style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc", fontSize: 9, color: "#c80000" }}>精算書より差引させていただきます</td>
                  </tr>
                )}
                {/* お支払金額 */}
                <tr>
                  <td style={{ textAlign: "right", padding: "8px 6px", fontWeight: 700, fontSize: 13, background: "#f5f5f5" }}>お支払金額</td>
                  <td colSpan={3} style={{ textAlign: "right", padding: "8px 6px", fontWeight: 700, fontSize: 16, background: "#f5f5f5", borderLeft: "1px solid #ccc" }}>
                    {fmt(settlement.settlementAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Purchase transactions */}
          {purchaseTransactions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>【買い明細】</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, minWidth: 340 }}>
                  <thead>
                    <tr style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>
                      <th style={{ textAlign: "left", padding: "4px 4px" }}>商品名</th>
                      <th style={{ textAlign: "right", padding: "4px 4px" }}>数量</th>
                      <th style={{ textAlign: "right", padding: "4px 4px" }}>金額</th>
                      <th style={{ textAlign: "left", padding: "4px 4px" }}>売主</th>
                      <th style={{ textAlign: "left", padding: "4px 4px", fontSize: 9 }}>インボイス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseTransactions.map((t: any) => (
                      <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "3px 4px" }}>{t.itemName}</td>
                        <td style={{ textAlign: "right", padding: "3px 4px" }}>{t.quantity}</td>
                        <td style={{ textAlign: "right", padding: "3px 4px" }}>{t.totalPrice.toLocaleString()}</td>
                        <td style={{ padding: "3px 4px", fontSize: 9 }}>{t.sellerMemberNumber}　{t.sellerName}</td>
                        <td style={{ padding: "3px 4px", fontSize: 9 }}>{t.sellerInvoiceNumber || ""}</td>
                      </tr>
                    ))}
                    {purchaseReturnTransactions.map((t: any) => (
                      <tr key={`pr-${t.id}`} style={{ borderBottom: "1px solid #eee", background: "#ffffcc" }}>
                        <td style={{ padding: "3px 4px", fontWeight: 700 }}>買返品: {t.itemName}</td>
                        <td style={{ textAlign: "right", padding: "3px 4px" }}>{t.quantity}</td>
                        <td style={{ textAlign: "right", padding: "3px 4px" }}>{t.totalPrice.toLocaleString()}</td>
                        <td style={{ padding: "3px 4px", fontSize: 9 }}>{t.sellerMemberNumber}　{t.sellerName}</td>
                        <td style={{ padding: "3px 4px", fontSize: 9 }}>{t.sellerInvoiceNumber || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sales transactions */}
          {salesTransactions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>【売り明細】</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, minWidth: 340 }}>
                  <thead>
                    <tr style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>
                      <th style={{ textAlign: "left", padding: "4px 4px" }}>商品名</th>
                      <th style={{ textAlign: "right", padding: "4px 4px" }}>数量</th>
                      <th style={{ textAlign: "right", padding: "4px 4px" }}>金額</th>
                      <th style={{ textAlign: "left", padding: "4px 4px" }}>買主</th>
                      <th style={{ textAlign: "left", padding: "4px 4px", fontSize: 9 }}>インボイス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesTransactions.map((t: any) => (
                      <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "3px 4px" }}>{t.itemName}</td>
                        <td style={{ textAlign: "right", padding: "3px 4px" }}>{t.quantity}</td>
                        <td style={{ textAlign: "right", padding: "3px 4px" }}>{t.totalPrice.toLocaleString()}</td>
                        <td style={{ padding: "3px 4px", fontSize: 9 }}>{t.buyerMemberNumber}　{t.buyerName}</td>
                        <td style={{ padding: "3px 4px", fontSize: 9 }}>{t.buyerInvoiceNumber || ""}</td>
                      </tr>
                    ))}
                    {salesReturnTransactions.map((t: any) => (
                      <tr key={`sr-${t.id}`} style={{ borderBottom: "1px solid #eee", background: "#ffffcc" }}>
                        <td style={{ padding: "3px 4px", fontWeight: 700 }}>売返品: {t.itemName}</td>
                        <td style={{ textAlign: "right", padding: "3px 4px" }}>{t.quantity}</td>
                        <td style={{ textAlign: "right", padding: "3px 4px" }}>{t.totalPrice.toLocaleString()}</td>
                        <td style={{ padding: "3px 4px", fontSize: 9 }}>{t.buyerMemberNumber}　{t.buyerName}</td>
                        <td style={{ padding: "3px 4px", fontSize: 9 }}>{t.buyerInvoiceNumber || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function PortalHeader({ member, logout, menuOpen, setMenuOpen, setLocation }: { member: any; logout: () => void; menuOpen: boolean; setMenuOpen: (v: boolean) => void; setLocation: (path: string) => void }) {
  return (
    <>
      <header className="no-print" style={{
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
        padding: "0 16px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={20} color="#16a34a" />
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a" }}>会員ポータル</span>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: "#555" }}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Dropdown menu */}
      {menuOpen && (
        <div className="no-print" style={{
          position: "fixed",
          top: 56,
          left: 0,
          right: 0,
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "12px 16px",
          zIndex: 49,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}>
          {member && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 0" }}>
              <User size={16} color="#888" />
              <span style={{ fontSize: 14, color: "#333" }}>
                {member.memberNumber}　{member.displayName}
              </span>
            </div>
          )}
          <button
            onClick={() => { setMenuOpen(false); setLocation("/portal/change-password"); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 0",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 14,
              color: "#333",
              width: "100%",
              borderTop: "1px solid #f0f0f0",
            }}
          >
            <Lock size={16} />
            パスワード変更
          </button>
          <button
            onClick={logout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 0",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 14,
              color: "#dc2626",
              width: "100%",
              borderTop: "1px solid #f0f0f0",
            }}
          >
            <LogOut size={16} />
            ログアウト
          </button>
        </div>
      )}
    </>
  );
}
