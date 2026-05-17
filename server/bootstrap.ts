import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

/**
 * 起動時に呼ばれる初期化処理:
 * 1. drizzle/ 以下のSQLファイルを順次実行してテーブル作成（存在しなければ）
 * 2. 空であればサンプル会員とサンプルイベントを投入（本番環境ではスキップ）
 */
export async function bootstrapDatabase() {
  // 本番環境ではサンプルデータ（開発用パスワードの会員8件 / デモイベント）を投入しない。
  // NODE_ENV が "production" 以外の場合のみ seed を実行する。
  const allowDemoSeed = process.env.NODE_ENV !== "production";
  const db = await getDb();
  if (!db) {
    throw new Error("[Bootstrap] DB not available; aborting");
  }

  // 1. マイグレーション（簡易版: drizzle/*.sql を全部実行。CREATE TABLE IF NOT EXISTS相当に変換）
  const migrationsDir = path.resolve(process.cwd(), "drizzle");
  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();

  // __drizzle_migrations的なテーブルで実行済みを記録
  await db.run(sql`CREATE TABLE IF NOT EXISTS __migrations (id INTEGER PRIMARY KEY, name TEXT UNIQUE, applied_at INTEGER DEFAULT (unixepoch()))`);
  const applied = new Set<string>(
    (await db.all<{ name: string }>(sql`SELECT name FROM __migrations`)).map((r: any) => r.name)
  );

  for (const file of sqlFiles) {
    if (applied.has(file)) continue;
    const raw = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    // --> statement-breakpoint で区切られた個別ステートメントを実行
    const statements = raw
      .split(/-->\s*statement-breakpoint/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      // CREATE TABLE → CREATE TABLE IF NOT EXISTS に書き換え（安全側）
      const safe = stmt.replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, "CREATE TABLE IF NOT EXISTS ");
      const safeIdx = safe.replace(/CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/gi, "CREATE UNIQUE INDEX IF NOT EXISTS ");
      try {
        await db.run(sql.raw(safeIdx));
      } catch (err: any) {
        // already-exists / 重複カラム系は無視
        const msg = String(err?.message ?? "");
        if (/already exists/i.test(msg)) continue;
        if (/duplicate column name/i.test(msg)) continue;
        console.error(`[Bootstrap] Migration ${file} statement failed:`, err?.message);
      }
    }
    await db.run(sql`INSERT INTO __migrations (name) VALUES (${file})`);
    console.log(`[Bootstrap] Applied migration ${file}`);
  }

  // 2. サンプルデータ投入（会員が0件の場合のみ、かつ本番環境以外）
  const [memberCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.members);
  if (!allowDemoSeed && (memberCount?.count ?? 0) === 0) {
    console.log("[Bootstrap] Skipping sample members seed (NODE_ENV=production)");
  }
  if (allowDemoSeed && (memberCount?.count ?? 0) === 0) {
    console.log("[Bootstrap] Seeding sample members...");
    const defaultPassword = await bcrypt.hash("dev-password", 10);
    const sampleMembers: schema.InsertMember[] = [
      { memberNumber: 1, displayName: "山田商店", tradeName: "山田商店", representative: "山田太郎", phone: "058-111-0001", mobile: "090-1111-0001", email: "yamada@example.com", postalCode: "500-0001", prefecture: "岐阜県", address: "岐阜市本町1-1", sellCommissionRate: "10.00", buyCommissionRate: "5.00", password: defaultPassword, requirePasswordChange: false },
      { memberNumber: 2, displayName: "佐藤リサイクル", tradeName: "佐藤リサイクル", representative: "佐藤花子", phone: "058-222-0002", mobile: "090-2222-0002", email: "sato@example.com", postalCode: "500-0002", prefecture: "岐阜県", address: "岐阜市神田町2-2", sellCommissionRate: "10.00", buyCommissionRate: "5.00", password: defaultPassword, requirePasswordChange: false },
      { memberNumber: 3, displayName: "鈴木骨董", tradeName: "鈴木骨董店", representative: "鈴木一郎", phone: "058-333-0003", mobile: "090-3333-0003", email: "suzuki@example.com", postalCode: "500-0003", prefecture: "岐阜県", address: "岐阜市加納3-3", sellCommissionRate: "10.00", buyCommissionRate: "5.00", invoiceNumber: "T1234567890123", password: defaultPassword, requirePasswordChange: false },
      { memberNumber: 4, displayName: "田中商会", tradeName: "田中商会", representative: "田中次郎", phone: "058-444-0004", mobile: "090-4444-0004", email: "tanaka@example.com", postalCode: "500-0004", prefecture: "岐阜県", address: "岐阜市長良4-4", sellCommissionRate: "10.00", buyCommissionRate: "5.00", password: defaultPassword, requirePasswordChange: false },
      { memberNumber: 5, displayName: "高橋リサイクル", tradeName: "高橋リサイクル", representative: "高橋三郎", phone: "058-555-0005", mobile: "090-5555-0005", email: "takahashi@example.com", postalCode: "500-0005", prefecture: "岐阜県", address: "岐阜市柳津5-5", sellCommissionRate: "10.00", buyCommissionRate: "5.00", password: defaultPassword, requirePasswordChange: false },
      { memberNumber: 6, displayName: "伊藤古物", tradeName: "伊藤古物店", representative: "伊藤四郎", phone: "058-666-0006", mobile: "090-6666-0006", email: "ito@example.com", postalCode: "500-0006", prefecture: "岐阜県", address: "岐阜市則武6-6", sellCommissionRate: "10.00", buyCommissionRate: "5.00", password: defaultPassword, requirePasswordChange: false },
      { memberNumber: 7, displayName: "渡辺商事", tradeName: "渡辺商事", representative: "渡辺五郎", phone: "058-777-0007", mobile: "090-7777-0007", email: "watanabe@example.com", postalCode: "500-0007", prefecture: "岐阜県", address: "岐阜市江崎7-7", sellCommissionRate: "10.00", buyCommissionRate: "5.00", password: defaultPassword, requirePasswordChange: false },
      { memberNumber: 8, displayName: "中村リサイクル", tradeName: "中村リサイクル", representative: "中村六郎", phone: "058-888-0008", mobile: "090-8888-0008", email: "nakamura@example.com", postalCode: "500-0008", prefecture: "岐阜県", address: "岐阜市島8-8", sellCommissionRate: "10.00", buyCommissionRate: "5.00", password: defaultPassword, requirePasswordChange: false },
    ];
    await db.insert(schema.members).values(sampleMembers);
  }

  // サンプルイベント（本番環境ではスキップ）
  const [eventCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.events);
  if (allowDemoSeed && (eventCount?.count ?? 0) === 0) {
    console.log("[Bootstrap] Seeding sample event...");
    const today = new Date().toISOString().slice(0, 10);
    await db.insert(schema.events).values({
      eventDate: today,
      title: "岐阜リサイクルオークション（デモ）",
      status: "open",
      sellCommissionRate: "10.00",
      buyCommissionRate: "5.00",
      absentSellCommissionRate: "15.00",
      absentBuyCommissionRate: "5.00",
      participationFee: 2000,
      companionFee: 1000,
      notes: "これはデモ用のサンプルイベントです",
    });
  }

  // システム設定（初期レジ準備金）
  const existing = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.settingKey, "register_initial_fund")).limit(1);
  if (existing.length === 0) {
    await db.insert(schema.systemSettings).values({
      settingKey: "register_initial_fund",
      settingValue: "50000",
      description: "レジの初期準備金額",
    });
  }

  console.log("[Bootstrap] Database ready.");
}
