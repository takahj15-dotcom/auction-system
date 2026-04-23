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

// ───────────────────────────────────────────────────────
// Post-sync cleanup: register_transactions の重複/orphan を解消
// （同じ会員×同イベントに複数 rt がある場合、現 settlement を
//  指す rt のみ残して他を削除する）
// ───────────────────────────────────────────────────────
console.log('\n=== Post-sync cleanup: register_transactions dedup ===');
const eventIds = sqlite.prepare('SELECT DISTINCT eventId FROM register_transactions').all().map(r => r.eventId);
let totalRemoved = 0, totalFixed = 0;

for (const eid of eventIds) {
  const settlements = sqlite.prepare('SELECT id, memberId FROM settlements WHERE eventId=?').all(eid);
  const correctMap = new Map(settlements.map(s => [s.memberId, s.id]));

  const rts = sqlite.prepare(
    'SELECT id, memberId, settlementId, processedAt FROM register_transactions WHERE eventId=? ORDER BY memberId, processedAt DESC'
  ).all(eid);

  const byMember = new Map();
  for (const rt of rts) {
    if (!byMember.has(rt.memberId)) byMember.set(rt.memberId, []);
    byMember.get(rt.memberId).push(rt);
  }

  const toDelete = [];
  for (const [memberId, memberRts] of byMember) {
    if (memberRts.length === 1 && correctMap.has(memberId) && memberRts[0].settlementId === correctMap.get(memberId)) continue;

    const correctSid = correctMap.get(memberId);
    if (!correctSid) continue; // settlement が無ければ触らない

    const matching = memberRts.filter(r => r.settlementId === correctSid);
    if (matching.length >= 1) {
      matching.sort((a, b) => b.processedAt - a.processedAt);
      const keep = matching[0];
      for (const r of memberRts) if (r.id !== keep.id) toDelete.push(r.id);
    } else {
      // どの rt も現 settlement を指さない → 最新を残して settlementId を修復
      const latest = memberRts[0];
      sqlite.prepare('UPDATE register_transactions SET settlementId=? WHERE id=?').run(correctSid, latest.id);
      totalFixed++;
      for (const r of memberRts) if (r.id !== latest.id) toDelete.push(r.id);
    }
  }

  if (toDelete.length > 0) {
    const del = sqlite.prepare('DELETE FROM register_transactions WHERE id=?');
    const tx = sqlite.transaction((ids) => { for (const id of ids) del.run(id); });
    tx(toDelete);
    totalRemoved += toDelete.length;
  }
}

if (totalRemoved > 0 || totalFixed > 0) {
  console.log(`重複削除: ${totalRemoved} 件 / settlementId 修復: ${totalFixed} 件`);
} else {
  console.log('重複・orphan なし（クリーンな状態）');
}

sqlite.close();
console.log(`\n✅ 完了。合計 ${grandTotal} 行を同期しました。`);
