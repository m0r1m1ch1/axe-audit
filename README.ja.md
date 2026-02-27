# axe-audit

axe-core と Playwright によるアクセシビリティ監査 CLI。設定不要で静的サイトの WCAG 準拠を自動チェックします。

[English](./README.md)

## 特徴

- **設定不要** — デフォルト設定ですぐに使える
- **自動ページ検出** — ビルド出力の HTML ファイルを再帰的にスキャン
- **多言語対応** — axe-core メッセージを 18 言語で表示（デフォルト: 日本語）
- **複数出力形式** — HTML（ブラウザ）/ JSON / CSV
- **パッケージマネージャー自動検出** — npm / yarn / pnpm / bun のロックファイルから判定
- **ページ除外** — glob パターンで不要なページを除外可能（例: CMS 生成ページ）
- **CI/CD 対応** — CI 環境を自動検出、exit code で結果を判定可能

## インストール

```bash
npm install -D axe-audit
npx playwright install chromium
```

## クイックスタート

### 1. 設定ファイルを生成（任意）

```bash
npx axe-audit init
```

`axe-audit.config.mjs` がプロジェクトルートに作成されます。

### 2. 監査を実行

```bash
npx axe-audit
```

ビルド → ページ検出 → アクセシビリティテスト → レポート表示が自動で行われます。

## CLI リファレンス

### コマンド


| コマンド             | 説明                                |
| ---------------- | --------------------------------- |
| `axe-audit`      | アクセシビリティ監査を実行                     |
| `axe-audit init` | 設定ファイル `axe-audit.config.mjs` を生成 |


### フラグ


| フラグ          | 説明                            |
| ------------ | ----------------------------- |
| `--no-build` | ビルドステップをスキップ                  |
| `--json`     | JSON レポート (`axe-audit/report.json`) を出力 |
| `--csv`      | CSV レポート (`axe-audit/report.csv`) を出力   |
| `--help`     | ヘルプを表示                        |
| `--version`  | バージョンを表示                      |


## 設定ファイル

`axe-audit init` で生成される `axe-audit.config.mjs` の全オプション:

```js
// @ts-check
import { defineConfig } from "axe-audit";

export default defineConfig({
  dist: "dist",
  buildCommand: undefined,
  noBuild: false,
  port: 3000,
  json: false,
  csv: false,
  showIncomplete: false,
  showPasses: false,
  showInapplicable: false,
  excludePages: [],
  axe: {
    tags: undefined,
    locale: "ja",
    aaa: false,
    experimental: false,
    disableRules: [],
    include: [],
    exclude: [],
  },
});
```

### トップレベルオプション


| オプション              | 型         | デフォルト       | 説明                                              |
| ------------------ | --------- | ----------- | ----------------------------------------------- |
| `dist`             | `string`  | `"dist"`    | ビルド出力ディレクトリ                                     |
| `buildCommand`     | `string`  | `undefined` | カスタムビルドコマンド。未指定時は PM を自動検出                      |
| `noBuild`          | `boolean` | `false`     | ビルドをスキップ                                        |
| `port`             | `number`  | `3000`      | ローカルサーバーのポート番号                                  |
| `json`             | `boolean` | `false`     | JSON レポートを出力                                    |
| `csv`              | `boolean` | `false`     | CSV レポートを出力                                     |
| `showIncomplete`   | `boolean` | `false`     | HTML レポートに要確認ルール (incomplete) を表示               |
| `showPasses`       | `boolean` | `false`     | HTML レポートに合格ルール (passes) を表示                    |
| `showInapplicable` | `boolean` | `false`     | HTML レポートに非対象ルール (inapplicable) を表示             |
| `excludePages`     | `string[]` | `[]`       | 除外するページの glob パターン（例: `["**/interview/*/*", "404.html"]`） |


### `excludePages` パターン

`dist/` からの相対パスに対して glob パターンでマッチします。

| パターン | マッチする | マッチしない |
| --- | --- | --- |
| `**/interview/*/*` | `saiyo/interview/01/index.html` | `saiyo/interview/index.html` |
| `**/draft/**` | `blog/draft/post.html` | `blog/post.html` |
| `404.html` | `404.html` | `about/404.html` |

対応ワイルドカード: `**`（任意のディレクトリ階層）、`*`（`/` 以外の任意の文字列）、`?`（任意の1文字）

### `axe` サブオプション


