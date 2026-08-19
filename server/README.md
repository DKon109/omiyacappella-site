# LINE → サイト自動反映（Cloudflare Worker）

LINEグループでの投稿を、サイトの「企画募集」セクションに自動で反映するための
Webhookサーバーです。

```
LINEグループに #募集 で投稿
        ↓ Webhook
Cloudflare Worker（署名を検証 → 公開対象だけ保存）
        ↓ /projects.json
サイトが読み込んでカードを生成
```

---

## 料金

**月額 ¥0 で運用できます。**

| 項目 | プラン | 月額 |
| --- | --- | --- |
| LINE公式アカウント | コミュニケーションプラン（フリー） | ¥0 |
| Cloudflare Workers | 無料枠（10万リクエスト/日） | ¥0 |
| Cloudflare KV | 無料枠（10万読み取り/日、1,000書き込み/日） | ¥0 |

LINEの料金は**送信（プッシュ配信）通数**で決まります。
このBotは**受信するだけ**で、返信（応答メッセージ）は無料枠の対象外です。
フリープランの200通/月は消費しません。

グループの投稿頻度は、いただいたトーク履歴（2022年12月〜2026年8月、45ヶ月）で
**158件／平均3.5件/月**、最も多かった月でも35件でした。
無料枠に対して4桁の余裕があります。

---

## Botで取得できるもの・できないもの

LINE Messaging API は**メッセージ**しか受け取れません。
ノート・アルバム・投票・イベントはWebhookイベントが存在せず、**取得できません**。

いただいた履歴158件の内訳:

| 種別 | 件数 | Botで取得 |
| --- | ---: | --- |
| 通常のテキスト | 87 | ○ |
| 画像・動画・音源 | 20 | ○ |
| **ノート作成** | **18** | **✕** |
| 入退会・招待 | 13 | ✕ |
| 投票 | 11 | ✕ |
| アルバム・イベント作成・取消 | 9 | ✕ |

**企画の詳細（曲名・パート・日時）はノートに書かれている**ため、
Botだけでは中身が取れません。
そのため「ノートを作ったら、同じ内容をトークにも `#募集` 付きで投稿する」という
運用とセットで使ってください。

---

## 投稿フォーマット

先頭のマーカーで種別が決まります。2行目以降は `キー: 値` で書きます。

```
#募集
曲: サボテンの花 / チューリップ
パート: Lead, Cho ×2, Bass
締切: 2026-09-05
場所: 大宮周辺 スタジオ
本文: 9月の土曜で1日企画バンドやりませんか？
```

| マーカー | 種別 | 初期ステータス |
| --- | --- | --- |
| `#募集` | 企画募集 | 募集中 |
| `#イベント` | イベント | 募集中 |
| `#実施` | 実施 | 成立 |
| `#お知らせ` | お知らせ | — |

使えるキー: `曲`(曲名) / `アーティスト` / `パート`(募集パート) / `締切` / `日時` /
`場所`(練習場所) / `状態` / `本文`。
キーなしの行は本文として扱われます。`曲: A / B` と書くと B がアーティストになります。

**取り消し** — Botが返信するIDを使います。

```
#削除 <ID>
```

---

## 掲載されない情報

設計として、以下は保存も送信もされません。

- **投稿者の名前・userId** — プロフィールAPIを呼ばず、userIdも保存しません。
  サイト上は常に「非公開」と表示されます。
- **マーカーの付いていない投稿** — 一切保存されません。読み捨てます。
- **指定したグループ以外の投稿** — `LINE_GROUP_ID` と一致しないものは無視します。
- **楽譜のURL・ファイル名** — `本文` に書かなければ載りません。

> ⚠️ Botをグループに追加すると、**マーカーの有無に関わらず全メッセージがWebhookに届きます**
> （保存はしませんが、通信自体は発生します）。
> 導入前にメンバーの皆さんへの周知をお願いします。

---

## セットアップ

以下はLINEとCloudflareのアカウント操作を含むため、運営側での作業になります。

### 1. LINE公式アカウントとチャネルを作成

1. [LINE Developers](https://developers.line.biz/console/) にログイン
2. プロバイダーを作成 →「Messaging API」チャネルを作成
   （既存のLINE公式アカウントがあれば、それを紐づけてもOK）
3. **Messaging API設定** タブで:
   - チャネルアクセストークン（長期）を発行 → 控える
   - 応答メッセージ: **オフ**、Webhook: **オン**
4. **チャネル基本設定** タブで、チャネルシークレットを控える
5. **LINE Official Account Manager** の 設定 → アカウント設定 で
   「グループトークへの参加を許可する」を**オン**

### 2. Workerをデプロイ

```bash
cd server
npx wrangler login
npx wrangler kv namespace create PROJECTS
```

出力された `id` を `wrangler.toml` の `PUT_YOUR_KV_NAMESPACE_ID_HERE` に貼り、
シークレットを登録します。

```bash
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_ACCESS_TOKEN
npx wrangler deploy
```

### 3. WebhookのURLを登録

デプロイ時に表示される `https://omiyacappella-line.<subdomain>.workers.dev` を、
LINE Developers の **Webhook URL** に設定して「検証」を押します。

### 4. Botをグループに招待し、グループIDを登録

Botを OMIYAcappella のグループに招待したうえで、グループで一度何か発言します。
Workerのログにグループのイベントが流れるので、そこから `groupId` を取得します。

```bash
npx wrangler tail
```

```bash
npx wrangler secret put LINE_GROUP_ID
```

### 5. サイト側をつなぐ

`assets/js/main.js` の `PROJECTS_ENDPOINT` に、WorkerのURLを設定します。

```js
var PROJECTS_ENDPOINT = 'https://omiyacappella-line.<subdomain>.workers.dev/projects.json';
```

空文字のままなら、`index.html` に書かれている既存の一覧がそのまま表示されます
（Workerが落ちても、サイトは壊れません）。

`wrangler.toml` の `ALLOWED_ORIGIN` も、サイトの公開URLに合わせてください。

---

## 動作確認

```bash
curl https://omiyacappella-line.<subdomain>.workers.dev/projects.json
```

グループで `#募集` 付きの投稿をすると、Botが反映完了と削除用IDを返信します。
