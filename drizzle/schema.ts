import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// 共通ヘルパ: timestamp→integer(unix秒)
const unixTs = (name: string) =>
  integer(name, { mode: "timestamp" });

// ─── Users (OAuth認証ユーザー) ───
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: unixTs("createdAt").default(sql`(unixepoch())`).notNull(),
  updatedAt: unixTs("updatedAt").default(sql`(unixepoch())`).notNull(),
  lastSignedIn: unixTs("lastSignedIn").default(sql`(unixepoch())`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Members (会員マスタ) ───
export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberNumber: integer("memberNumber").notNull().unique(),
  displayName: text("displayName").notNull(),
  tradeName: text("tradeName"),
  representative: text("representative"),
  invoiceNumber: text("invoiceNumber"),
  antiquePermitNumber: text("antiquePermitNumber"),
  antiquePermitPrefecture: text("antiquePermitPrefecture"),
  tradeNameKana: text("tradeNameKana"),
  displayNameKana: text("displayNameKana"),
  // decimalはSQLiteではtextとして保持（既存コードはparseFloatしているので互換性を維持）
  sellCommissionRate: text("sellCommissionRate").notNull().default("10.00"),
  buyCommissionRate: text("buyCommissionRate").notNull().default("5.00"),
  useCustomCommission: integer("useCustomCommission", { mode: "boolean" }).notNull().default(false),
  phone: text("phone"),
  mobile: text("mobile"),
  email: text("email"),
  postalCode: text("postalCode"),
  prefecture: text("prefecture"),
  address: text("address"),
  participationFee: integer("participationFee").notNull().default(0),
  isTaxable: integer("isTaxable", { mode: "boolean" }).notNull().default(true),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  password: text("password"),
  requirePasswordChange: integer("requirePasswordChange", { mode: "boolean" }).notNull().default(true),
  createdAt: unixTs("createdAt").default(sql`(unixepoch())`).notNull(),
  updatedAt: unixTs("updatedAt").default(sql`(unixepoch())`).notNull(),
});

export type Member = typeof members.$inferSelect;
export type InsertMember = typeof members.$inferInsert;

// ─── Events (開催日/イベント) ───
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventDate: text("eventDate").notNull(),
  title: text("title"),
  status: text("status", { enum: ["open", "closed", "settled"] }).default("open").notNull(),
  sellCommissionRate: text("sellCommissionRate").notNull().default("10.00"),
  buyCommissionRate: text("buyCommissionRate").notNull().default("5.00"),
  absentSellCommissionRate: text("absentSellCommissionRate").notNull().default("15.00"),
  absentBuyCommissionRate: text("absentBuyCommissionRate").notNull().default("5.00"),
  participationFee: integer("participationFee").notNull().default(2000),
  companionFee: integer("companionFee").notNull().default(1000),
  notes: text("notes"),
  createdAt: unixTs("createdAt").default(sql`(unixepoch())`).notNull(),
  updatedAt: unixTs("updatedAt").default(sql`(unixepoch())`).notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

// ─── Event Attendance (出欠管理) ───
export const eventAttendance = sqliteTable("event_attendance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("eventId").notNull(),
  memberId: integer("memberId").notNull(),
  isPresent: integer("isPresent", { mode: "boolean" }).notNull().default(false),
  isFeeExempt: integer("isFeeExempt", { mode: "boolean" }).notNull().default(false),
  companionCount: integer("companionCount").notNull().default(0),
  feeCollected: integer("feeCollected", { mode: "boolean" }).notNull().default(false),
  checkedInAt: unixTs("checkedInAt"),
  createdAt: unixTs("createdAt").default(sql`(unixepoch())`).notNull(),
  updatedAt: unixTs("updatedAt").default(sql`(unixepoch())`).notNull(),
});

export type EventAttendance = typeof eventAttendance.$inferSelect;
export type InsertEventAttendance = typeof eventAttendance.$inferInsert;

// ─── Transactions (取引データ) ───
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("eventId").notNull(),
  rowNumber: integer("rowNumber"),
  sellerMemberId: integer("sellerMemberId").notNull(),
  sellerSuffix: text("sellerSuffix"), // 'A' | 'B' | 'C' | null（伝票分割用）
  buyerMemberId: integer("buyerMemberId").notNull(),
  buyerSuffix: text("buyerSuffix"), // 'A' | 'B' | 'C' | null（伝票分割用）
  itemName: text("itemName").notNull(),
  unitPrice: integer("unitPrice").notNull().default(0),
  quantity: integer("quantity").notNull().default(1),
  totalPrice: integer("totalPrice").notNull().default(0),
  transactionType: text("transactionType", { enum: ["normal", "return", "defect"] }).default("normal").notNull(),
  notes: text("notes"),
  version: integer("version").notNull().default(1),
  isDeleted: integer("isDeleted", { mode: "boolean" }).notNull().default(false),
  createdAt: unixTs("createdAt").default(sql`(unixepoch())`).notNull(),
  updatedAt: unixTs("updatedAt").default(sql`(unixepoch())`).notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// ─── Settlements (精算データ) ───
