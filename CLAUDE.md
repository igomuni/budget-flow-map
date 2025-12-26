# CLAUDE.md - budget-flow-map

## プロジェクト概要

日本政府の予算と支出の流れを俯瞰的に可視化するWebアプリケーション。
RSシステム（行政事業レビュー）のCSVデータを元に、5層のSankey DAGとして表現する。

## 設計思想（最重要）

**「詳細分析」ではなく「全体構造の理解」が目的**

- TopN表示は禁止（全ノードを個別に描画）
- ドリルダウンは禁止（クリックでビューは変わらない）
- Google Mapsのようにズーム・パン操作で探索
- 「操作して理解する」ではなく「眺めて慣れることで理解する」

## 技術スタック

- **フレームワーク**: React 18 + TypeScript
- **レンダリング**: deck.gl (PolygonLayer + PathLayer)
- **状態管理**: Zustand
- **スタイリング**: Tailwind CSS
- **ビルド**: Vite
- **レイアウト計算**: d3-sankey（ビルド時のみ）

## グラフ構造

5層のSankey DAG:
```
[府省] → [局] → [課] → [事業] → [支出先]
Layer0   Layer1  Layer2  Layer3   Layer4
```

## ディレクトリ構造

```
src/
├── components/          # Reactコンポーネント
│   ├── App.tsx
│   ├── BudgetFlowMap.tsx   # メインコンテナ（TopN/間隔設定管理）
│   ├── DeckGLCanvas.tsx    # deck.glレンダリング（ハイライト計算含む）
│   ├── Minimap.tsx         # 右側ミニマップ
│   ├── MapControls.tsx     # ズーム・間隔コントロール
│   ├── TopNSettings.tsx    # TopN設定パネル
│   ├── InfoPanel/          # 左パネル（タブ切替式）
│   └── Tooltip.tsx
├── layers/              # deck.glレイヤー生成
│   ├── createNodeLayers.ts   # PolygonLayerでノード描画
│   └── createEdgeLayers.ts   # PathLayerでエッジ描画
├── hooks/               # カスタムフック
│   ├── useLayoutData.ts      # layout.json.gzの読み込み
│   └── useDynamicTopN.ts     # 動的TopNフィルタリング
├── store/               # Zustandストア
├── types/               # TypeScript型定義
└── utils/               # ユーティリティ
    ├── colorScheme.ts        # 府省庁カラー定義
    └── sankeyPath.ts         # Bezier曲線パス生成
```

## データパイプライン

```
CSVデータ → normalize_csv.py → generate-graph.ts → compute-layout.ts → layout.json.gz
```

- `public/data/layout.json.gz`: 事前計算されたレイアウト（Git管理）
- prebuildフックで自動解凍

## パフォーマンス要件

- ノード数: 1万〜3万
- エッジ数: 数万
- 目標フレームレート: 60fps（ズーム/パン時）

## インタラクション

| 操作 | 動作 |
|------|------|
| ホバー | 先祖・子孫すべてをハイライト + ツールチップ |
| クリック | 先祖・子孫すべてをハイライト + 左パネルに詳細表示 |
| ズーム | マウスホイール、連続的、ラベル表示が変化 |
| パン | ドラッグ |

### ハイライト仕様

- **ホバー時**: BFS探索で先祖・子孫すべてをハイライト（選択時と同じ範囲）
- **選択時**: BFS探索で先祖・子孫すべてを強調表示
- **非関連ノード**: 20%不透明度に減衰
- **非関連エッジ**: 15%不透明度に減衰
- **選択ノード**: ゴールドのストローク（3px）で強調（Fillは変更しない）
- **ホバーノード**: 白のストローク（3px）で強調（Fillは変更しない）
- **非ハイライト時**: ノードにストロークなし

## ズーム連動ラベル表示

| レベル | 表示 |
|--------|------|
| 俯瞰（1x） | 府省名のみ |
| 中間（2-4x） | 局名まで |
| 詳細（5x+） | 事業名まで |

## Git運用ルール

**mainブランチ保護（重要）**

- mainブランチで直接作業することを禁止
- 必ずfeatureブランチを作成してから作業
- PR経由でのみmainへマージ
- マージ後は必ず `git pull` でローカルを同期

**推奨ワークフロー:**

```bash
# 1. 最新のmainを取得
git checkout main
git pull origin main

# 2. featureブランチ作成
git checkout -b feat/your-feature-name

# 3. 作業 → コミット → push
git add .
git commit -m "..."
git push -u origin feat/your-feature-name

# 4. PR作成 → マージ

# 5. ローカルmainを同期
git checkout main
git pull origin main

# 6. 作業ブランチ削除（任意）
git branch -d feat/your-feature-name
```

