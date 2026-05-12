# Deploy Runbook

Node + persistent volume 環境で本番起動するための最小手順です。

## 必須環境変数

```sh
NODE_ENV=production
JWT_SECRET=<32文字以上のランダム値>
VITE_APP_ID=<OAuthクライアントID>
OAUTH_SERVER_URL=<OAuthサーバURL>
DATABASE_URL=sqlite:/var/lib/auction-system/data.sqlite
UPLOAD_DIR=/var/lib/auction-system/uploads
PORT=3000
```

`JWT_SECRET` は次のように生成できます。

```sh
openssl rand -hex 32
```

## 永続ボリューム

`/var/lib/auction-system` を永続ボリュームとしてマウントしてください。

- `DATABASE_URL` の SQLite ファイル、`-wal`、`-shm`
- `UPLOAD_DIR` 配下の署名画像と印影画像

このディレクトリが揮発領域の場合、再デプロイでデータやアップロードが失われます。

## ビルドと起動

```sh
pnpm install --frozen-lockfile
pnpm rebuild better-sqlite3
pnpm build
pnpm start
```

`pnpm start` は `dist/public/index.html` が存在しない場合、または DB に接続できない場合に失敗します。
`better-sqlite3` の native binding は実行環境ごとに必要です。起動前に次の確認が通ることを確認してください。

```sh
node -e "const Database=require('better-sqlite3'); new Database(':memory:').close(); console.log('better-sqlite3 ok')"
```

## ヘルス確認

起動後に以下を確認してください。

```sh
curl -i http://localhost:${PORT:-3000}/
```

tRPC のヘルスチェック:

```sh
curl "http://localhost:${PORT:-3000}/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D"
```

期待結果は HTTP 200 と `{"ok":true}` を含む JSON です。

## リリース前チェック

```sh
pnpm check
pnpm test
pnpm build
pnpm audit --prod
```

`pnpm audit --prod` の high は 0 件にしてから本番投入してください。moderate / low は内容を確認し、別タスクで計画的に対応します。
