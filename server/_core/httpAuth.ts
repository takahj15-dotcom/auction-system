import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type AuthenticatedRequest = Request & {
  authUser?: User;
  portalMemberId?: number;
};

function getQueryToken(req: Request): string | null {
  const value = req.query.token;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function decodePortalToken(token: string): { memberId: number } | null {
  try {
    const decoded = jwt.verify(token, ENV.cookieSecret) as { memberId?: unknown; type?: unknown };
    if (decoded.type !== "member") return null;
    if (typeof decoded.memberId !== "number") return null;
    return { memberId: decoded.memberId };
  } catch {
    return null;
  }
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    req.authUser = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// 管理画面 cookie セッション、または会員ポータル token (?token=) のどちらかを許容する。
// 個別ハンドラで `req.authUser` (管理者) または `req.portalMemberId` (会員) を見て
// アクセス対象リソースの所有確認を行うこと。
export async function requireSessionOrPortalToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await sdk.authenticateRequest(req);
    req.authUser = user;
    next();
    return;
  } catch {
    // cookie 認証失敗 → portal token を試行
  }

  const token = getQueryToken(req);
  const decoded = token ? decodePortalToken(token) : null;
  if (decoded) {
    req.portalMemberId = decoded.memberId;
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}
