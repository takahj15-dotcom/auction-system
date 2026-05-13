import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { RequestHandler } from "express";

// ─── helmet: 標準的なセキュリティHTTPヘッダ ───
// CSPは Vite/HMR と衝突するので明示的に無効化（必要なら本番ビルド側で別途設定）
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "same-site" },
});

// ─── ログイン専用レートリミッタ ───
// 同一IPからのログイン試行を 15分間で 20回までに制限（ブルートフォース対策）
// 100名同時ログインの正常シナリオは別々のIPなので影響なし
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  message: {
    error: {
      json: {
        message: "ログイン試行回数が上限に達しました。しばらく待ってから再度お試しください。",
        code: -32600,
        data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 },
      },
    },
  },
});

// ─── 一般APIレートリミッタ（DoS緩和） ───
// 同一IPから 1分間で 600リクエストまで（通常利用では到達しない）
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
});
