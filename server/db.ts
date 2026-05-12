import { eq, and, desc, sql, inArray, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  InsertUser, users,
  members, InsertMember, Member,
  events, InsertEvent,
  transactions, InsertTransaction,
  settlements, InsertSettlement,
  auditLogs, InsertAuditLog,
  eventAttendance, InsertEventAttendance,
  systemSettings, InsertSystemSetting,
  registerTransactions, InsertRegisterTransaction,
  memberNotifications, InsertMemberNotification,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: Database.Database | null = null;

function resolveDbFile(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return path.resolve("./data.sqlite");
  const stripped = raw.replace(/^sqlite:/, "");
  return path.isAbsolute(stripped) ? stripped : path.resolve(stripped);
}

export async function getDb() {
  if (!_db) {
    try {
      const file = resolveDbFile();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      _sqlite = new Database(file);
      _sqlite.pragma("journal_mode = WAL");
      _sqlite.pragma("foreign_keys = ON");
      _db = drizzle(_sqlite);
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      throw error;
    }
  }
  return _db;
}

// ─── Users ───
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Members ───
export async function listMembers(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const conditions = activeOnly ? eq(members.isActive, true) : undefined;
  return db.select().from(members).where(conditions).orderBy(members.memberNumber);
}

export async function getMemberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(members).where(eq(members.id, id)).limit(1);
  return result[0];
}

export async function getMemberByNumber(memberNumber: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(members).where(eq(members.memberNumber, memberNumber)).limit(1);
  return result[0];
}

export async function createMember(data: InsertMember) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // 同じ会員番号の非アクティブレコードが存在する場合は再有効化して上書き
  const existing = await db.select().from(members).where(
    and(eq(members.memberNumber, data.memberNumber!), eq(members.isActive, false))
  ).limit(1);
  if (existing.length > 0) {
    await db.update(members).set({
      ...data,
      isActive: true,
      requirePasswordChange: true,
      password: null,
    }).where(eq(members.id, existing[0].id));
    return existing[0].id;
  }
  const result = await db.insert(members).values(data).returning({ id: members.id });
  return result[0].id;
}

export async function updateMember(id: number, data: Partial<InsertMember>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(members).set(data).where(eq(members.id, id));
}

export async function deleteMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(members).set({ isActive: false }).where(eq(members.id, id));
}

export async function bulkUpsertMembers(dataList: InsertMember[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (dataList.length === 0) return;
  // Insert in batches of 50 to avoid query size limits
  for (let i = 0; i < dataList.length; i += 50) {
    const batch = dataList.slice(i, i + 50);
    await db.insert(members).values(batch).onConflictDoUpdate({
      target: members.memberNumber,
      set: {
        displayName: sql`excluded.displayName`,
        tradeName: sql`excluded.tradeName`,
        representative: sql`excluded.representative`,
        invoiceNumber: sql`excluded.invoiceNumber`,
        antiquePermitNumber: sql`excluded.antiquePermitNumber`,
        sellCommissionRate: sql`excluded.sellCommissionRate`,
        buyCommissionRate: sql`excluded.buyCommissionRate`,
        phone: sql`excluded.phone`,
        mobile: sql`excluded.mobile`,
        email: sql`excluded.email`,
        postalCode: sql`excluded.postalCode`,
        prefecture: sql`excluded.prefecture`,
        address: sql`excluded.address`,
      },
    });
  }
}

// ─── Events ───
export async function listEvents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(events).orderBy(desc(events.eventDate));
}

export async function getEventById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return result[0];
}

export async function createEvent(data: InsertEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(events).values(data).returning({ id: events.id });
  return result[0].id;
}

export async function updateEvent(id: number, data: Partial<InsertEvent>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(events).set(data).where(eq(events.id, id));
}

export async function deleteEventCascade(eventId: number) {
  const db = await getDb();
  if (!db || !_sqlite) throw new Error("DB not available");

  const tx = _sqlite.transaction(() => {
    // Related rows first
    db.delete(registerTransactions).where(eq(registerTransactions.eventId, eventId)).run();
    db.delete(settlements).where(eq(settlements.eventId, eventId)).run();
    db.delete(transactions).where(eq(transactions.eventId, eventId)).run();
    db.delete(eventAttendance).where(eq(eventAttendance.eventId, eventId)).run();
    // Finally the event itself
    db.delete(events).where(eq(events.id, eventId)).run();
  });

  tx();
}

