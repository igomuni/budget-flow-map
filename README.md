# budget-flow-map

日本政府の予算と支出の流れを地図のように探索できるWebアプリケーション。

## 概要

RSシステム（行政事業レビュー）のCSVデータを元に、5層のSankey DAGとして予算の流れを可視化します。

```
[府省] → [局] → [課] → [事業] → [支出先]
```

従来のドリルダウン型UIではなく、Google Mapsのようにズーム・パン操作で全体構造を俯瞰しながら探索できます。

## 特徴

- **全体構造の可視化**: 1万〜3万ノード、数万エッジを60fpsで描画
- **地図的インタラクション**: ズーム・パンで連続的に探索
- **ハイライト機能**: ホバーで直接接続、クリックで先祖・子孫すべてを強調
- **動的TopNフィルタリング**: クライアント側で事業・支出先を動的にフィルタリング
- **ミニマップ**: 右側パネルで全体の位置を把握

## 技術スタック

- **フレームワーク**: React 18 + TypeScript
- **レンダリング**: deck.gl (PolygonLayer + PathLayer)
- **状態管理**: Zustand
- **スタイリング**: Tailwind CSS
- **ビルド**: Vite
- **レイアウト計算**: d3-sankey（ビルド時のみ）

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build
```

## Vercelへのデプロイ

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/igomuni/budget-flow-map)

### 手動デプロイ

1. Vercelアカウントにログイン
2. 「New Project」から本リポジトリをインポート
3. ビルド設定は自動検出されます（`vercel.json`参照）
4. デプロイ

### 重要事項

- **prebuildフック**: ビルド前に`layout.json.gz`を自動解凍します
- **静的アセット**: `public/data/layout.json.gz`（約20MB）がデプロイに含まれます
- **フレームワーク**: Vite（自動検出）

## データパイプライン

```
CSVデータ → generate-graph.ts → compute-layout.ts → layout.json.gz
```

```bash
# CSV → グラフ変換
npm run data:graph

# グラフ → レイアウト計算
npm run data:layout

# 全パイプライン実行
npm run data:pipeline
```

## インタラクション

| 操作 | 動作 |
|------|------|
| ホバー | 直接接続のノード/エッジをハイライト + ツールチップ |
| クリック | 先祖・子孫すべてをハイライト |
| ズーム | マウスホイール |
| パン | ドラッグ |

## 仕様書

- [spec.md](./spec.md) - English specification
- [spec.ja.md](./spec.ja.md) - 日本語仕様書

## ライセンス

MIT
