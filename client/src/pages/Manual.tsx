import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ClipboardCheck,
  FileSpreadsheet,
  Calculator,
  FileText,
  CreditCard,
  Users,
  Shield,
  Settings as SettingsIcon,
  CheckCircle2,
  ArrowRight,
  Info,
  AlertTriangle,
  Printer,
  PenLine,
  UserCheck,
  Lock,
  RefreshCw,
  Banknote,
} from "lucide-react";

// ────────────────────────────────────────────────────────────────
// 汎用パーツ
// ────────────────────────────────────────────────────────────────

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="flex gap-4 mb-5">
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-green-600 text-white font-bold flex items-center justify-center text-sm">
      {n}
    </div>
    <div className="flex-1">
      <div className="font-semibold text-base mb-1">{title}</div>
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  </div>
);

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-start gap-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded text-sm text-blue-900 my-3">
    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
    <div>{children}</div>
  </div>
);

const Warn = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-start gap-2 p-3 bg-amber-50 border-l-4 border-amber-400 rounded text-sm text-amber-900 my-3">
    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
    <div>{children}</div>
  </div>
);

const ScreenMock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm my-4">
    <div className="bg-gray-100 border-b px-3 py-2 text-xs font-mono text-gray-600 flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-red-400" />
      <span className="w-2 h-2 rounded-full bg-yellow-400" />
      <span className="w-2 h-2 rounded-full bg-green-400" />
      <span className="ml-2">{title}</span>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

// ────────────────────────────────────────────────────────────────
// セクション定義
// ────────────────────────────────────────────────────────────────

type Section = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  color: string;
  render: () => React.ReactNode;
};

// 0. はじめに（全体の流れ）
const IntroSection = () => (
  <div>
    <p className="text-sm leading-7 mb-4">
      本システムは、オークション開催日の <strong>受付 → 取引入力 → 精算処理 → レジ精算 → 最終締め</strong> という一連の流れをサポートします。
      下の図は、1回のイベントで行う作業の全体像です。
    </p>

    <div className="my-6 overflow-x-auto">
      <svg viewBox="0 0 880 200" className="w-full min-w-[720px]">
        {[
          { x: 20, c: "#10b981", label: "①受付", sub: "出席登録" },
          { x: 180, c: "#3b82f6", label: "②取引入力", sub: "売買の記録" },
          { x: 340, c: "#f59e0b", label: "③締め処理", sub: "精算書生成" },
          { x: 500, c: "#8b5cf6", label: "④レジ", sub: "現金精算・サイン" },
          { x: 660, c: "#ef4444", label: "⑤最終締め", sub: "ロック確定" },
        ].map((s, i) => (
          <g key={i}>
            <rect x={s.x} y={60} width={140} height={80} rx={10} fill={s.c} opacity={0.15} stroke={s.c} strokeWidth={2} />
            <text x={s.x + 70} y={95} textAnchor="middle" fontSize={16} fontWeight="bold" fill={s.c}>{s.label}</text>
            <text x={s.x + 70} y={118} textAnchor="middle" fontSize={12} fill="#555">{s.sub}</text>
            {i < 4 && (
              <>
                <line x1={s.x + 140} y1={100} x2={s.x + 178} y2={100} stroke="#999" strokeWidth={2} />
                <polygon points={`${s.x + 178},100 ${s.x + 170},96 ${s.x + 170},104`} fill="#999" />
              </>
            )}
          </g>
        ))}
        <text x={440} y={25} textAnchor="middle" fontSize={14} fill="#333" fontWeight="bold">イベント1回の基本フロー</text>
        <text x={440} y={180} textAnchor="middle" fontSize={11} fill="#777">事前準備: 会員管理 / 各種設定（参加費・同伴者料金・印鑑画像など）</text>
      </svg>
    </div>

    <h3 className="font-bold text-base mt-6 mb-2">このマニュアルの使い方</h3>
    <ul className="text-sm space-y-2 list-disc pl-5 leading-relaxed">
      <li>左の目次から見たい項目を選ぶ、または下部の「次へ」で順に進められます。</li>
      <li>各項目は <strong>概要 → 画面イメージ → 手順 → 補足</strong> の順で構成されています。</li>
      <li>赤枠・オレンジ枠の注意事項は必ず確認してください。</li>
    </ul>

    <Tip>
      初めてお使いの方は <strong>「各種設定」→「会員管理」→「ダッシュボード」</strong> の順に読んでから、実際の運用フロー（受付以降）に進むとスムーズです。
    </Tip>
  </div>
);

