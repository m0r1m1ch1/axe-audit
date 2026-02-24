// @ts-check
import { defineConfig } from "axe-audit";

export default defineConfig({
  // ビルド設定
  dist: "dist",
  buildCommand: undefined, // undefined = パッケージマネージャー自動検出
  noBuild: false,

  // サーバー設定
  port: 3000,

  // 出力設定
  json: false, // true で JSON ファイルを出力
  csv: false, // true で CSV ファイルを出力

  // HTML レポートの表示セクション制御
  showIncomplete: false,   // true で要確認 (incomplete) を表示
  showPasses: false,       // true で合格ルール一覧 (passes) を表示
  showInapplicable: false, // true で非対象ルール一覧 (inapplicable) を表示

  // axe-core 設定
  axe: {
    tags: undefined, // undefined = axe-core デフォルト（全有効ルール）
    locale: "ja", // axe-core ロケール。"ja" で日本語化。undefined で英語
    aaa: false,
    experimental: false,
    disableRules: [], // 無効化するルールID（例: ["color-contrast"]）
    include: [], // 検査対象のCSSセレクタ（空 = ページ全体）
    exclude: [], // 検査除外のCSSセレクタ（例: [".third-party", "iframe"]）
  },
});