// ─── Event Attendance (出欠管理) ───
export async function listAttendance(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventAttendance).where(eq(eventAttendance.eventId, eventId)).orderBy(eventAttendance.memberId);
}

export async function getAttendance(eventId: number, memberId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(eventAttendance)
    .where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.memberId, memberId)))
    .limit(1);
  return result[0];
}

export async function upsertAttendance(eventId: number, memberId: number, isPresent: boolean, isFeeExempt?: boolean, companionCount?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getAttendance(eventId, memberId);
  if (existing) {
    const updateData: any = { isPresent, checkedInAt: isPresent ? new Date() : null };
    if (isFeeExempt !== undefined) updateData.isFeeExempt = isFeeExempt;
    if (companionCount !== undefined) updateData.companionCount = companionCount;
    await db.update(eventAttendance)
      .set(updateData)
      .where(eq(eventAttendance.id, existing.id));
  } else {
    await db.insert(eventAttendance).values({
      eventId,
      memberId,
      isPresent,
      isFeeExempt: isFeeExempt ?? false,
      companionCount: companionCount ?? 0,
      checkedInAt: isPresent ? new Date() : null,
    });
  }
}

export async function updateCompanionCount(eventId: number, memberId: number, companionCount: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getAttendance(eventId, memberId);
  if (existing) {
    await db.update(eventAttendance)
      .set({ companionCount })
      .where(eq(eventAttendance.id, existing.id));
  }
}

export async function updateFeeExempt(eventId: number, memberId: number, isFeeExempt: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getAttendance(eventId, memberId);
  if (existing) {
    await db.update(eventAttendance)
      .set({ isFeeExempt })
      .where(eq(eventAttendance.id, existing.id));
  }
}

export async function updateFeeCollected(eventId: number, memberId: number, feeCollected: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getAttendance(eventId, memberId);
  if (existing) {
    await db.update(eventAttendance)
      .set({ feeCollected })
      .where(eq(eventAttendance.id, existing.id));
  }
}

// 取引発生時に会員を受付（出席）扱いにする。
// - 受付レコードが無い場合: 新規作成（出席・未徴収）
// - isPresent=false の場合: 出席に昇格（参加費免除/徴収状態は既存値を保持）
// - 既に isPresent=true の場合: 何もしない（手入力の状態を尊重）
export async function ensureAttendanceFromTransaction(eventId: number, memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getAttendance(eventId, memberId);
  if (existing) {
    if (existing.isPresent) return { created: false as const, updated: false as const };
    await db.update(eventAttendance)
      .set({
        isPresent: true,
        checkedInAt: new Date(),
      })
      .where(eq(eventAttendance.id, existing.id));
    return { created: false as const, updated: true as const };
  }
  await db.insert(eventAttendance).values({
    eventId,
    memberId,
    isPresent: true,
    isFeeExempt: false,
    companionCount: 0,
    feeCollected: false,
    checkedInAt: new Date(),
  });
  return { created: true as const, updated: false as const };
}

export async function bulkInitAttendance(eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Get all active members
  const allMembers = await listMembers(true);
  // Get existing attendance records
  const existing = await listAttendance(eventId);
  const existingMemberIds = new Set(existing.map(a => a.memberId));
  // Insert only new members (default: absent)
  const newRecords = allMembers
    .filter(m => !existingMemberIds.has(m.id))
    .map(m => ({
      eventId,
      memberId: m.id,
      isPresent: false,
    }));
  if (newRecords.length > 0) {
    for (let i = 0; i < newRecords.length; i += 50) {
      const batch = newRecords.slice(i, i + 50);
      await db.insert(eventAttendance).values(batch);
    }
  }
  return { initialized: newRecords.length, existing: existing.length };
}

export async function deleteAttendanceByEvent(eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(eventAttendance).where(eq(eventAttendance.eventId, eventId));
}

// ─── Transactions ───
export async function listTransactions(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions)
    .where(and(eq(transactions.eventId, eventId), eq(transactions.isDeleted, false)))
    .orderBy(transactions.rowNumber);
}

export async function getTransactionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return result[0];
}