// 1. ダッシュボード
const DashboardSection = () => (
  <div>
    <p className="text-sm leading-7 mb-3">
      ホーム画面。イベントを選択・作成し、本日の取引件数・売上サマリーを確認できます。
    </p>

    <ScreenMock title="ダッシュボード">
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-green-50 p-2 rounded border border-green-200">
          <span className="font-semibold text-sm">2026-05-10 第100回オークション</span>
          <Badge className="bg-green-600">選択中</Badge>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: "取引件数", v: "42件", c: "bg-blue-50" },
            { l: "売上合計", v: "¥350,000", c: "bg-green-50" },
            { l: "出席者", v: "18名", c: "bg-amber-50" },
            { l: "精算済み", v: "12/18", c: "bg-purple-50" },
          ].map(x => (
            <div key={x.l} className={`${x.c} rounded p-2 text-center`}>
              <div className="text-xs text-gray-600">{x.l}</div>
              <div className="font-bold">{x.v}</div>
            </div>
          ))}
        </div>
      </div>
    </ScreenMock>

    <Step n={1} title="イベントを作成する">
      「新規イベント作成」ボタン → 開催日・タイトル・参加費・同伴者料金を入力して保存します。
    </Step>
    <Step n={2} title="作業するイベントを選択する">
      一覧から該当イベント行の「選択」をクリック。全画面で選択中のイベントが対象になります。
    </Step>
    <Step n={3} title="進捗を確認する">
      サマリーカードで取引件数・出席者・精算進捗が一目で分かります。
    </Step>
  </div>
);

// 2. 受付
const ReceptionSection = () => (
  <div>
    <p className="text-sm leading-7 mb-3">
      当日の <strong>出席登録・同伴者人数・参加費の徴収方法</strong>（受付現金徴収／精算書徴収／免除）を記録します。
    </p>

    <ScreenMock title="受付画面">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-1 border">番号</th><th className="p-1 border">屋号</th>
            <th className="p-1 border">出席</th><th className="p-1 border">同伴</th>
            <th className="p-1 border">徴収</th>
          </tr>
        </thead>
        <tbody>
          <tr><td className="p-1 border text-center">001</td><td className="p-1 border">山田商店</td>
            <td className="p-1 border text-center"><CheckCircle2 className="inline h-4 w-4 text-green-600" /></td>
            <td className="p-1 border text-center">1名</td>
            <td className="p-1 border text-center"><Badge className="bg-green-600 text-[10px]">受付徴収</Badge></td></tr>
          <tr><td className="p-1 border text-center">002</td><td className="p-1 border">佐藤商事</td>
            <td className="p-1 border text-center"><CheckCircle2 className="inline h-4 w-4 text-green-600" /></td>
            <td className="p-1 border text-center">0名</td>
            <td className="p-1 border text-center"><Badge variant="outline" className="text-[10px]">精算書徴収</Badge></td></tr>
        </tbody>
      </table>
    </ScreenMock>

    <Step n={1} title="出席チェック">会員一覧で出席者の「出席」をONにします。取引が発生した会員は自動で出席扱いになります。</Step>
    <Step n={2} title="同伴者人数を入力">同伴者がいる場合は人数を入力。同伴者料金×人数が自動で加算されます。</Step>
    <Step n={3} title="徴収方法を選ぶ">
      <div className="mt-2 space-y-1">
        <div>🟢 <strong>受付徴収</strong>: 当日現金で受け取り済み</div>
        <div>🔴 <strong>精算書徴収</strong>: 精算書から差し引き</div>
        <div>🟡 <strong>免除</strong>: 参加費を免除（同伴者料金のみ徴収もあり）</div>
      </div>
    </Step>
    <Step n={4} title="出席者一覧を印刷">
      <Printer className="inline h-4 w-4 mr-1" /> 右上の「出席者一覧印刷」ボタン。受付徴収と精算書徴収が左右2段組でA4に印刷されます。
    </Step>
    <Tip>取引入力画面で売買が発生すると、該当会員は自動で出席に昇格します。</Tip>
  </div>
);

