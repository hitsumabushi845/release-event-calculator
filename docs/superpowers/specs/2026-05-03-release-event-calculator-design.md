# Release Event Calculator — Design Spec

**Date:** 2026-05-03
**Status:** Approved (brainstorming complete, pending implementation plan)

## 1. Purpose

アイドル等のシングル・アルバム発売時のリリースイベントで、購入金額に基づいて配布される「特典券」を目標枚数獲得するために、最適な購入の組み合わせを計算する静的Webアプリ。

**ユーザーの問い:** 「1500円のCDで、1000円ごとに1枚もらえる特典券を10枚得るには何枚買えばいい？」「複数のCDが対象のとき、最も適切な購入組み合わせは？」

## 2. Scope

### In scope (MVP)
- **逆算のみ**: 目標枚数 → 必要な購入数・最低金額
- **特典券ルール**: 「合計購入金額 ÷ 単価（端数切捨て）」で枚数決定。単価はユーザー設定可能
- **複数CD対応**: 異なる価格のCDを複数登録、混在購入可能
- **複数候補表示**: 最安・最少枚数・バランス型のパレート最適候補
- **CDごとの制約 (オプション)**: 最低購入数・最大購入数を任意設定
- **URL共有**: 入力状態をURLクエリに埋め込み、シェアで再現可能
- **多言語**: 日本語・英語の切替（URL/localStorage/ブラウザ言語の優先順位）
- **計測**: Google Analytics 4 (GA4)

### Out of scope (将来検討)
- 順算（予算 → 最大枚数）
- 円以外の通貨
- 店舗別/CD別の独自ルール（CDごとに付与枚数が固定など）
- 順位/抽選系イベントのシミュレーション
- 計算履歴の永続化（localStorageに最後の状態は残るが履歴ではない）
- アカウント機能・サーバー側保存

## 3. Architecture

### Tech stack
- **フレームワーク**: SvelteKit + `@sveltejs/adapter-static`（プリレンダーで完全静的化）
- **言語**: TypeScript（strict）
- **ビルド**: Vite（SvelteKit付属）
- **i18n**: `svelte-i18n`
- **テスト**: Vitest（unit/component） + Playwright（E2E、最小限）
- **ホスティング**: GitHub Pages、GitHub Actions で自動デプロイ
- **計測**: Google Analytics 4（GA4）、IPマスキング有効、Cookie同意バナーなし

### Routing
- 単一ルート `/`（SPA的に振る舞う1ページ構成）
- URL クエリパラメータ `?s=<base64url(json)>&lang=<ja|en>` で状態を共有

### Layer structure
```
src/
├── lib/
│   ├── calculator/        # アルゴリズム（純粋TS、UI非依存）
│   │   ├── pareto.ts      # パレート最適候補の探索
│   │   ├── feasibility.ts # 制約チェック・解の存在判定
│   │   └── types.ts       # 型定義
│   ├── i18n/
│   │   ├── index.ts       # svelte-i18n 初期化
│   │   ├── ja.json
│   │   └── en.json
│   ├── url/
│   │   └── state.ts       # URL ↔ State の encode/decode
│   ├── analytics/
│   │   └── ga.ts          # GA4 ラッパー（gtag）
│   └── components/
│       ├── RuleInput.svelte
│       ├── CdList.svelte
│       ├── CdRow.svelte
│       ├── ResultCard.svelte
│       ├── LangSwitcher.svelte
│       └── ShareButton.svelte
├── routes/
│   ├── +layout.svelte     # i18n初期化、GAタグ
│   └── +page.svelte       # メインページ
└── app.html               # GA4 gtag snippet
```

**設計原則:** 計算ロジックを `lib/calculator/` で完全に切り離す。これにより (1) ユニットテストが書きやすく、(2) UIの変更で算出が壊れにくく、(3) 将来CLI転用も可能。

## 4. Data Model

### Input
```ts
type CalculatorInput = {
  ticketUnitPrice: number;   // 例: 1000（円ごとに1枚）
  targetTickets: number;     // 例: 10
  cds: CdEntry[];
};

type CdEntry = {
  id: string;                // nanoid 等で生成
  name: string;              // 表示名（空文字も可、UIで自動採番表示）
  price: number;             // 円、正の整数
  minQuantity?: number;      // 未指定 = 0
  maxQuantity?: number;      // 未指定 = 上限なし
};
```

