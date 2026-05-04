# release-event-calculator

アイドル等のリリースイベントで、目標枚数の特典券を獲得するための最適なCD購入組み合わせを計算する静的Webアプリ。

## 開発

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # ユニットテスト
npm run check    # 型チェック
npm run build    # 本番ビルド
npm run test:e2e # Playwright E2E（要 `npx playwright install`）
```

## 環境変数

- `PUBLIC_GA_MEASUREMENT_ID` — GA4 Measurement ID（未設定なら GA は無効）

## デプロイ

`main` への push で GitHub Actions が GitHub Pages へデプロイ。`vars.PUBLIC_GA_MEASUREMENT_ID` をリポジトリ Variables に設定可能。
