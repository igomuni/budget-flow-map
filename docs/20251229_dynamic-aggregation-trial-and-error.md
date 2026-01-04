# 動的集約ノード実装の試行錯誤まとめ

**作成日**: 2025-12-29
**ブランチ**: `feat/zoom-based-visibility`

## 目標

ズームレベルに応じて、しきい値未満のノードを動的に「その他」ノードに集約する。
- 全ノード（約3万）をロードし、クライアント側で動的にフィルタリング
- 「その他」ノードは非表示ノードの代わりに表示される
- メンタルマップを保持（ノードが突然消えない）

## 実装アプローチの変遷

### Phase 1: 事前計算での集約（失敗）

**アイデア**: `compute-layout.ts`で事前に「その他」ノードを生成

**問題点**:
- 事前計算された「その他」ノードはズームレベルに依存しない
- ズームインしても「その他」が展開されない
- 動的な閾値変更に対応できない

**結論**: クライアント側での動的集約が必要

---

### Phase 2: 直接親への集約（部分的成功）

**アイデア**: 非表示ノードを直接の親ノードに集約

```typescript
const parentId = childToParent.get(node.id) || 'root'
hiddenNodesByParent.set(parentId, [...])
```

**問題点**:
- 親ノード自体も非表示の場合、「その他」ノードが作成されない
- Layer 4（支出先）で紫色ノードが表示されない
- 「紫色ノードあります、しかし支出先にはありません」というフィードバック

**修正**: 可視祖先への集約に変更

---

### Phase 3: 可視祖先への集約（成功）

**アイデア**: 非表示ノードを階層を遡って最初の可視祖先に集約

```typescript
const findVisibleAncestor = (nodeId: string): string | null => {
  let currentId = childToParent.get(nodeId)
  while (currentId) {
    if (visibleNodeIds.has(currentId)) return currentId
    currentId = childToParent.get(currentId)
  }
  return null
}
```

**結果**: Layer 4にも「その他」ノードが表示されるようになった

---

### Phase 4: 「その他」ノードの高さ計算（複数回修正）

#### 試行1: Y範囲ベース（失敗）

```typescript
const minY = Math.min(...hiddenNodes.map(n => n.y))
const maxY = Math.max(...hiddenNodes.map(n => n.y + n.height))
const height = maxY - minY
```

**問題**: 非表示ノードのY位置が広範囲に分散し、高さが巨大になる

#### 試行2: 金額ベース（改善）

```typescript
const totalAmount = hiddenNodes.reduce((sum, n) => sum + n.amount, 0)
const height = Math.max(3, totalAmount / 1e12)  // 1兆円 = 1px
```

**結果**: 高さは改善したが、まだ全体的に縦長

---

### Phase 5: Y位置の計算（複数回修正）

#### 試行1: 加重平均（失敗）

```typescript
const weightedSum = hiddenNodes.reduce((sum, n) => sum + n.y * n.amount, 0)
const centerY = weightedSum / totalAmount
```

**問題**: 親から遠い位置に配置される

#### 試行2: 親ノードのY中心に揃え（採用）

```typescript
const centerY = parentNode?.y ?? hiddenNodes[0]?.y ?? 0
```

**結果**: 親ノードと視覚的に接続される

---

### Phase 6: スケール調整

#### 問題: 1兆円 = 1px では縦長すぎる

- 150兆円 → 150px
- 全体予算（約250兆円）→ 約250px
- 画面に収まらない、ノードが小さすぎる

#### 解決: 1兆円 = 10px に変更

**変更箇所**:

| ファイル | 変更前 | 変更後 |
|----------|--------|--------|
| `compute-layout.ts` | `scale = 1e-12` | `scale = 1e-11` |
| `useZoomVisibility.ts` | `totalAmount / 1e12` | `totalAmount / 1e11` |

**結果**:
- 150兆円 → 1500px
- 全体予算（約250兆円）→ 約2500px
- 画面に適切に収まる

---

### Phase 7: Layer 4 しきい値調整

**問題**: `全国健康保険協会`（12兆円）が初期ズームで表示されない

**原因**: Layer 4のしきい値が20兆円に設定されていた

**修正**:
```typescript
// 変更前
4: 2e13,  // Recipient: 20 trillion yen

// 変更後
4: 1e13,  // Recipient: 10 trillion yen
```

---

### Phase 8: レイヤー単位集約への移行（大幅改善）

#### 問題: 親ベース集約の複雑さ

- 「その他」ノードが親ごとに生成され、数百個になる
- 親が非表示の場合の可視祖先探索が複雑
- ノード間に隙間が残る（非表示ノードのY位置が確保されたまま）

#### 解決策: レイヤー単位での集約に変更

```typescript
// 各レイヤーで金額順ソート → しきい値でフィルタ → 1つの「その他」に集約
for (let layer = 0; layer <= 4; layer++) {
  const sortedNodes = [...nodes].sort((a, b) => b.amount - a.amount)
  const visibleNodes = sortedNodes.filter(n => n.amount >= threshold)
  const hiddenNodes = sortedNodes.filter(n => n.amount < threshold)

  // 「その他」ノードは1つだけ
  if (hiddenNodes.length > 0) {
    const otherNode = createOtherNode(hiddenNodes, layer)
  }
}
```

**効果**:
- 支出先レイヤーで4つの個別ノード + 1つの集約ノードのみ表示
- 構造がシンプルになり理解しやすい

---

### Phase 9: Y座標の動的再計算（隙間の解消）

#### 問題: ノード間の不自然な隙間