export async function createTransaction(data: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(transactions).values(data).returning({ id: transactions.id });
  return result[0].id;
}

export async function bulkCreateTransactions(dataList: InsertTransaction[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (dataList.length === 0) return;
  await db.insert(transactions).values(dataList);
}

export async function updateTransaction(id: number, data: Partial<InsertTransaction>, expectedVersion: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.update(transactions)
    .set({ ...data, version: expectedVersion + 1 })
    .where(and(eq(transactions.id, id), eq(transactions.version, expectedVersion)));
  // better-sqlite3のrun結果はchangesフィールドに影響行数が入る
  return (result as any).changes ?? 0;
}

export async function softDeleteTransaction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(transactions).set({ isDeleted: true }).where(eq(transactions.id, id));
}

// ─── Settlements ───
export async function listSettlements(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(settlements).where(eq(settlements.eventId, eventId)).orderBy(settlements.memberId);
}

export async function getSettlementById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(settlements).where(eq(settlements.id, id)).limit(1);
  return result[0];
}

export async function getSettlementsByMember(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    settlement: settlements,
    event: events,
  }).from(settlements)
    .innerJoin(events, eq(settlements.eventId, events.id))
    .where(eq(settlements.memberId, memberId))
    .orderBy(desc(events.eventDate));
}

export async function createSettlement(data: InsertSettlement) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(settlements).values(data).returning({ id: settlements.id });
  return result[0].id;
}

export async function bulkCreateSettlements(dataList: InsertSettlement[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (dataList.length === 0) return;
  await db.insert(settlements).values(dataList);
}

export async function deleteSettlement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(settlements).where(eq(settlements.id, id));
}

export async function updateSettlement(id: number, data: Partial<InsertSettlement>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(settlements).set(data).where(eq(settlements.id, id));
}

export async function deleteSettlementsByEvent(eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(settlements).where(eq(settlements.eventId, eventId));
}

// ─── Audit Logs ───
export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function listAuditLogs(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);
}

// ─── System Settings ───
export async function getSetting(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, key)).limit(1);
  return result[0];
}

export async function getAllSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemSettings).orderBy(systemSettings.settingKey);
}

export async function upsertSetting(key: string, value: string | null, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getSetting(key);
  if (existing) {
    await db.update(systemSettings)
      .set({ settingValue: value, ...(description !== undefined ? { description } : {}) })
      .where(eq(systemSettings.settingKey, key));
  } else {
    await db.insert(systemSettings).values({
      settingKey: key,
      settingValue: value,
      description: description ?? null,
    });
  }
}

export async function deleteSetting(key: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(systemSettings).where(eq(systemSettings.settingKey, key));
}

// ─── Register Transactions ───
export async function createRegisterTransaction(data: InsertRegisterTransaction) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(registerTransactions).values(data).returning({ id: registerTransactions.id });
  return result[0].id;
}

export async function listRegisterTransactions(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(registerTransactions)
    .where(eq(registerTransactions.eventId, eventId))
    .orderBy(registerTransactions.processedAt);
}

export async function getRegisterTransactionBySettlement(settlementId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(registerTransactions)
    .where(eq(registerTransactions.settlementId, settlementId))
    .limit(1);
  return result[0];
}

export async function deleteRegisterTransaction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(registerTransactions).where(eq(registerTransactions.id, id));
}

export async function deleteRegisterTransactionsByEvent(eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(registerTransactions).where(eq(registerTransactions.eventId, eventId));
}

// ─── Member Notifications ───
export async function createMemberNotification(data: InsertMemberNotification) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(memberNotifications).values(data).returning({ id: memberNotifications.id });
  return result[0].id;
}