// 3. 取引入力
const TransactionsSection = () => (
  <div>
    <p className="text-sm leading-7 mb-3">
      オークションで成立した<strong>売り手・買い手・金額</strong>を1件ずつ記録します。
    </p>

    <ScreenMock title="取引入力">
      <div className="space-y-2 text-sm">
        <div className="flex gap-2 items-center">
          <span className="w-16 text-gray-600">売り手</span>
          <div className="flex-1 border rounded px-2 py-1 bg-gray-50">001 山田商店</div>
        </div>
        <div className="flex gap-2 items-center">
          <span className="w-16 text-gray-600">買い手</span>
          <div className="flex-1 border rounded px-2 py-1 bg-gray-50">002 佐藤商事</div>
        </div>
        <div className="flex gap-2 items-center">
          <span className="w-16 text-gray-600">金額</span>
          <div className="flex-1 border rounded px-2 py-1 bg-gray-50 text-right font-mono">¥15,000</div>
        </div>
        <Button size="sm" className="w-full bg-blue-600">登録</Button>
      </div>
    </ScreenMock>

    <Step n={1} title="売り手・買い手を選択">会員番号か屋号で絞り込み検索できます。</Step>
    <Step n={2} title="金額を入力">数量×単価ではなく、落札金額をそのまま入力します。</Step>
    <Step n={3} title="登録">登録後はすぐに一覧に反映され、取消し・編集も可能です。</Step>
    <Warn>精算書が作成された後でも取引の追加・編集・削除は可能ですが、その場合は「締め処理」画面で<strong>精算を再計算</strong>してください（清算済みの会員は保護されます）。</Warn>
  </div>
);

// 4. 締め処理
const ClosingSection = () => (
  <div>
    <p className="text-sm leading-7 mb-3">
      取引データを集計して<strong>会員ごとの精算書を生成</strong>します。イベントの状態は「オープン→精算済→最終締め」の3段階です。
    </p>

    <div className="my-4 overflow-x-auto">
      <svg viewBox="0 0 640 120" className="w-full min-w-[520px]">
        {[
          { x: 20, c: "#10b981", label: "オープン", sub: "取引入力中" },
          { x: 230, c: "#f59e0b", label: "精算済み", sub: "精算書生成後" },
          { x: 440, c: "#ef4444", label: "最終締め", sub: "ロック完了" },
        ].map((s, i) => (
          <g key={i}>
            <rect x={s.x} y={30} width={170} height={60} rx={8} fill={s.c} opacity={0.15} stroke={s.c} strokeWidth={2} />
            <text x={s.x + 85} y={56} textAnchor="middle" fontSize={15} fontWeight="bold" fill={s.c}>{s.label}</text>
            <text x={s.x + 85} y={76} textAnchor="middle" fontSize={11} fill="#555">{s.sub}</text>
            {i < 2 && (<>
              <line x1={s.x + 170} y1={60} x2={s.x + 208} y2={60} stroke="#999" strokeWidth={2} />
              <polygon points={`${s.x + 208},60 ${s.x + 200},56 ${s.x + 200},64`} fill="#999" />
            </>)}
          </g>
        ))}
      </svg>
    </div>

    <Step n={1} title="全体精算処理を実行">「オープン」状態で実行。全会員の精算書が作られ、状態は「精算済み」になります。</Step>
    <Step n={2} title="途中個別精算（オプション）">
      <UserCheck className="inline h-4 w-4 mr-1" /> イベント進行中でも、特定の会員だけ先に精算書を発行できます。
    </Step>
    <Step n={3} title="取引を修正したら精算を再計算">
      <RefreshCw className="inline h-4 w-4 mr-1" /> 「精算を再計算」ボタン。
      <strong className="text-blue-700">清算済み（サイン取得済み含む）の会員は除外</strong>され、既存の精算書がそのまま保持されます。
    </Step>
    <Step n={4} title="最終締めを実行">
      <Lock className="inline h-4 w-4 mr-1" /> 全員レジ精算完了後に実行。取引がロックされ、修正不可になります。
    </Step>
    <Warn>最終締め後に修正が必要な場合は「最終締めを取消す」で精算済みに戻せます（監査ログに記録されます）。</Warn>
  </div>
);

