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
| ホバー | 直接接続のノード/エッジをハイライト + ツールチップ |
| クリック | 先祖・子孫すべてをハイライト + 左パネルに詳細表示 |
| ズーム | マウスホイール、連続的、ラベル表示が変化 |
| パン | ドラッグ |

### ハイライト仕様

- **ホバー時**: 直接接続（1ホップ）のノードとエッジのみハイライト
- **選択時**: BFS探索で先祖・子孫すべてを強調表示
- **非関連ノード**: 20%不透明度に減衰
- **非関連エッジ**: 15%不透明度に減衰
- **選択ノード**: ゴールドのストローク（3px）で強調（Fillは変更しない）

## ズーム連動ラベル表示

| レベル | 表示 |
|--------|------|
| 俯瞰（1x） | 府省名のみ |
| 中間（2-4x） | 局名まで |
| 詳細（5x+） | 事業名まで |

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

## 仕様書

- `spec.md`: 英語版仕様書
- `spec.ja.md`: 日本語版仕様書

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
