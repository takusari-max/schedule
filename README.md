# スケジュール調整アプリ (GAS)

Google Apps Script で動く、複数メンバーの予定をタイムグリッドで横並び表示する Web アプリ。
予定データは Google ドライブ上の **`events.csv`** を参照し、氏名は別スプレッドシート (**電話帳**) からアドレスで引き当てる。

## 機能

- 日付範囲を自由に指定して、複数メンバーの予定をタイムグリッドで可視化
- **予定データは Drive フォルダ上の CSV から取得** (Google カレンダーには直接アクセスしない)
- **氏名は電話帳スプレッドシートからアドレスで自動引き当て**
- メンバーごとの表示／非表示チェックボックス
- 予定 1 件ごとに「内容表示 / 予定あり」を切替（クリック）、設定はスプレッドシートに永続化
- 終日予定はグリッド上部の帯に別表示

## データソース

### events.csv (予定データ)

| 列 | 名称 | 用途 |
| --- | --- | --- |
| A | `calendar_id` | メンバー識別子 (アドレス) |
| B | `start_time` | 開始日時 (ISO 8601 / `YYYY/MM/DD HH:MM:SS` 等) |
| C | `end_time` | 終了日時 |
| D | `event_name` | 予定タイトル |
| E | `author` | 作成者 (未使用) |
| F | `where` | 場所 (未使用) |
| G | `description` | 説明 (未使用) |
| H | `is_free_busy` | (未使用) |
| I | `is_google_plus_event` | (未使用) |
| J | `visibility` | (未使用) |
| K | `published` | (未使用) |
| L | `updated` | (未使用) |
| M | `participants` | (未使用) |

- フォルダ ID (デフォルト): `1BWBFBpOpfgX1ly8n77bad7SF4s16jAzf`
- ファイル名 (デフォルト): `events.csv`
- 列 A (`calendar_id`) 単位でスケジュールを整理し、B/C/D で各予定を描画

### 電話帳スプレッドシート (氏名ルックアップ)

- スプレッドシート ID (デフォルト): `1GbWVn7HZ7fPWpiv2GTdpMXksU-SBzCM0UdAc7Bwb02M`
- I 列のアドレスと events.csv の `calendar_id` を照合し、一致した **F 列** の氏名を表示に用いる
- マッチしない場合はアドレスをそのまま表示

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `appsscript.json` | マニフェスト (タイムゾーン、OAuth スコープ、Web アプリ設定) |
| `Code.gs` | `doGet`, `include`, シートメニュー (`onOpen`) |
| `Api.gs` | クライアント公開関数 (`getConfig` / `getSchedules` / `setMemberVisible` / `setEventShowDetails`) |
| `EventDataService.gs` | CSV からの予定読み込み・整形 |
| `SpreadsheetService.gs` | 設定シート CRUD と電話帳ルックアップ |
| `Index.html` | メイン UI |
| `Stylesheet.html` | CSS (include 経由) |
| `JavaScript.html` | クライアント JS (include 経由) |

## 設定スプレッドシート (アプリ自身の状態保存用)

アプリは自身の状態を、別途用意するスプレッドシート (ID をスクリプトプロパティ `SPREADSHEET_ID` に設定) に保存する。

- **Members**: `CalendarID | Visible | Color`
  - CSV から登場した calendar_id は自動で `Visible=TRUE` で追記される
  - 色を指定したい場合のみ手動で `Color` (例 `#4285f4`) を入れる
- **EventVisibility**: `CalendarID | EventKey | ShowDetails | UpdatedAt`
  - 予定ごとの内容表示設定 (UI クリックで自動書込)
- **Config**: `Key | Value`
  - `dayStartHour` / `dayEndHour` / `slotMinutes` / `timezone`
  - `csvFolderId` / `csvFileName`
  - `phoneBookId` / `phoneBookAddressCol` (既定 9 = I 列) / `phoneBookNameCol` (既定 6 = F 列) / `phoneBookSheet` (空なら先頭シート)

## セットアップ手順

### 1. 設定用スプレッドシートを作成

Google ドライブで新規スプレッドシートを作成し、URL `/d/<ID>/edit` の ID を控える。

### 2. GAS プロジェクトを作成してコードを配置

**A. clasp を使う場合 (推奨)**

```bash
npm install -g @google/clasp
clasp login
clasp create --type standalone --title "スケジュール調整" --rootDir .
clasp push
```

**B. 手動の場合**

[script.google.com](https://script.google.com/) で新規プロジェクトを作成し、本リポジトリの以下をそれぞれ貼り付け。

- `appsscript.json` → プロジェクト設定で「マニフェスト ファイルをエディタで表示する」を有効化してから貼付
- `.gs` ファイル → スクリプトファイル
- `.html` ファイル → HTML ファイル

### 3. スクリプトプロパティに SPREADSHEET_ID を設定

GAS エディタ「プロジェクトの設定」→「スクリプト プロパティ」に `SPREADSHEET_ID` を追加し、1 で控えた ID を設定。

### 4. 初回セットアップ関数を実行

GAS エディタで `setupSpreadsheet` を実行し、OAuth 認可を通す (Drive / Sheets の読み書き)。
Members / EventVisibility / Config シートが自動作成され、Config に既定値 (CSV フォルダ ID・電話帳 ID・各列番号) が入る。

### 5. 必要なら Config を編集

CSV のフォルダ ID・ファイル名や電話帳 ID が上記デフォルトと違う場合、Config シートで上書き。

### 6. Drive / 電話帳のアクセス権

- Web アプリを「自分 (デプロイ者) として実行」で動かすので、**デプロイ者** が以下にアクセスできる必要がある
  - `events.csv` があるフォルダ (デフォルト: `1BWBFBpOpfgX1ly8n77bad7SF4s16jAzf`)
  - 電話帳スプレッドシート (デフォルト: `1GbWVn7HZ7fPWpiv2GTdpMXksU-SBzCM0UdAc7Bwb02M`)
- 権限がない場合、デフォルトのフォルダ・スプレッドシートの所有者に「閲覧者」以上で共有依頼する

### 7. Web アプリとしてデプロイ

GAS エディタで「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
- 実行するユーザー: **自分 (デプロイ者)**
- アクセスできるユーザー: 運用ポリシーに合わせて設定

発行された URL を利用者に共有する。

## 使い方

1. Web アプリを開く → 当日〜翌日の範囲で CSV に含まれる全メンバーの予定が表示される (CSV の calendar_id は自動で Members に登録)
2. 期間を変更したい場合は「開始日 / 終了日」を変更 → 自動で更新
3. メンバーを絞り込みたい場合はサイドバーのチェックを外す (Members シートに永続化)
4. 予定ブロックをクリックすると「予定あり」⇔ タイトル表示が切り替わる (EventVisibility シートに永続化)

## 動作仕様 (内部)

- CSV の各行は `(calendar_id, start_time, end_time, event_name)` を複合キーとして `eventKey` を生成 (CSV に event_id 列が無いため)
- 日時パースは ISO 8601 を最優先。`YYYY/MM/DD HH:MM:SS` もフォールバックで対応
- 文字コードは UTF-8 優先、置換文字が混じった場合のみ Shift_JIS で再読込
- 氏名ルックアップは大文字小文字を無視して比較 (`toLowerCase()`)

## ブランチ

開発は `claude/gas-calendar-scheduler-qTe74` ブランチで行う。
