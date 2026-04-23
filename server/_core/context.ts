import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";

const DEV_OPEN_ID = "dev-admin";

async function ensureDevAdmin(): Promise<User | null> {
  try {
    await db.upsertUser({
      openId: DEV_OPEN_ID,
      name: "開発管理者",
      email: "dev-admin@localhost",
      loginMethod: "dev",
      role: "admin",
      lastSignedIn: new Date(),
    });
    const user = await db.getUserByOpenId(DEV_OPEN_ID);
    return user ?? null;
  } catch (error) {
    console.warn("[Context] Failed to create dev admin user:", error);
    return null;
  }
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }

  // 開発モードでは自動的に管理者ユーザーを作成・ログイン状態にする
  if (!user && process.env.NODE_ENV !== "production") {
    user = await ensureDevAdmin();
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