export async function bulkCreateMemberNotifications(dataList: InsertMemberNotification[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (dataList.length === 0) return;
  for (let i = 0; i < dataList.length; i += 50) {
    const batch = dataList.slice(i, i + 50);
    await db.insert(memberNotifications).values(batch);
  }
}

export async function listMemberNotifications(memberId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memberNotifications)
    .where(eq(memberNotifications.memberId, memberId))
    .orderBy(desc(memberNotifications.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(memberId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(memberNotifications)
    .where(and(eq(memberNotifications.memberId, memberId), eq(memberNotifications.isRead, false)));
  return result?.count ?? 0;
}

export async function markNotificationRead(id: number, memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(memberNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(memberNotifications.id, id), eq(memberNotifications.memberId, memberId)));
}

export async function markAllNotificationsRead(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(memberNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(memberNotifications.memberId, memberId), eq(memberNotifications.isRead, false)));
}

// ─── Dashboard KPIs ───
export async function getDashboardStats(eventDate?: string) {
  const db = await getDb();
  if (!db) return { totalMembers: 0, todayTransactions: 0, todayTotal: 0, openEvents: 0 };

  // 空き番号を除外し、アクティブな会員のみカウント
  const [memberCount] = await db.select({ count: sql<number>`count(*)` }).from(members).where(eq(members.isActive, true));

  const [openEventCount] = await db.select({ count: sql<number>`count(*)` }).from(events).where(eq(events.status, "open"));

  let todayTxCount = 0;
  let todayTotal = 0;
  if (eventDate) {
    const evts = await db.select().from(events).where(eq(events.eventDate, eventDate));
    if (evts.length > 0) {
      const eventIds = evts.map(e => e.id);
      const [txStats] = await db.select({
        count: sql<number>`count(*)`,
        total: sql<number>`COALESCE(SUM(totalPrice), 0)`,
      }).from(transactions).where(and(
        inArray(transactions.eventId, eventIds),
        eq(transactions.isDeleted, false)
      ));
      todayTxCount = txStats?.count ?? 0;
      todayTotal = txStats?.total ?? 0;
    }
  }

  return {
    totalMembers: memberCount?.count ?? 0,
    todayTransactions: todayTxCount,
    todayTotal,
    openEvents: openEventCount?.count ?? 0,
  };
}

// イベント別売上推移データ取得（直近N件のイベント）
export async function getEventSalesTrend(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  const evtList = await db
    .select({
      id: events.id,
      eventDate: events.eventDate,
      title: events.title,
      status: events.status,
    })
    .from(events)
    .orderBy(sql`${events.eventDate} DESC`)
    .limit(limit);

  if (evtList.length === 0) return [];

  const eventIds = evtList.map((e) => e.id);

  // 各イベントの取引件数・売上合計・出席者数を集計
  const txStats = await db
    .select({
      eventId: transactions.eventId,
      txCount: sql<number>`count(*)`,
      totalSales: sql<number>`COALESCE(SUM(totalPrice), 0)`,
    })
    .from(transactions)
    .where(and(inArray(transactions.eventId, eventIds), eq(transactions.isDeleted, false)))
    .groupBy(transactions.eventId);

  const attendStats = await db
    .select({
      eventId: eventAttendance.eventId,
      presentCount: sql<number>`SUM(CASE WHEN isPresent = 1 THEN 1 ELSE 0 END)`,
      totalCount: sql<number>`count(*)`,
    })
    .from(eventAttendance)
    .where(inArray(eventAttendance.eventId, eventIds))
    .groupBy(eventAttendance.eventId);

  const txMap = new Map(txStats.map((t) => [t.eventId, t]));
  const attendMap = new Map(attendStats.map((a) => [a.eventId, a]));

  return evtList
    .map((ev) => {
      const tx = txMap.get(ev.id);
      const att = attendMap.get(ev.id);
      return {
        eventId: ev.id,
        eventDate: ev.eventDate,
        title: ev.title ?? "",
        status: ev.status,
        transactionCount: tx?.txCount ?? 0,
        totalSales: tx?.totalSales ?? 0,
        presentCount: att?.presentCount ?? 0,
        totalMembers: att?.totalCount ?? 0,
      };
    })
    .reverse(); // 古い順に並べ替え（グラフ表示用）
}

// ── 商品名候補取得（オートコンプリート用） ──
export async function getItemNameSuggestions(query: string, limit: number = 20): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ itemName: transactions.itemName })
    .from(transactions)
    .where(like(transactions.itemName, `%${query}%`))
    .groupBy(transactions.itemName)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);
  return rows.map((r) => r.itemName);
}

// ── よく使う商品名一覧（使用頻度順） ──
export async function getFrequentItemNames(limit: number = 50): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ itemName: transactions.itemName })
    .from(transactions)
    .groupBy(transactions.itemName)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);
  return rows.map((r) => r.itemName);
}
