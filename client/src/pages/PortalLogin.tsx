import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { FileText, LogIn, Eye, EyeOff, HelpCircle, X } from "lucide-react";

export default function PortalLogin() {
  const [, setLocation] = useLocation();
  const [memberNumber, setMemberNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const loginMutation = trpc.portal.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("portal_token", data.token);
      localStorage.setItem("portal_member", JSON.stringify(data.member));
      if (data.member.requirePasswordChange) {
        setLocation("/portal/change-password");
      } else {
        setLocation("/portal");
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const num = parseInt(memberNumber);
    if (isNaN(num)) {
      setError("会員番号を数字で入力してください。");
      return;
    }
    loginMutation.mutate({ memberNumber: num, password });
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)", fontFamily: "'Noto Sans JP', sans-serif", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 400, padding: 32, background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 14, background: "#e8f5e9", marginBottom: 16 }}>
            <FileText size={28} color="#2e7d32" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
            会員ポータル
          </h1>
          <p style={{ fontSize: 13, color: "#888" }}>
            岐阜リサイクルオークション
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 6 }}>
              会員番号
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={memberNumber}
              onChange={(e) => setMemberNumber(e.target.value)}
              placeholder="例: 1"
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" }}
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 6 }}>
              パスワード
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                style={{ width: "100%", padding: "10px 40px 10px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" }}
                required
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

          <button
            type="submit"
            disabled={loginMutation.isPending}
            style={{
              width: "100%",
              padding: "12px 0",
              background: loginMutation.isPending ? "#94a3b8" : "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: loginMutation.isPending ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <LogIn size={18} />
            {loginMutation.isPending ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            style={{
              background: "none",
              border: "none",
              color: "#2563eb",
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            <HelpCircle size={14} />
            パスワードを忘れた方
          </button>
        </div>

        {showHelp && (
          <div style={{
            marginTop: 12,
            padding: "14px 16px",
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: 8,
            fontSize: 13,
            color: "#1e40af",
            lineHeight: 1.7,
            position: "relative",
          }}>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
            >
              <X size={14} />
            </button>
            <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
              パスワードの再設定方法
            </p>
            <p style={{ marginBottom: 8 }}>
              パスワードを忘れた場合は、<strong>オークション管理者</strong>にご連絡ください。
              管理者がパスワードを初期値（<strong>0000</strong>）にリセットいたします。
            </p>
            <p style={{ marginBottom: 8 }}>
              リセット後、初期パスワード <strong>0000</strong> でログインすると、
              新しいパスワードの設定画面が表示されます。
            </p>
            <div style={{
              marginTop: 10,
              padding: "10px 12px",
              background: "#fff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
            }}>
              <p style={{ fontWeight: 600, fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                再設定の手順
              </p>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#475569" }}>
                <li>管理者にパスワードリセットを依頼</li>
                <li>初期パスワード「0000」でログイン</li>
                <li>新しいパスワードを設定</li>
              </ol>
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", marginTop: 16 }}>
          初期パスワードは「0000」です
        </p>
      </div>
    </div>
  );
}