## 開発コマンド

```bash
npm run dev           # 開発サーバー起動
npm run build         # 本番ビルド
npm run lint          # ESLintチェック
npm run data:graph    # CSV → graph-raw.json
npm run data:layout   # graph-raw.json → layout.json
npm run data:pipeline # 上記2つを連続実行
```

## データパイプライン詳細

```
marumie-rssystem/data/year_2024/*.csv  (正規化済みCSV)
                   │
                   ▼ npm run data:graph
data/intermediate/graph-raw.json  (座標なしグラフ)
                   │
                   ▼ npm run data:layout
public/data/layout.json  (座標付き + Bezierパス)
                   │
                   ▼ gzip
public/data/layout.json.gz  (Git管理用)
```

### スクリプト
- `scripts/generate-graph.ts`: CSV→グラフ変換
- `scripts/compute-layout.ts`: d3-sankeyレイアウト計算
- `scripts/decompress-data.sh`: prebuildフックで解凍

## ドキュメント

### ディレクトリ構成

```
docs/
├── spec.md              # 英語版仕様書
├── spec.ja.md           # 日本語版仕様書
├── INITIAL_PROMPT.md    # 初期プロンプト（アーカイブ）
└── YYYYMMDD_HHMM_*.md   # 日付付きドキュメント
```

### ドキュメント命名規則

新規ドキュメントは以下の形式で作成:

```
docs/YYYYMMDD_HHMM_タイトル.md
```

例:
- `docs/20251226_0730_roadmap.md` - ロードマップ
- `docs/20251226_1500_performance-tuning.md` - パフォーマンスチューニング記録

### ドキュメントの種類

| 種類 | 命名パターン | 説明 |
|------|-------------|------|
| 仕様書 | `spec*.md` | 設計憲法。実装はこれに従属 |
| ロードマップ | `*_roadmap.md` | 今後の開発計画 |
| ADR | `*_adr-*.md` | Architecture Decision Record |
| 作業ログ | `*_log-*.md` | 作業記録・振り返り |

仕様書を「設計憲法」として扱い、実装はこれに完全に従属する。

## エッジ描画

- **形状**: Sankey式ベジェ曲線（cubic bezier、40%コントロールポイント、20セグメント）
- **太さ**: 金額に線形比例（閾値ベースのスケーリング）
- **色**: 半透明グレーブルー（#8294c8）
- **透明度**:
  - 通常: 30%
  - ハイライト: 70%（鮮やかな青 #5090ff）
  - 非関連: 15%

## 動的TopNフィルタリング

全データ（32,609ノード）をロードし、クライアント側で動的にフィルタリング:
- 事業（Layer 3）: デフォルト Top 500
- 支出先（Layer 4）: デフォルト Top 1000
- 閾値: 最小高さ適用の基準（デフォルト 1兆円）

フィルタリング外のノードは「その他」として集約される。

## レイアウトアルゴリズム

### 府省庁ごとのまとまりとレイヤー揃え

各府省庁で Layer 0→1→2→3→その他 の順にノードを配置し、かつ全府省庁でレイヤーのTop位置を揃える:

1. **Layer 0-3の配置**: 府省庁ごとに各レイヤーを順次配置
2. **レイヤーTop揃え**: `layerCurrentY` Mapで各レイヤーの現在Y位置を追跡
3. **府省庁間の間隔**: 各府省庁ブロック後に全レイヤーを最大終端位置に揃える

### 課レイヤー（Layer 2）の特殊処理

課は必ず一つの局（Layer 1）に属するため、局の位置順に配置:

1. **局ごとにグループ化**: エッジ情報から課の親局を特定
2. **局のY位置順にソート**: 局が上から順に並ぶように課クラスタを配置
3. **局なしの課**: 府省から直接接続される課（公安調査庁、公正取引委員会等）も対応
4. **重なり防止**: 順次配置で課同士の重なりを完全に解消

### 間隔調整

- **縦間隔（nodeSpacingY）**:
  - 0px時: ノード間の隙間なし（`nodeSpacing = 0`）
  - それ以外: 設定値をそのまま加算
- **横間隔（nodeSpacingX）**:
  - 0px時: レイヤー間の隙間なし
  - それ以外: 各レイヤー間に均等に設定値を加算（累積ではなく均等）

### ノード高さ

- **閾値以上**: 金額に比例した高さ
- **閾値未満**: 最小高さ 1px
- **「その他」ノード**: 集約された金額の合計で高さ計算
