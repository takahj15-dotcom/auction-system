// TiDB → Local SQLite 差分同期（id ベースで不足行を追加）
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';

// 接続情報は環境変数から読み込み。.env に TIDB_URL を設定してください。
// 例: TIDB_URL=mysql://USER:PASS@HOST:4000/DBNAME
import 'dotenv/config';

const TIDB_URL = process.env.TIDB_URL;
if (!TIDB_URL) {
  console.error('❌ TIDB_URL 環境変数が設定されていません。.env に TIDB_URL=mysql://... を設定してください。');
  process.exit(1);
}
const _u = new URL(TIDB_URL);
const TIDB = {
  host: _u.hostname,
  port: parseInt(_u.port) || 4000,
  user: decodeURIComponent(_u.username),
  password: decodeURIComponent(_u.password),
  database: _u.pathname.slice(1),
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
};

// テーブル定義: 列 → 型 ('ts'=Date→unix秒, 'bool'=0/1, その他はそのまま)
const TABLES = {
  transactions: {
    cols: ['id','eventId','rowNumber','sellerMemberId','buyerMemberId','itemName','unitPrice','quantity','totalPrice','transactionType','notes','version','isDeleted','createdAt','updatedAt'],
    ts: ['createdAt','updatedAt'],
    bool: ['isDeleted'],
  },
  register_transactions: {
    cols: ['id','eventId','settlementId','memberId','memberNumber','memberName','depositAmount','paymentAmount','receivedAmount','changeAmount','settlementAmount','signatureUrl','processedAt','createdAt'],
    ts: ['processedAt','createdAt'],
    bool: [],
  },
  event_attendance: {
    cols: ['id','eventId','memberId','isPresent','isFeeExempt','companionCount','feeCollected','checkedInAt','createdAt','updatedAt'],
    ts: ['checkedInAt','createdAt','updatedAt'],
    bool: ['isPresent','isFeeExempt','feeCollected'],
  },
};

function toUnix(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Math.floor(v.getTime() / 1000);
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
  }
  if (typeof v === 'number') return v;
  return null;
}

function toBool(v) {
  if (v === null || v === undefined) return 0;
  return v ? 1 : 0;
}

const sqlite = new Database('./data.sqlite');
const conn = await mysql.createConnection(TIDB);

let grandTotal = 0;
for (const [table, def] of Object.entries(TABLES)) {
  const localIds = new Set(sqlite.prepare(`SELECT id FROM ${table}`).all().map(r => r.id));
  const [rows] = await conn.execute(`SELECT ${def.cols.join(',')} FROM ${table}`);

  const missing = rows.filter(r => !localIds.has(r.id));
  console.log(`[${table}] TiDB=${rows.length}, local=${localIds.size}, 追加対象=${missing.length}`);
  if (missing.length === 0) continue;

  const placeholders = '(' + def.cols.map(() => '?').join(',') + ')';
  const stmt = sqlite.prepare(`INSERT INTO ${table} (${def.cols.join(',')}) VALUES ${placeholders}`);
  const insertMany = sqlite.transaction((items) => {
    for (const row of items) {
      const values = def.cols.map(c => {
        const raw = row[c];
        if (def.ts.includes(c)) return toUnix(raw);
        if (def.bool.includes(c)) return toBool(raw);
        return raw;
      });
      stmt.run(values);
    }
  });
  insertMany(missing);
  grandTotal += missing.length;
  console.log(`  → ${missing.length} 行を挿入しました`);
}

await conn.end();
sqlite.close();
console.log(`\n✅ 完了。合計 ${grandTotal} 行を同期しました。`);