export const settlements = sqliteTable("settlements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("eventId").notNull(),
  memberId: integer("memberId").notNull(),
  suffix: text("suffix"), // 'A' | 'B' | 'C' | null（伝票分割用）
  salesTotal: integer("salesTotal").notNull().default(0),
  salesCommission: integer("salesCommission").notNull().default(0),
  purchaseTotal: integer("purchaseTotal").notNull().default(0),
  purchaseCommission: integer("purchaseCommission").notNull().default(0),
  participationFee: integer("participationFee").notNull().default(0),
  companionCount: integer("companionCount").notNull().default(0),
  companionFee: integer("companionFee").notNull().default(0),
  taxAmount: integer("taxAmount").notNull().default(0),
  salesReturnTotal: integer("salesReturnTotal").notNull().default(0),
  purchaseReturnTotal: integer("purchaseReturnTotal").notNull().default(0),
  settlementAmount: integer("settlementAmount").notNull().default(0),
  isSettled: integer("isSettled", { mode: "boolean" }).notNull().default(false),
  settledAt: unixTs("settledAt"),
  settlementType: text("settlementType", { enum: ["interim", "final"] }).default("final").notNull(),
  pdfUrl: text("pdfUrl"),
  createdAt: unixTs("createdAt").default(sql`(unixepoch())`).notNull(),
  updatedAt: unixTs("updatedAt").default(sql`(unixepoch())`).notNull(),
});

export type Settlement = typeof settlements.$inferSelect;
export type InsertSettlement = typeof settlements.$inferInsert;

// ─── Audit Logs (監査ログ) ───
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId"),
  action: text("action").notNull(),
  tableName: text("tableName").notNull(),
  recordId: integer("recordId"),
  // json → textにJSON文字列として格納
  oldValue: text("oldValue", { mode: "json" }),
  newValue: text("newValue", { mode: "json" }),
  ipAddress: text("ipAddress"),
  createdAt: unixTs("createdAt").default(sql`(unixepoch())`).notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── System Settings (システム設定) ───
export const systemSettings = sqliteTable("system_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  settingKey: text("settingKey").notNull().unique(),
  settingValue: text("settingValue"),
  description: text("description"),
  updatedAt: unixTs("updatedAt").default(sql`(unixepoch())`).notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

// ─── Register Transactions (レジ取引記録) ───
export const registerTransactions = sqliteTable("register_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("eventId").notNull(),
  settlementId: integer("settlementId").notNull(),
  memberId: integer("memberId").notNull(),
  memberNumber: integer("memberNumber").notNull(),
  memberName: text("memberName").notNull(),
  depositAmount: integer("depositAmount").notNull().default(0),
  paymentAmount: integer("paymentAmount").notNull().default(0),
  receivedAmount: integer("receivedAmount").notNull().default(0),
  changeAmount: integer("changeAmount").notNull().default(0),
  settlementAmount: integer("settlementAmount").notNull().default(0),
  signatureUrl: text("signatureUrl"),
  processedAt: unixTs("processedAt").default(sql`(unixepoch())`).notNull(),
  createdAt: unixTs("createdAt").default(sql`(unixepoch())`).notNull(),
});

export type RegisterTransaction = typeof registerTransactions.$inferSelect;
export type InsertRegisterTransaction = typeof registerTransactions.$inferInsert;

// ─── Member Notifications (会員通知) ───
export const memberNotifications = sqliteTable("member_notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("memberId").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  type: text("type", { enum: ["settlement", "system", "info"] }).default("info").notNull(),
  linkUrl: text("linkUrl"),
  isRead: integer("isRead", { mode: "boolean" }).notNull().default(false),
  readAt: unixTs("readAt"),
  createdAt: unixTs("createdAt").default(sql`(unixepoch())`).notNull(),
});

export type MemberNotification = typeof memberNotifications.$inferSelect;
export type InsertMemberNotification = typeof memberNotifications.$inferInsert;
