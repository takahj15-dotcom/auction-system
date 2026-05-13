// Portal 負荷テスト: 100名同時接続シミュレーション
// シナリオ: 各仮想ユーザがログイン → myProfile → mySettlements → myLiveTransactions を順次実行
// 100別IPから来る現実的なシナリオを再現するため X-Forwarded-For をユーザごとに分ける
// （TRUST_PROXY=1 でサーバ起動時のみ有効）
import { performance } from "node:perf_hooks";

const BASE = process.env.BASE_URL || "http://localhost:53732";
const CONCURRENT = parseInt(process.env.CONCURRENT || "100");
const MEMBER_NUMBER = 1;
const PASSWORD = "0000";

const stats = { login: [], profile: [], settlements: [], live: [] };
const errors = { login: 0, profile: 0, settlements: 0, live: 0 };
let rateLimited = 0;

function fakeIp(i) {
  // 10.0.x.x のプライベート空間で 100 ユーザ分のユニークIPを作る
  return `10.0.${Math.floor(i / 256)}.${i % 256}`;
}

async function trpcPost(endpoint, payload, ip) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/api/trpc/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify({ json: payload }),
  });
  const dt = performance.now() - t0;
  if (res.status === 429) { rateLimited++; throw new Error("rate-limited"); }
  const body = await res.json();
  if (body.error) throw new Error(`${endpoint}: ${body.error.json?.message || "error"}`);
  return { data: body.result.data.json, dt };
}

async function trpcGet(endpoint, payload, ip) {
  const t0 = performance.now();
  const input = encodeURIComponent(JSON.stringify({ json: payload }));
  const res = await fetch(`${BASE}/api/trpc/${endpoint}?input=${input}`, {
    headers: { "X-Forwarded-For": ip },
  });
  const dt = performance.now() - t0;
  if (res.status === 429) { rateLimited++; throw new Error("rate-limited"); }
  const body = await res.json();
  if (body.error) throw new Error(`${endpoint}: ${body.error.json?.message || "error"}`);
  return { data: body.result.data.json, dt };
}

async function virtualUser(i) {
  const ip = fakeIp(i);
  try {
    const { data: loginData, dt: tLogin } = await trpcPost("portal.login",
      { memberNumber: MEMBER_NUMBER, password: PASSWORD }, ip);
    stats.login.push(tLogin);
    const token = loginData.token;

    try { stats.profile.push((await trpcGet("portal.myProfile", { token }, ip)).dt); }
    catch { errors.profile++; }

    try { stats.settlements.push((await trpcGet("portal.mySettlements", { token }, ip)).dt); }
    catch { errors.settlements++; }

    try { stats.live.push((await trpcGet("portal.myLiveTransactions", { token }, ip)).dt); }
    catch { errors.live++; }
  } catch {
    errors.login++;
  }
}

function pct(arr, p) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
function fmt(arr) {
  if (!arr.length) return "no data";
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return `n=${arr.length} avg=${avg.toFixed(0)}ms p50=${pct(arr, 50).toFixed(0)}ms p95=${pct(arr, 95).toFixed(0)}ms max=${Math.max(...arr).toFixed(0)}ms`;
}

console.log(`\n=== Portal 負荷テスト: ${CONCURRENT}並列（別IPシミュレート） ===`);
const startTotal = performance.now();
await Promise.all(Array.from({ length: CONCURRENT }, (_, i) => virtualUser(i)));
const totalSec = (performance.now() - startTotal) / 1000;

console.log(`\n--- 結果 ---`);
console.log(`総実行時間   : ${totalSec.toFixed(2)}秒`);
console.log(`login        : ${fmt(stats.login)}  errors=${errors.login}`);
console.log(`myProfile    : ${fmt(stats.profile)}  errors=${errors.profile}`);
console.log(`mySettlements: ${fmt(stats.settlements)}  errors=${errors.settlements}`);
console.log(`myLive       : ${fmt(stats.live)}  errors=${errors.live}`);
console.log(`rate-limited(429): ${rateLimited}`);
const totalReqs = stats.login.length + stats.profile.length + stats.settlements.length + stats.live.length;
console.log(`合計リクエスト: ${totalReqs}件 / スループット: ${(totalReqs / totalSec).toFixed(1)} req/sec`);