### Output
```ts
type Solution = {
  purchases: { cdId: string; quantity: number }[];
  totalCost: number;
  totalCount: number;        // CD総枚数
  ticketsObtained: number;   // 実際に得られる券数（target以上）
  label: 'cheapest' | 'fewest' | 'balanced';
};

type CalculationResult = {
  solutions: Solution[];     // パレート最適、コスト昇順でソート
  feasible: boolean;
};
```

### UI state
- Svelte 5 runes (`$state`) で1つのオブジェクトに集約
- 入力変化 → 200ms debounce → 自動再計算（明示的な「計算ボタン」なし）
- URL クエリと双方向同期（`replaceState` で履歴を汚染しない）

## 5. Algorithm

### Problem formulation
- 変数: `x_i ∈ [min_i, max_i]` （CD `i` の購入数、非負整数）
- 制約: `floor((Σ price_i × x_i) / unit) ≥ target`
  - 等価: `Σ price_i × x_i ≥ target × unit`
- 二目的最小化: 総コスト `Σ price_i × x_i` と CD総数 `Σ x_i`

### DP approach
1. `T = target × unit` を最低必要金額として算出
2. 各CDの `min_i` を強制購入として基底コスト `B = Σ min_i × price_i` ・基底CD数を先に確定（残りを bounded knapsack DP で充当）
3. 追加購入の必要分は `max(0, T - B)` 以上、上限は `max(0, T - B) + max(price_i) - 1`（これより上は冗長な過剰購入）
4. **DPテーブル** `dp[c]` = 「追加コストちょうど `c` を達成する最少CD数」と「そのときの追加購入ベクトル」（各CDは `0..max_i - min_i` の範囲で利用）
5. 有効範囲内の `(B + c, base_count + dp[c].count)` を全列挙し、パレート支配される点を除去
6. パレート点リストから3点を選定:
   - `cheapest`: コスト最小（左端）
   - `fewest`: CD数最小（右端）
   - `balanced`: パレートフロントの「knee 点」（コスト軸とCD数軸を [0,1] に正規化したときの原点からの距離が最小の点）
7. パレート点が1〜2点しかなければ、それだけを返す

### Complexity & limits
- 想定上限: CD種類 ≤ 20、目標枚数 ≤ 10,000
- DP操作回数 ≈ `n × T × max_per_cd`、実用範囲では数十ms以内
- 安全弁: DP操作回数が 1,000,000 を超える場合は計算中止し「入力規模が大きすぎます」を返す（無限ループ・長時間ブロック防止）
- Web Worker は初期スコープ外（YAGNI）

### Infeasibility
- `Σ min_i × price_i / unit < target` かつ全CDが `max_i` で頭打ち → `feasible: false`
- CDが0件 → 結果欄に「CDを追加してください」（feasibility ではなく案内表示）

## 6. UI / UX

### Layout（縦1カラム、モバイル優先、最大幅 ~640px）
```
┌─────────────────────────────┐
│ ヘッダー [JP/EN] [シェア]    │
├─────────────────────────────┤
│ 1. 特典券ルール              │
│   特典券単価: [1000] 円      │
│   目標枚数:   [10] 枚        │
├─────────────────────────────┤
│ 2. CD一覧                    │
│   ┌─────────────────────┐   │
│   │ Type A     [1500]円 │   │
│   │ ▸ 制約を設定         │   │
│   └─────────────────────┘   │
│   [+ CD追加]                 │
├─────────────────────────────┤
│ 3. 結果（自動更新）          │
│   ┌─ 最安 (10,000円 / 10枚)  │
│   │  Type A × 10            │
│   ├─ 最少 (10,500円 / 7枚)   │
│   │  Type B × 7             │
│   └─ バランス ...            │
└─────────────────────────────┘
```

### Components
| Component | Responsibility |
|---|---|
| `+page.svelte` | 全体の状態を保持、計算をkick、URL同期 |
| `RuleInput.svelte` | 特典券単価・目標枚数の入力 |
| `CdList.svelte` | CDの追加・削除・並び替え |
| `CdRow.svelte` | 1行の入力（名前/価格、折りたたみで min/max） |
| `ResultCard.svelte` | 候補1件の表示 |
| `LangSwitcher.svelte` | JP/EN切替 |
| `ShareButton.svelte` | URLクリップボードコピー、トースト通知 |

### Interaction
- 入力変更 → 200ms debounce → 自動再計算
- CD 0件 → 結果欄に案内
- 計算不可能 → 結果欄にエラーメッセージ
- シェアボタン → 現在のURLをコピー、「コピーしました」トースト