- 事前計算されたY位置をそのまま使用していた
- 非表示ノードのY位置分の隙間が残る
- 「ズームすると集約ノードから個別ノードが出現」という動作が期待通りでない

#### 解決策: 表示ノードのY座標を動的に再計算

```typescript
// 表示ノードを隙間なく詰めて配置
let currentY = 0
for (const node of visibleNodes) {
  const repositionedNode = {
    ...node,
    y: currentY + node.height / 2,
  }
  currentY += node.height // 隙間なし
}

// 「その他」ノードは表示ノードの直下に配置
if (hiddenNodes.length > 0) {
  const otherNode = {
    ...createOtherNode(hiddenNodes),
    y: currentY + otherHeight / 2,
  }
}
```

**効果**:
- ノード間の隙間が解消
- ズームインで閾値が下がり、「その他」から個別ノードが出現する動作が実現

---

### Phase 10: 「その他」ノードへのエッジ非表示

#### 問題: 集約ノードへのエッジをどう描画するか

選択肢:
1. 集約されたノードすべてのエッジを「その他」に接続
2. エッジは描画しない（シンプル）

#### 解決: エッジは描画しない

```typescript
// 「その他」ノードへのエッジはスキップ
if (edge.targetId.startsWith('other-') || edge.sourceId.startsWith('other-')) {
  continue
}
```

**理由**:
- 集約ノードへの大量のエッジは視覚的にノイズになる
- ズームインすれば個別ノードとエッジが表示される

---

### Phase 11: ミニマップとFitToScreenの座標系統一

#### 問題: ミニマップの表示範囲が実際の表示と一致しない

- ミニマップは元データ（約25,000px高さ）を表示
- メインビューはフィルタリング後のデータ（約2,500px高さ）を表示
- Fitボタンで3%ズームになる（本来は40%）

#### 原因の分析

1. `DeckGLCanvas` と `BudgetFlowMap` で別々に `useZoomVisibility` を呼び出していた
2. ミニマップは `scaledData`（元データ）を受け取っていた
3. `handleFitToScreen` は `scaledData.bounds` を使用していた

#### 解決策: フィルタリングロジックの一元化

```typescript
// BudgetFlowMap.tsx

// 1. フィルタリングを一元管理
const zoomVisibility = useZoomVisibility(scaledData, {
  zoom: currentZoom,
  viewportBounds: null,
})

// 2. フィルタリング後のレイアウトデータを生成
const filteredLayoutData = useMemo(() => {
  // バウンディングボックスを再計算
  for (const node of zoomVisibility.visibleNodes) {
    minX = Math.min(minX, node.x - node.width / 2)
    // ...
  }
  return { ...scaledData, nodes: visibleNodes, bounds: newBounds }
}, [scaledData, zoomVisibility])

// 3. 両方のコンポーネントに同じデータを渡す
<DeckGLCanvas visibleNodes={zoomVisibility.visibleNodes} ... />
<Minimap layoutData={filteredLayoutData} ... />
```

**変更点**:
- `DeckGLCanvas` から `useZoomVisibility` を削除
- `BudgetFlowMap` で一元的にフィルタリング
- `handleFitToScreen` が `filteredLayoutData.bounds` を使用

**効果**:
- メインビューとミニマップが同じ座標系を共有
- Fitボタンで正しいズーム（約40%）にフィット
- ミニマップの表示範囲が正確

---

## 現在の実装状態

### しきい値設定

| Layer | 名称 | しきい値（zoom=0） |
|-------|------|-------------------|
| 0 | 府省 | 0（常時表示） |
| 1 | 局 | 0（常時表示） |
| 2 | 課 | 5000億円 |
| 3 | 事業 | 5兆円 |
| 4 | 支出先 | 10兆円 |

### スケール

- **1兆円 = 10px**
- 150兆円 → 1500px
- 最小高さ: 3px（「その他」ノード）

### 「その他」ノードの視覚表現

- **色**: 紫色 `[156, 39, 176, 200]`
- **位置**: 各レイヤーの表示ノードの直下
- **高さ**: 集約された金額の合計に比例（1兆円 = 10px）
- **エッジ**: なし（ズームインすれば個別ノードが出現）

### アーキテクチャ

```
BudgetFlowMap
  ├── useZoomVisibility (フィルタリング一元管理)
  │     └── filteredLayoutData (bounds再計算)
  ├── DeckGLCanvas (visibleNodes, visibleEdges受け取り)
  └── Minimap (filteredLayoutData受け取り)
```

---

## 残課題

1. **console.log の削除**: デバッグ用ログを本番前に削除
2. **ズーム時の閾値調整**: `4^zoom` での除算が適切か検証
3. **パフォーマンス**: 3万ノードでの useMemo 再計算コスト
4. **府省庁ごとのまとまり**: 現在は全レイヤーでグローバルにソート、府省庁ごとのグループ化は未対応

---

## 学んだこと

1. **事前計算 vs 動的計算**: ズーム連動機能は動的計算が必要
2. **階層構造の考慮**: 親が非表示の場合の処理が重要
3. **スケール設計**: 「画面に収まる」と「視認性」のバランス
4. **ユーザーフィードバックの重要性**: 実際の表示を見ながらの調整が必要
5. **座標系の統一**: 複数コンポーネントで同じデータを共有する場合、boundsの再計算が必要
6. **フィルタリングの一元化**: 複数箇所で同じフィルタリングを行うと座標系がズレる
7. **シンプルな解決策**: 親ベース集約より、レイヤー単位集約の方がシンプルで効果的
