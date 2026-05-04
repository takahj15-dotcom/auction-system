import rateLimit, { type Options } from "express-rate-limit";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

// 認証経路 (会員ポータルログイン / OAuth コールバック) 向け。
// 4桁パスワードのブルートフォース対策として 15分5回に制限する。
// 成功したリクエストはカウントしない（正規ユーザーが連続ログインしても弾かれない）。
export const authRateLimit = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({
      error: "ログイン試行回数が多すぎます。しばらく経ってから再度お試しください。",
    });
  },
} as Partial<Options>);

// 一般 API 経路向けの緩い制限。
// 1分300リクエスト / IP。 通常利用には十分余裕があり、明らかな自動化攻撃のみを弾く。
export const apiRateLimit = rateLimit({
  windowMs: ONE_MINUTE_MS,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "リクエストが多すぎます。しばらく経ってから再度お試しください。",
    });
  },
} as Partial<Options>);