### Styling
- Tailwind は使わず素のCSS（`<style>` ローカルスコープ）。依存最小化、軽量化

## 7. URL Sharing

- パラメータ: `?s=<base64url(json)>&lang=<ja|en>`
- JSON は短縮キー: `{u: unit, t: target, c: [[name, price, min?, max?], ...]}`
- decode 失敗（base64/JSON/スキーマ不一致）→ デフォルト状態にフォールバック、`console.warn` のみ
- 入力変更時は `history.replaceState` で URL 更新（履歴を汚染しない）
- ブラウザ URL 長制限（〜2000文字）に収まる範囲

## 8. i18n

- ライブラリ: `svelte-i18n`
- 文言: `src/lib/i18n/{ja,en}.json`
- 言語選択優先順位: URL `lang` > localStorage > `navigator.language` > デフォルト `ja`
- 切替時は localStorage 保存 + URL の `lang` 更新
- 数値書式は `Intl.NumberFormat` でロケール対応（`10,000円` / `¥10,000`）
- 翻訳対象: ラベル・ボタン・エラー・候補ラベル（最安/最少/バランス）

## 9. Analytics (GA4)

- Measurement ID は環境変数（例: `PUBLIC_GA_MEASUREMENT_ID`）でビルド時注入。リポジトリにIDを埋めない
- IPマスキング有効、Cookie同意バナーなし
- 計測イベント:
  - `calculate`: 計算実行（候補数、CD種類数、目標枚数を匿名で）
  - `share`: シェアボタン押下
  - `lang_switch`: 言語切替（from → to）
- IDが未設定の本番外環境ではスクリプトを注入しない

## 10. Validation & Error Handling

### Input validation（インライン表示）
- `ticketUnitPrice ≤ 0` / `targetTickets ≤ 0` / `price ≤ 0` → 「1以上の整数を入力してください」
- `maxQuantity < minQuantity` → 「最大値は最小値以上にしてください」
- HTML属性: 必須正値フィールド（unit/target/price）には `<input type="number" min="1" step="1">`、`minQuantity` には `min="0"`、`maxQuantity` には `min="0"` または対応する `minQuantity` 値以上
- JS側でも整数化（`parseInt`）して非整数入力を排除

### Calculation edge cases
- `feasible: false` → 「制約を満たす購入が見つかりません」
- DP操作上限超過 → 「入力規模が大きすぎます」
- 重複パレート点 → 排除

### URL restore failure
- 失敗時は黙ってデフォルト状態、`console.warn` のみ

## 11. Testing Strategy

### Unit tests (Vitest)
- `lib/calculator/`:
  - 単一CDの最安解（仕様の `1500円×7=10,500円で10枚` を含む）
  - 複数CDのパレート最適候補抽出
  - min/max 制約あり/なし
  - infeasibility ケース
  - 重複価格CDの扱い
  - DP操作上限の発動
- `lib/url/`: encode/decode の往復、不正入力のフォールバック
- `lib/i18n/`: 言語選択優先順位

### Component tests (Vitest + @testing-library/svelte)
- 入力 → debounce → 結果表示の更新
- 不正入力時のエラーメッセージ表示
- 言語切替が画面に反映

### E2E (Playwright、最小限 1〜2本)
- 単価1000、目標10、CD `1500円` → 候補表示
- シェアURLを開き直す → 入力復元

### CI (GitHub Actions)
- push 毎: `tsc --noEmit` + `svelte-check` + Vitest + Playwright + build
- main マージ: GitHub Pages デプロイ

## 12. Deployment

- GitHub Pages、GitHub Actions の `actions/deploy-pages` で Pages へ直接デプロイ（`gh-pages` ブランチは使わない）
- SvelteKit 設定の `paths.base` を `/release-event-calculator` に設定（プロジェクトページ配下のため）
- ビルド時環境変数（クライアント公開、`PUBLIC_` プレフィクス必須）:
  - `PUBLIC_GA_MEASUREMENT_ID` — GA4 Measurement ID。未設定の場合 GA タグを注入しない

## 13. Out-of-scope explicitly

以下は**作らない**ことを明示:
- 順算機能（予算 → 最大枚数）
- 通貨切替
- 計算履歴・お気に入り保存
- アカウント機能
- サーバーサイド処理
- ネイティブアプリ
- Cookie同意バナー
- Web Worker（初期スコープ外、必要になった時点で再評価）
