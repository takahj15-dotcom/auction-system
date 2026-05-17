import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react";

export default function PortalChangePassword() {
  const [, setLocation] = useLocation();
  const token = localStorage.getItem("portal_token");
  const memberStr = localStorage.getItem("portal_member");
  const member = memberStr ? JSON.parse(memberStr) : null;
  const isForced = member?.requirePasswordChange === true;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setLocation("/portal/login");
    }
  }, [token, setLocation]);

  const changeMutation = trpc.portal.changePassword.useMutation({
    onSuccess: () => {
      // Update member info to remove requirePasswordChange
      if (member) {
        const updated = { ...member, requirePasswordChange: false };
        localStorage.setItem("portal_member", JSON.stringify(updated));
      }
      setSuccess(true);
      // Redirect after showing success message
      setTimeout(() => {
        setLocation("/portal");
      }, 1500);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 4) {
      setError("パスワードは4文字以上で入力してください。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません。");
      return;
    }
    if (!isForced && currentPassword.length === 0) {
      setError("現在のパスワードを入力してください。");
      return;
    }
    changeMutation.mutate({
      token: token ?? "",
      newPassword,
      ...(!isForced ? { currentPassword } : {}),
    });
  };

  if (!token) return null;

  if (success) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)", fontFamily: "'Noto Sans JP', sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 400, padding: 32, background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 14, background: "#dcfce7", marginBottom: 16 }}>
            <CheckCircle size={28} color="#16a34a" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>
            パスワードを変更しました
          </h1>
          <p style={{ fontSize: 13, color: "#888" }}>
            ポータルに戻ります...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)", fontFamily: "'Noto Sans JP', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: 32, background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        {/* Back button (only shown when not forced) */}
        {!isForced && (
          <button
            onClick={() => setLocation("/portal")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 0",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              color: "#888",
              marginBottom: 12,
            }}
          >
            <ArrowLeft size={16} />
            ポータルに戻る
          </button>
        )}

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 14, background: isForced ? "#fff3cd" : "#e0f2fe", marginBottom: 16 }}>
            <Lock size={28} color={isForced ? "#b45309" : "#0284c7"} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
            パスワード変更
          </h1>
          <p style={{ fontSize: 13, color: "#888" }}>
            {isForced
              ? "初回ログインのため、パスワードを変更してください"
              : "新しいパスワードを入力してください"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {!isForced && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 6 }}>
                現在のパスワード
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="現在のパスワード"
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" }}
                required
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 6 }}>
              新しいパスワード
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="4文字以上"
                style={{ width: "100%", padding: "10px 40px 10px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" }}
                required
                minLength={4}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "#888" }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 6 }}>
              パスワード確認
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="もう一度入力"
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={changeMutation.isPending}
            style={{
              width: "100%",
              padding: "12px 0",
              background: changeMutation.isPending ? "#94a3b8" : "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: changeMutation.isPending ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Lock size={18} />
            {changeMutation.isPending ? "変更中..." : "パスワードを変更"}
          </button>
        </form>
      </div>
    </div>
  );
}
