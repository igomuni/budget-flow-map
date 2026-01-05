# ズーム連動表示の設計

## 概要

TopNベースのフィルタリングから、Google Mapsのようなズーム連動表示へ移行した。
ズームレベルに応じてノードが徐々に現れる/消えるシームレスな体験を実現。

## 設計思想

### 従来の問題点（TopNベース）

- 「Top 500事業」「Top 1000支出先」という固定的なフィルタリング
- ユーザーが手動で設定を調整する必要があった
- 「その他」ノードへの集約が直感的でなかった

### 新しいアプローチ（ズーム連動）

- ズームレベルに応じて表示する最小金額が自動的に変化
- 俯瞰ビューでは大きな金額のノードのみ、ズームインで詳細が見える
- Google Mapsで建物が徐々に見えてくるような体験

## 可視性ロジック

### 基本式

```
閾値 = ベース閾値 / 4^zoom
```

ズームレベルが1上がるごとに、閾値が1/4になる。

### レイヤー別ベース閾値

| Layer | タイプ | ベース閾値 | 説明 |
|-------|--------|-----------|------|
| 0 | 府省 | 0 | 常時表示 |
| 1 | 局 | 0 | 常時表示 |
| 2 | 課 | 5000億円 | 大規模な課から表示 |
| 3 | 事業 | 5兆円 | 巨大事業から表示 |
| 4 | 支出先 | 20兆円 | 最大支出先から表示 |

### ズームレベル別の閾値

| Layer | zoom=0 | zoom=2 | zoom=4 | zoom=6 |
|-------|--------|--------|--------|--------|
| 2 課 | 5000億 | 312億 | 19.5億 | 1.2億 |
| 3 事業 | 5兆 | 3125億 | 195億 | 12億 |
| 4 支出先 | 20兆 | 1.25兆 | 781億 | 48億 |

※ deck.glのzoomはlog2スケール（zoom=0→1倍、zoom=2→4倍）

## 実装詳細

### ファイル構成

```
src/hooks/useZoomVisibility.ts  # メインロジック
src/components/DeckGLCanvas.tsx # 統合箇所
src/components/MapControls.tsx  # レイヤー可視性インジケーター
```

### useZoomVisibility フック

```typescript
// 金額閾値計算
function getMinVisibleAmount(layer: LayerIndex, zoom: number): number {
  const baseThreshold = BASE_AMOUNT_THRESHOLDS[layer]
  if (baseThreshold === 0) return 0

  const effectiveZoom = Math.max(0, zoom)
  const reductionFactor = Math.pow(4, effectiveZoom)

  return baseThreshold / reductionFactor
}

// フィルタリング
function useZoomVisibility(data, { zoom, viewportBounds }) {
  // 1. 金額ベースフィルタリング
  // 2. ビューポートカリング
  // 3. エッジフィルタリング（両端が可視の場合のみ）
}
```

### ビューポートカリング

パフォーマンス維持（60fps）のため、画面外のノードは描画しない。

```typescript
function calculateViewportBounds(target, zoom, width, height, padding) {
  const scale = Math.pow(2, zoom)
  const worldWidth = width / scale
  const worldHeight = height / scale
  // 50%のパディングを追加（スムーズなスクロール用）
  return { minX, maxX, minY, maxY }
}
```

### レイヤー可視性インジケーター

設定パネルに現在のズームレベルで表示されるレイヤーを表示。

```
府省 ● 局 ● 課 ○ 事業 ○ 支出先 ○
（●=表示中、○=ズームイン必要）
```

## パフォーマンス

### 期待される描画ノード数

- **俯瞰ビュー（zoom=-4）**: ~200ノード（府省・局のみ）
- **中間ズーム（zoom=0）**: ~500-1000ノード
- **詳細ズーム（zoom=4）**: ~1000-3000ノード（ビューポート内のみ）

### 最適化

1. **useMemo**: フィルタリング結果をメモ化
2. **デバウンス**: ビューポート更新は100msデバウンス
3. **ビューポートカリング**: 画面外ノードを除外

## 「その他」集約の廃止

従来はTopN外のノードを「その他」に集約していたが、廃止した。

- 十分ズームインすれば全ノードが個別に見える
- 集約による情報損失がない
- CLAUDE.mdの設計思想「全ノードを個別に描画」に準拠

## InfoPanelとの連携

支出先タブは生データ（rawNodes/rawEdges）を参照するため、
ズームレベルに関係なく全支出先を表示する。

```typescript
// RecipientsTab.tsx はズーム連動に影響されない
export function RecipientsTab({ node, rawNodes, rawEdges }) {
  // rawNodesから直接フィルタリング
}
```

## 将来の拡張

### スムーズフェード（未実装）

閾値付近のノードが徐々にフェードインする効果。

```typescript
// 閾値の50%マージン内でフェードイン
const fadeFactor = (amount - threshold) / (threshold * 0.5)
const alpha = Math.min(1, Math.max(0, fadeFactor))
```

### 閾値の調整

現在のベース閾値は暫定値。実際の使用感に応じて調整可能。

```typescript
// src/hooks/useZoomVisibility.ts
const BASE_AMOUNT_THRESHOLDS: Record<LayerIndex, number> = {
  0: 0,
  1: 0,
  2: 5e11,   // 調整可能
  3: 5e12,   // 調整可能
  4: 2e13,   // 調整可能
}
```

## 関連ファイル

- [useZoomVisibility.ts](../src/hooks/useZoomVisibility.ts)
- [DeckGLCanvas.tsx](../src/components/DeckGLCanvas.tsx)
- [MapControls.tsx](../src/components/MapControls.tsx)
- [BudgetFlowMap.tsx](../src/components/BudgetFlowMap.tsx)

## 変更履歴

- 2025-12-28: 初版作成（TopNからズーム連動への移行）