// 5. 精算書
const SettlementsSection = () => (
  <div>
    <p className="text-sm leading-7 mb-3">
      会員ごとの<strong>売上・買上・差引額・参加費・手数料</strong>を1枚の精算書にまとめます。
    </p>

    <ScreenMock title="精算書詳細">
      <div className="text-xs space-y-1">
        <div className="text-center font-bold text-sm border-b pb-1">精算書 / 001 山田商店</div>
        <div className="grid grid-cols-2 gap-1">
          <div>売上合計</div><div className="text-right font-mono">¥45,000</div>
          <div>買上合計</div><div className="text-right font-mono">¥12,000</div>
          <div>手数料</div><div className="text-right font-mono">¥3,150</div>
          <div>参加費</div><div className="text-right font-mono">¥1,000</div>
          <div className="border-t pt-1 font-bold">差引支払額</div>
          <div className="text-right font-mono border-t pt-1 font-bold">¥28,850</div>
        </div>
      </div>
    </ScreenMock>

    <Step n={1} title="一覧で確認">会員番号順に一覧表示。精算済みは緑色でマーク。</Step>
    <Step n={2} title="個別印刷／一括印刷">各精算書のPDF印刷、または「全会員分を一括印刷」も可能。</Step>
    <Step n={3} title="会員ポータルへ通知">精算書作成時に自動で通知され、会員はスマホから内容を確認できます。</Step>
  </div>
);

// 6. レジ
const RegisterSection = () => (
  <div>
    <p className="text-sm leading-7 mb-3">
      精算書をもとに<strong>現金のやり取り・サイン取得</strong>を行い、1日の締めまで管理します。
    </p>

    <ScreenMock title="レジ画面">
      <div className="text-sm space-y-2">
        <div className="flex justify-between items-center bg-blue-50 p-2 rounded">
          <span>001 山田商店 <Badge variant="outline" className="ml-1 text-[10px]">支払</Badge></span>
          <span className="font-mono font-bold text-blue-700">¥28,850</span>
        </div>
        <div className="flex justify-between items-center bg-green-50 p-2 rounded">
          <span>002 佐藤商事 <Badge className="bg-green-600 ml-1 text-[10px]">受取</Badge></span>
          <span className="font-mono font-bold text-green-700">¥5,400</span>
        </div>
        <div className="flex gap-1">
          <Button size="sm" className="flex-1"><PenLine className="h-3 w-3 mr-1" />サイン</Button>
          <Button size="sm" variant="outline" className="flex-1">完了</Button>
        </div>
      </div>
    </ScreenMock>

    <Step n={1} title="会員を呼び出し">精算書一覧から該当会員をタップ。</Step>
    <Step n={2} title="受領額・お釣りを入力">現金の受取額を入力。お釣りは自動計算されます。</Step>
    <Step n={3} title="サインを取得"><PenLine className="inline h-4 w-4 mr-1" />タブレット上で本人にサインしてもらい、精算完了で確定。</Step>
    <Step n={4} title="レジ締め"><Calculator className="inline h-4 w-4 mr-1" />「レジ締め」で当日の現金残高・精算総額を確認し、最終締めに進みます。</Step>
    <Warn>サイン済みの精算は修正できません。管理者による「レジ精算取消し」のみで巻き戻し可能です（監査ログ記録）。</Warn>
  </div>
);

// 7. 会員管理
const MembersSection = () => (
  <div>
    <p className="text-sm leading-7 mb-3">
      会員の<strong>登録・編集・屋号・ポータル用パスワード</strong>を管理します。
    </p>

    <Step n={1} title="会員を追加">番号・氏名・屋号・連絡先を登録。番号は一意です。</Step>
    <Step n={2} title="表示名と屋号">受付・精算書には屋号が優先表示されます。</Step>
    <Step n={3} title="ポータルパスワード発行">会員がスマホで自分の精算履歴を見るための初期パスワードを発行。</Step>
    <Tip>一括CSVインポート対応。既存システムからの移行にご利用ください。</Tip>
  </div>
);

// 8. 監査ログ
const AuditSection = () => (
  <div>
    <p className="text-sm leading-7 mb-3">
      誰が・いつ・何をしたかをすべて記録。<strong>精算の取消し・編集・最終締め解除</strong>などの重要操作は自動で残ります。
    </p>
    <Step n={1} title="期間で絞り込む">日付範囲・操作種別・ユーザーで検索できます。</Step>
    <Step n={2} title="変更内容を確認">変更前後の値をJSONで保持。不正操作の追跡に利用できます。</Step>
  </div>
);

// 9. 各種設定
const SettingsPageSection = () => (
  <div>
    <p className="text-sm leading-7 mb-3">
      システム全体の共通設定を行います。
    </p>

    <Step n={1} title="イベント管理（削除）">不要になったイベントを削除。関連する取引・精算・レジ記録も一緒に消去されます。</Step>
    <Step n={2} title="印鑑画像">
      <Printer className="inline h-4 w-4 mr-1" /> 精算書PDFに載せる印鑑画像をアップロード（PNG推奨、背景透過）。
    </Step>
    <Step n={3} title="レジ準備金">
      <Banknote className="inline h-4 w-4 mr-1" /> レジに入れておくお釣り用の金額を設定。レジ締めの理論残高計算に使われます。
    </Step>
    <Warn>イベント削除は元に戻せません。確認のため開催日の再入力が必要です。</Warn>
  </div>
);

