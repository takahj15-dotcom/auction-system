import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { FileText, LogOut, Download, Eye, User, Menu, X, ChevronRight, Calendar, TrendingUp, TrendingDown, Wallet, Bell, CheckCheck, Lock, ShoppingCart, RefreshCw, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";

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

export default function PortalDashboard() {
  const { token, member, logout } = usePortalAuth();
  const [, setLocation] = useLocation();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"live" | "settlements">("live");

  const { data: settlements, isLoading } = trpc.portal.mySettlements.useQuery(
    { token: token ?? "" },
    { enabled: !!token, refetchInterval: 10000 }
  );

  const { data: profile } = trpc.portal.myProfile.useQuery(
    { token: token ?? "" },
    { enabled: !!token, refetchInterval: 30000 }
  );

  // リアルタイム取引データ（5秒ごとに自動更新）
  const { data: liveData, isLoading: liveLoading } = trpc.portal.myLiveTransactions.useQuery(
    { token: token ?? "" },
    { enabled: !!token, refetchInterval: 5000 }
  );

  // 通知関連
  const { data: unreadCount, refetch: refetchUnread } = trpc.portal.unreadNotificationCount.useQuery(
    { token: token ?? "" },
    { enabled: !!token, refetchInterval: 15000 }
  );

  const { data: notifications, refetch: refetchNotifications } = trpc.portal.myNotifications.useQuery(
    { token: token ?? "", limit: 30 },
    { enabled: !!token && notifOpen }
  );

  const markRead = trpc.portal.markNotificationRead.useMutation({
    onSuccess: () => { refetchUnread(); refetchNotifications(); },
  });

  const markAllRead = trpc.portal.markAllNotificationsRead.useMutation({
    onSuccess: () => { refetchUnread(); refetchNotifications(); },
  });

  // Detect mobile device
  const isMobileDevice = () => {
    return /iPad|iPhone|iPod|Android|Mobile|webOS|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  };

  const handleDownloadPdf = async (settlementId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingId(settlementId);
    try {
      if (isMobileDevice()) {
        // Mobile: Open PDF directly in browser tab using inline mode
        // This is the most reliable method for iOS Safari and Android Chrome
        window.open(`/api/pdf/settlement/${settlementId}?inline=1`, "_blank");
      } else {
        // Desktop: Use fetch + blob for proper download with filename
        const response = await fetch(`/api/pdf/settlement/${settlementId}`);
        if (!response.ok) throw new Error("PDF generation failed");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `精算書_${settlementId}.pdf`;
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
        window.open(`/api/pdf/settlement/${settlementId}?inline=1`, "_blank");
      } catch {
        alert("PDFのダウンロードに失敗しました。しばらくしてからもう一度お試しください。");
      }
    } finally {
      // Delay clearing loading state on mobile to give time for new tab to open
      setTimeout(() => setDownloadingId(null), isMobileDevice() ? 2000 : 500);
    }
  };

  const handleNotifClick = (notif: any) => {
    if (!notif.isRead) {
      markRead.mutate({ token: token ?? "", notificationId: notif.id });
    }
    if (notif.linkUrl) {
      setNotifOpen(false);
      setLocation(notif.linkUrl);
    }
  };

  if (!token) return null;

  const fmt = (n: number) => `¥${n.toLocaleString()}`;
  const badgeCount = unreadCount?.count ?? 0;

  // サマリー計算
  const totalSales = settlements?.reduce((sum: number, item: any) => sum + item.settlement.salesTotal, 0) ?? 0;
  const totalPurchase = settlements?.reduce((sum: number, item: any) => sum + item.settlement.purchaseTotal, 0) ?? 0;
  const totalSettlement = settlements?.reduce((sum: number, item: any) => sum + item.settlement.settlementAmount, 0) ?? 0;

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "たった今";
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}時間前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}日前`;
    return d.toLocaleDateString("ja-JP");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa", fontFamily: "'Noto Sans JP', sans-serif" }}>
      {/* Mobile-optimized Header */}
      <header style={{
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
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* 通知ベルアイコン */}
          <button
            onClick={() => { setNotifOpen(!notifOpen); setMenuOpen(false); }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              color: "#555",
              position: "relative",
            }}
          >
            <Bell size={22} />
            {badgeCount > 0 && (
              <span style={{
                position: "absolute",
                top: 4,
                right: 4,
                background: "#dc2626",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 10,
                minWidth: 18,
                height: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
                lineHeight: 1,
              }}>
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </button>
          {/* ハンバーガーメニュー */}
          <button
            onClick={() => { setMenuOpen(!menuOpen); setNotifOpen(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: "#555" }}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* 通知パネル */}
      {notifOpen && (
        <div style={{
          position: "fixed",
          top: 56,
          left: 0,
          right: 0,
          bottom: 0,
          background: "#fff",
          zIndex: 49,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* 通知ヘッダー */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>通知</span>
            <div style={{ display: "flex", gap: 8 }}>
              {badgeCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate({ token: token ?? "" })}
                  disabled={markAllRead.isPending}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "#16a34a",
                    fontWeight: 500,
                  }}
                >
                  <CheckCheck size={14} />
                  全て既読
                </button>
              )}
              <button
                onClick={() => setNotifOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  color: "#888",
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* 通知リスト */}
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {!notifications || notifications.length === 0 ? (
              <div style={{
                padding: "48px 16px",
                textAlign: "center",
                color: "#888",
                fontSize: 14,
              }}>
                <Bell size={32} color="#ddd" style={{ marginBottom: 12 }} />
                <div>通知はありません</div>
              </div>
            ) : (
              notifications.map((notif: any) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid #f0f0f0",
                    cursor: notif.linkUrl ? "pointer" : "default",
                    background: notif.isRead ? "#fff" : "#f0fdf4",
                    transition: "background 0.15s",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: notif.isRead ? "#f3f4f6" : "#dcfce7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                    }}>
                      {notif.type === "settlement" ? (
                        <FileText size={16} color={notif.isRead ? "#9ca3af" : "#16a34a"} />
                      ) : (
                        <Bell size={16} color={notif.isRead ? "#9ca3af" : "#16a34a"} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: notif.isRead ? 400 : 600,
                        color: notif.isRead ? "#666" : "#1a1a1a",
                        marginBottom: 3,
                      }}>
                        {notif.title}
                      </div>
                      {notif.message && (
                        <div style={{
                          fontSize: 12,
                          color: "#888",
                          lineHeight: 1.5,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical" as any,
                        }}>
                          {notif.message}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
                        {formatTimeAgo(notif.createdAt)}
                      </div>
                    </div>
                    {!notif.isRead && (
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: "#16a34a",
                        flexShrink: 0,
                        marginTop: 8,
                      }} />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Dropdown menu */}
      {menuOpen && (
        <div style={{
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 0" }}>
            <User size={16} color="#888" />
            <span style={{ fontSize: 14, color: "#333" }}>
              {profile?.memberNumber ?? member?.memberNumber}　{profile?.displayName ?? member?.displayName}
            </span>
          </div>
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

      {/* Overlay to close menu/notifications */}
      {menuOpen && !notifOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 48 }}
        />
      )}

      {/* Main Content - Mobile optimized */}
      <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto" }}>
        {/* Profile Card - Compact */}
        {profile && (
          <div style={{
            background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
            borderRadius: 16,
            padding: "20px",
            marginBottom: 16,
            color: "#fff",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <User size={22} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>No.{profile.memberNumber}</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{profile.displayName}</div>
              </div>
            </div>
            {(profile.tradeName || profile.invoiceNumber) && (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 4,
              }}>
                {profile.tradeName && (
                  <span style={{
                    fontSize: 11,
                    background: "rgba(255,255,255,0.15)",
                    padding: "3px 10px",
                    borderRadius: 20,
                  }}>
                    {profile.tradeName}
                  </span>
                )}
                {profile.invoiceNumber && (
                  <span style={{
                    fontSize: 11,
                    background: "rgba(255,255,255,0.15)",
                    padding: "3px 10px",
                    borderRadius: 20,
                  }}>
                    {profile.invoiceNumber}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: "flex",
          gap: 0,
          marginBottom: 16,
          background: "#f0f0f0",
          borderRadius: 12,
          padding: 3,
        }}>
          <button
            onClick={() => setActiveTab("live")}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              borderRadius: 10,
              background: activeTab === "live" ? "#fff" : "transparent",
              color: activeTab === "live" ? "#16a34a" : "#888",
              fontWeight: activeTab === "live" ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              boxShadow: activeTab === "live" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s",
            }}
          >
            <ShoppingCart size={14} />
            本日の取引
            {liveData && liveData.events.length > 0 && (
              <span style={{
                background: "#16a34a",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 10,
                padding: "1px 6px",
                minWidth: 18,
                textAlign: "center",
              }}>
                LIVE
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("settlements")}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              borderRadius: 10,
              background: activeTab === "settlements" ? "#fff" : "transparent",
              color: activeTab === "settlements" ? "#16a34a" : "#888",
              fontWeight: activeTab === "settlements" ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              boxShadow: activeTab === "settlements" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s",
            }}
          >
            <FileText size={14} />
            精算書一覧
          </button>
        </div>

        {/* ===== LIVE TRANSACTIONS TAB ===== */}
        {activeTab === "live" && (
          <>
            {liveLoading ? (
              <div style={{
                background: "#fff",
                borderRadius: 12,
                padding: "48px 16px",
                textAlign: "center",
                color: "#888",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
                <div>取引データを読み込み中...</div>
              </div>
            ) : !liveData || liveData.events.length === 0 ? (
              <div style={{
                background: "#fff",
                borderRadius: 12,
                padding: "48px 16px",
                textAlign: "center",
                color: "#888",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <ShoppingCart size={32} color="#ddd" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14, marginBottom: 4 }}>現在開催中のオークションはありません</div>
                <div style={{ fontSize: 12 }}>オークション開催中はここにリアルタイムで取引が表示されます</div>
              </div>
            ) : (
              <>
                {/* Live Summary Cards */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                  marginBottom: 16,
                }}>
                  <div style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: "14px 12px",
                    textAlign: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}>
                    <ArrowUpRight size={16} color="#16a34a" style={{ marginBottom: 4 }} />
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>売合計</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{fmt(liveData.totalSales)}</div>
                  </div>
                  <div style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: "14px 12px",
                    textAlign: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}>
                    <ArrowDownLeft size={16} color="#dc2626" style={{ marginBottom: 4 }} />
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>買合計</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{fmt(liveData.totalPurchases)}</div>
                  </div>
                  <div style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: "14px 12px",
                    textAlign: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}>
                    <Wallet size={16} color="#2563eb" style={{ marginBottom: 4 }} />
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>差引</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: liveData.netAmount >= 0 ? "#2563eb" : "#dc2626" }}>{fmt(liveData.netAmount)}</div>
                  </div>
                </div>

                {/* Auto-refresh indicator */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  marginBottom: 12,
                  fontSize: 11,
                  color: "#aaa",
                }}>
                  <RefreshCw size={12} />
                  5秒ごとに自動更新
                </div>

                {/* Live Transactions per Event */}
                {liveData.events.map((ev: any) => (
                  <div key={ev.eventId} style={{ marginBottom: 16 }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 10,
                    }}>
                      <Calendar size={14} color="#888" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{ev.eventDate}</span>
                      {ev.eventTitle && <span style={{ fontSize: 11, color: "#888" }}>{ev.eventTitle}</span>}
                    </div>

                    {/* Sales Section */}
                    {ev.salesTransactions.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#16a34a",
                        }}>
                          <ArrowUpRight size={14} />
                          売り（{ev.salesTransactions.length}件）
                          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700 }}>{fmt(ev.salesTotal)}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {ev.salesTransactions.map((t: any) => (
                            <div key={t.id} style={{
                              background: "#fff",
                              borderRadius: 10,
                              padding: "10px 12px",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                              borderLeft: t.transactionType === "return" ? "3px solid #f59e0b" : "3px solid #16a34a",
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {t.transactionType === "return" && <span style={{ color: "#f59e0b", marginRight: 4 }}>[返品]</span>}
                                    {t.itemName}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                                    買主: No.{t.counterpartNumber} {t.counterpartName}
                                    {t.quantity > 1 && <span> × {t.quantity}</span>}
                                  </div>
                                </div>
                                <div style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: t.transactionType === "return" ? "#f59e0b" : "#16a34a",
                                  whiteSpace: "nowrap",
                                  marginLeft: 8,
                                }}>
                                  {t.transactionType === "return" ? "-" : ""}{fmt(t.totalPrice)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Purchases Section */}
                    {ev.purchaseTransactions.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#dc2626",
                        }}>
                          <ArrowDownLeft size={14} />
                          買い（{ev.purchaseTransactions.length}件）
                          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700 }}>{fmt(ev.purchaseTotal)}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {ev.purchaseTransactions.map((t: any) => (
                            <div key={t.id} style={{
                              background: "#fff",
                              borderRadius: 10,
                              padding: "10px 12px",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                              borderLeft: t.transactionType === "return" ? "3px solid #f59e0b" : "3px solid #dc2626",
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {t.transactionType === "return" && <span style={{ color: "#f59e0b", marginRight: 4 }}>[返品]</span>}
                                    {t.itemName}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                                    売主: No.{t.counterpartNumber} {t.counterpartName}
                                    {t.quantity > 1 && <span> × {t.quantity}</span>}
                                  </div>
                                </div>
                                <div style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: t.transactionType === "return" ? "#f59e0b" : "#dc2626",
                                  whiteSpace: "nowrap",
                                  marginLeft: 8,
                                }}>
                                  {t.transactionType === "return" ? "-" : ""}{fmt(t.totalPrice)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No transactions for this event */}
                    {ev.salesTransactions.length === 0 && ev.purchaseTransactions.length === 0 && (
                      <div style={{
                        background: "#fff",
                        borderRadius: 12,
                        padding: "24px 16px",
                        textAlign: "center",
                        color: "#888",
                        fontSize: 13,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}>
                        まだ取引がありません
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ===== SETTLEMENTS TAB ===== */}
        {activeTab === "settlements" && (
          <>
            {/* Summary Cards */}
            {settlements && settlements.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
                marginBottom: 16,
              }}>
                <div style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: "14px 12px",
                  textAlign: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}>
                  <TrendingUp size={16} color="#16a34a" style={{ marginBottom: 4 }} />
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>売合計</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{fmt(totalSales)}</div>
                </div>
                <div style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: "14px 12px",
                  textAlign: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}>
                  <TrendingDown size={16} color="#dc2626" style={{ marginBottom: 4 }} />
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>買合計</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{fmt(totalPurchase)}</div>
                </div>
                <div style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: "14px 12px",
                  textAlign: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}>
                  <Wallet size={16} color="#2563eb" style={{ marginBottom: 4 }} />
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>精算合計</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{fmt(totalSettlement)}</div>
                </div>
              </div>
            )}

            {/* Settlements List */}
            <div style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>精算書一覧</h2>
            </div>

        {isLoading ? (
          <div style={{
            background: "#fff",
            borderRadius: 12,
            padding: "48px 16px",
            textAlign: "center",
            color: "#888",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            読み込み中...
          </div>
        ) : !settlements || settlements.length === 0 ? (
          <div style={{
            background: "#fff",
            borderRadius: 12,
            padding: "48px 16px",
            textAlign: "center",
            color: "#888",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            精算書がありません。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {settlements.map((item: any) => (
              <div
                key={item.settlement.id}
                onClick={() => setLocation(`/portal/settlement/${item.settlement.id}`)}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: "16px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  cursor: "pointer",
                  transition: "box-shadow 0.15s",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {/* Event info row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Calendar size={14} color="#888" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{item.event.eventDate}</span>
                    {item.event.title && (
                      <span style={{ fontSize: 11, color: "#888" }}>{item.event.title}</span>
                    )}
                  </div>
                  <ChevronRight size={16} color="#ccc" />
                </div>

                {/* Amount grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#888" }}>売合計</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>{fmt(item.settlement.salesTotal)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#888" }}>買合計</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>{fmt(item.settlement.purchaseTotal)}</div>
                  </div>
                </div>

                {/* Settlement amount + actions */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: 12,
                  borderTop: "1px solid #f0f0f0",
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#888" }}>精算額</div>
                    <div style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: item.settlement.settlementAmount >= 0 ? "#16a34a" : "#dc2626",
                    }}>
                      {fmt(item.settlement.settlementAmount)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/portal/settlement/${item.settlement.id}`);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "8px 14px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        background: "#fff",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#555",
                        minHeight: 36,
                      }}
                    >
                      <Eye size={14} />
                      詳細
                    </button>
                    <button
                      onClick={(e) => handleDownloadPdf(item.settlement.id, e)}
                      disabled={downloadingId === item.settlement.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "8px 14px",
                        border: "none",
                        borderRadius: 8,
                        background: downloadingId === item.settlement.id ? "#94a3b8" : "#16a34a",
                        color: "#fff",
                        cursor: downloadingId === item.settlement.id ? "not-allowed" : "pointer",
                        fontSize: 12,
                        fontWeight: 500,
                        minHeight: 36,
                      }}
                    >
                      <Download size={14} />
                      {downloadingId === item.settlement.id ? "..." : "PDF"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}
