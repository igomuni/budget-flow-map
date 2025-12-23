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
- **レンダリング**: deck.gl (ScatterplotLayer + PathLayer)
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
│   ├── BudgetFlowMap.tsx
│   ├── DeckGLCanvas.tsx
│   ├── InfoPanel/       # 左パネル（タブ切替式）
│   └── Tooltip.tsx
├── layers/              # deck.glレイヤー生成
│   ├── createNodeLayers.ts
│   └── createEdgeLayers.ts
├── store/               # Zustandストア
├── types/               # TypeScript型定義
├── utils/               # ユーティリティ
└── hooks/               # カスタムフック
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
| ホバー | 直接接続のエッジのみハイライト + ツールチップ |
| クリック | 左パネルに詳細表示（ビューは不変） |
| ズーム | マウスホイール、連続的、ラベル表示が変化 |
| パン | ドラッグ |

## ズーム連動ラベル表示

| レベル | 表示 |
|--------|------|
| 俯瞰（1x） | 府省名のみ |
| 中間（2-4x） | 局名まで |
| 詳細（5x+） | 事業名まで |

## 開発コマンド

```bash
npm run dev        # 開発サーバー起動
npm run build      # 本番ビルド
npm run lint       # ESLintチェック
```

## 仕様書

- `spec.md`: 英語版仕様書
- `spec.ja.md`: 日本語版仕様書

仕様書を「設計憲法」として扱い、実装はこれに完全に従属する。