// ────────────────────────────────────────────────────────────────
// セクション一覧
// ────────────────────────────────────────────────────────────────

const sections: Section[] = [
  { id: "intro", icon: BookOpen, title: "はじめに（全体の流れ）", color: "#16a34a", render: IntroSection },
  { id: "dashboard", icon: LayoutDashboard, title: "ダッシュボード", color: "#0284c7", render: DashboardSection },
  { id: "reception", icon: ClipboardCheck, title: "受付", color: "#10b981", render: ReceptionSection },
  { id: "transactions", icon: FileSpreadsheet, title: "取引入力", color: "#3b82f6", render: TransactionsSection },
  { id: "closing", icon: Calculator, title: "締め処理", color: "#f59e0b", render: ClosingSection },
  { id: "settlements", icon: FileText, title: "精算書", color: "#8b5cf6", render: SettlementsSection },
  { id: "register", icon: CreditCard, title: "レジ", color: "#ec4899", render: RegisterSection },
  { id: "members", icon: Users, title: "会員管理", color: "#6366f1", render: MembersSection },
  { id: "audit", icon: Shield, title: "監査ログ", color: "#64748b", render: AuditSection },
  { id: "settings", icon: SettingsIcon, title: "各種設定", color: "#475569", render: SettingsPageSection },
];

// ────────────────────────────────────────────────────────────────
// ページ本体
// ────────────────────────────────────────────────────────────────

export default function Manual() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const current = sections[currentIdx];
  const Icon = current.icon;
  const progress = useMemo(() => Math.round(((currentIdx + 1) / sections.length) * 100), [currentIdx]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="h-6 w-6 text-green-600" />
        <h1 className="text-2xl font-bold">使い方マニュアル</h1>
        <Badge variant="outline" className="ml-2">全{sections.length}項目</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* 目次 */}
        <div>
          <Card className="p-3 sticky top-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">目次</div>
            <nav className="space-y-1">
              {sections.map((s, i) => {
                const SIcon = s.icon;
                const active = i === currentIdx;
                return (
                  <button
                    key={s.id}
                    onClick={() => setCurrentIdx(i)}
                    className={`w-full text-left px-2 py-2 rounded flex items-center gap-2 text-sm transition ${
                      active ? "bg-green-50 text-green-900 font-semibold" : "hover:bg-gray-100 text-gray-700"
                    }`}
                    style={active ? { borderLeft: `3px solid ${s.color}` } : { borderLeft: "3px solid transparent" }}
                  >
                    <span className="w-5 text-xs text-gray-400 font-mono">{String(i).padStart(2, "0")}</span>
                    <SIcon className="h-4 w-4 flex-shrink-0" style={{ color: s.color }} />
                    <span className="flex-1 truncate">{s.title}</span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-3 px-2">
              <div className="text-[10px] text-muted-foreground mb-1">進捗 {progress}%</div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </Card>
        </div>

        {/* 本文 */}
        <div>
          <Card className="p-6">
            <div
              className="flex items-center gap-3 pb-4 mb-4 border-b-2"
              style={{ borderColor: current.color }}
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ background: current.color + "22" }}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  {currentIdx + 1} / {sections.length}
                </div>
                <h2 className="text-xl font-bold" style={{ color: current.color }}>
                  {current.title}
                </h2>
              </div>
            </div>

            <div className="min-h-[400px]">{current.render()}</div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> 前へ
              </Button>
              <div className="text-sm text-muted-foreground">
                {currentIdx < sections.length - 1 ? (
                  <>次は <strong>{sections[currentIdx + 1].title}</strong></>
                ) : (
                  <span className="text-green-600 font-semibold">
                    <CheckCircle2 className="inline h-4 w-4 mr-1" /> 全項目完了
                  </span>
                )}
              </div>
              <Button
                onClick={() => setCurrentIdx(i => Math.min(sections.length - 1, i + 1))}
                disabled={currentIdx === sections.length - 1}
              >
                次へ <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </Card>

          <div className="text-xs text-muted-foreground text-center mt-4 flex items-center justify-center gap-1">
            <ArrowRight className="h-3 w-3" />
            各機能の詳細操作はサイドバーの該当メニューから実行してください
          </div>
        </div>
      </div>
    </div>
  );
}