| オプション          | 型          | デフォルト       | 説明                                                     |
| -------------- | ---------- | ----------- | ------------------------------------------------------ |
| `tags`         | `string[]` | `undefined` | 実行するルールのタグでフィルタ（例: `["wcag2a", "wcag2aa"]`）。未指定で全ルール有効 |
| `locale`       | `string`   | `"ja"`      | axe-core メッセージの言語。`undefined` で英語                      |
| `aaa`          | `boolean`  | `false`     | WCAG AAA レベルのテストを含める                                  |
| `experimental` | `boolean`  | `false`     | 実験的ルールを含める                                             |
| `disableRules` | `string[]` | `[]`        | 無効にするルール ID（例: `["color-contrast"]`）                   |
| `include`      | `string[]` | `[]`        | 監査対象の CSS セレクタ。空配列でページ全体                               |
| `exclude`      | `string[]` | `[]`        | 監査から除外する CSS セレクタ（例: `[".third-party", "iframe"]`）     |


## 出力形式

### HTML（デフォルト）

カスタム HTML レポート（`axe-audit/report.html`）が生成され、ローカル HTTP サーバー経由でブラウザに自動表示されます。macOS では Google Chrome がインストールされていれば Chrome で開き、なければデフォルトブラウザで開きます。CI 環境では表示をスキップします。

レポート末尾には「検査対象ページ」と「除外ページ」セクションが表示され、どのページが検査され、どのページが `excludePages` で除外されたかを確認できます。

### JSON

`--json` フラグまたは設定ファイルの `json: true` で有効化。`axe-audit/report.json` を出力します。

```jsonc
{
  "metadata": {
    "axeVersion": "4.10.0",
    "timestamp": "2025-01-01T00:00:00.000Z",
    "toolVersion": "1.1.0",
    "auditedPages": ["/", "/about/", "/contact/"],
    "excludedPages": ["/admin/", "/draft/"]  // excludePages 設定時のみ
  },
  "pages": [
    {
      "url": "/",
      "violations": [
        {
          "id": "color-contrast",
          "impact": "serious",
          "tags": ["wcag2aa"],
          "description": "...",
          "help": "...",
          "helpUrl": "...",
          "nodes": [
            {
              "html": "<p style=\"color: #aaa\">...</p>",
              "target": ["p:nth-child(2)"],
              "failureSummary": "..."
            }
          ]
        }
      ],
      "incomplete": [],
      "passes": [],
      "inapplicable": []
    }
  ],
  "summary": {
    "totalPages": 3,
    "totalViolations": 1,
    "totalIncomplete": 0,
    "pagesWithViolations": 1,
    "pagesWithErrors": 0
  }
}
```

### CSV

`--csv` フラグまたは設定ファイルの `csv: true` で有効化。`axe-audit/report.csv` を出力します（UTF-8 BOM 付き、Excel 対応）。


| カラム              | 説明                                                             |
| ---------------- | -------------------------------------------------------------- |
| `page`           | 監査対象ページの URL                                                   |
| `type`           | 結果タイプ（`violations` / `incomplete` / `passes` / `inapplicable`） |
| `impact`         | 深刻度（`critical` / `serious` / `moderate` / `minor`）             |
| `ruleId`         | ルール ID                                                         |
| `help`           | ヘルプテキスト                                                        |
| `html`           | 対象要素の HTML スニペット                                               |
| `target`         | 対象要素の CSS セレクタ                                                 |
| `failureSummary` | 具体的な違反理由                                                       |
| `wcag`           | 該当する WCAG 基準                                                   |
| `helpUrl`        | 詳細ヘルプの URL                                                     |


## 対応ロケール

axe-core メッセージを以下の 18 言語で表示できます。`axe.locale` に言語コードを指定してください。


| コード     | 言語             |
| ------- | -------------- |
| `da`    | デンマーク語         |
| `de`    | ドイツ語           |
| `el`    | ギリシャ語          |
| `es`    | スペイン語          |
| `eu`    | バスク語           |
| `fr`    | フランス語          |
| `he`    | ヘブライ語          |
| `it`    | イタリア語          |
| `ja`    | 日本語（デフォルト）     |
| `ko`    | 韓国語            |
| `nl`    | オランダ語          |
| `no_NB` | ノルウェー語（ブークモール） |
| `pl`    | ポーランド語         |
| `pt_BR` | ポルトガル語（ブラジル）   |
| `pt_PT` | ポルトガル語（ポルトガル）  |
| `ru`    | ロシア語           |
| `zh_CN` | 中国語（簡体字）       |
| `zh_TW` | 中国語（繁体字）       |


英語で表示する場合は `locale` を `undefined` に設定するか、キーを省略してください。

## ライセンス

MIT