# スケジュール調整アプリ (GAS)

Google Apps Script で動く、複数メンバーのカレンダー予定をタイムグリッドで横並び表示する Web アプリ。
対象メンバーはスプレッドシートで管理し、人単位・予定単位で表示／非表示を切り替えられる。

## 機能

- 日付範囲を自由に指定して、複数メンバーの予定をタイムグリッドで可視化
- メンバーリストはスプレッドシート (Members シート) で管理
- メンバーごとの表示／非表示チェックボックス
- 予定 1 件ごとに「内容表示 / 予定あり」を切替（クリック）、設定はスプレッドシートに永続化
- 終日予定はグリッド上部の帯に別表示
- アクセス権のないカレンダーはサイドバーに「取得不可」として表示

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `appsscript.json` | マニフェスト (タイムゾーン、OAuth スコープ、Web アプリ設定) |
| `Code.gs` | `doGet`, `include`, シートメニュー (`onOpen`) |
| `Api.gs` | クライアント公開関数 (`getConfig` / `getSchedules` / `setMemberVisible` / `setEventShowDetails`) |
| `CalendarService.gs` | カレンダー取得とイベント整形 |
| `SpreadsheetService.gs` | シート CRUD と `setupSpreadsheet` |
| `Index.html` | メイン UI |
| `Stylesheet.html` | CSS (include 経由) |
| `JavaScript.html` | クライアント JS (include 経由) |

## スプレッドシートスキーマ

- **Members**: `Name | CalendarID | Visible | Color`
  - `CalendarID` はメールアドレス形式（例: `user@example.com`）
  - `Visible` は `TRUE` / `FALSE`
  - `Color` は任意（`#4285f4` などの CSS カラー）
- **EventVisibility**: `CalendarID | EventKey | ShowDetails | UpdatedAt`
  - 予定ごとの内容表示設定を自動で書き込む（ユーザーが手で編集する必要は基本なし）
- **Config**: `Key | Value`
  - `dayStartHour` / `dayEndHour` / `slotMinutes` / `timezone`

## セットアップ手順

### 1. スプレッドシートを作成

Google ドライブでスプレッドシートを新規作成し、URL の `/d/<ID>/edit` 部分の ID を控える。

### 2. GAS プロジェクトを作成してコードを配置

**A. clasp を使う場合 (推奨)**

```bash
npm install -g @google/clasp
clasp login
clasp create --type standalone --title "スケジュール調整" --rootDir .
# 生成された .clasp.json を .clasp.json に保存
clasp push
```

**B. 手動の場合**

[script.google.com](https://script.google.com/) で新規プロジェクトを作成し、本リポジトリの以下をそれぞれ貼り付ける:

- `appsscript.json` → プロジェクト設定でマニフェストを表示にしてから
- `Code.gs` / `Api.gs` / `CalendarService.gs` / `SpreadsheetService.gs` → スクリプトファイル
- `Index.html` / `Stylesheet.html` / `JavaScript.html` → HTML ファイル

### 3. スクリプトプロパティに SPREADSHEET_ID を設定

GAS エディタで「プロジェクトの設定」→「スクリプト プロパティ」に `SPREADSHEET_ID` を追加し、値に 1 で控えた ID を設定。

### 4. 初回セットアップ関数を実行

GAS エディタで `setupSpreadsheet` 関数を選択して実行し、OAuth 認可を通す。Members / EventVisibility / Config シートが自動作成される。

### 5. Members シートにメンバーを入力

| Name | CalendarID | Visible | Color |
| --- | --- | --- | --- |
| 山田 | yamada@example.com | TRUE | #4285f4 |
| 佐藤 | sato@example.com | TRUE | #34a853 |

他ユーザーのカレンダーを表示するには、そのカレンダーをデプロイユーザーに共有しておく必要がある（「予定の表示」以上の権限）。

### 6. Web アプリとしてデプロイ

GAS エディタで「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
- 実行するユーザー: **自分 (デプロイ者)**
- アクセスできるユーザー: 運用ポリシーに合わせて設定（例: `同じ組織内の全員`）

発行された URL を利用者に共有する。

## 使い方

1. Web アプリを開く → 当日〜翌日の範囲でメンバーの予定が表示される
2. 期間を変更したい場合は「開始日 / 終了日」を変更 → 自動で更新
3. メンバーを絞り込みたい場合はサイドバーのチェックを外す
4. 予定ブロックをクリックすると「予定あり」⇔ タイトル表示が切り替わる（次回以降も状態が保持される）

## エッジケース

- 権限の無いカレンダー: サイドバー下部の「取得不可」リストに理由と一緒に表示
- 繰り返し予定: `(eventId, 開始時刻)` を複合キーとして扱うため、各回ごとに表示設定を持てる
- 日跨ぎ予定: 表示範囲でクリップして描画
- 空メンバー: 「Members シートに CalendarID を追加してください」と案内

## 開発

- ランタイムは V8、ES2015+ 構文で記述
- `PropertiesService` でスプレッドシート ID を保持するため、コードは特定のスプレッドシートに依存しない
- スプレッドシートと直接紐付けた (container-bound) プロジェクトとしても動作（`onOpen` でメニューが追加される）

## ブランチ

開発は `claude/gas-calendar-scheduler-qTe74` ブランチで行う。
