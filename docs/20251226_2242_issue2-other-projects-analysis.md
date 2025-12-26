# Issue #2: 「その他の事業」配下の支出先も表示する - 現状分析と実装案

**作成日時**: 2025-12-26 22:42
**最終更新**: 2025-12-26 23:30
**Issue**: [#2](https://github.com/igomuni/budget-flow-map/issues/2)
**関連PR**: [#5](https://github.com/igomuni/budget-flow-map/pull/5) (「その他の支出先」府省庁横断化)
**優先度**: Medium
**ステータス**: 実装中

## 問題の概要

支出先タブ（RecipientsTab）で「その他の支出先」配下の支出先は正しく表示されるが、「その他の事業」配下の支出先が表示されない。

## 現状分析

### 動作するケース ✅

```
府省/局/課/事業 → 「その他の支出先」 → [個別支出先1, 個別支出先2, ...]
                   (Layer 4, isOther=true)
```

**処理フロー**:
1. BFSで「その他の支出先」ノードに到達
2. `targetNode.type === 'recipient' && targetNode.metadata.isOther` で検出
3. `metadata.aggregatedIds` を使って個別支出先を直接記録
4. エッジの金額を均等配分

### 動作しないケース ❌

#### ケース1: 事業 → その他の事業 → 支出先

```
事業 → 「その他の事業」 → 支出先A
       (Layer 3, isOther=true)  (Layer 4)
     → [集約事業1, 集約事業2, ...]
        (aggregatedIds)
```

#### ケース2: 組織 → その他の事業 → その他の支出先 → 個別支出先

```
府省/局/課 → 「その他の事業」 → 「その他の支出先」 → [個別支出先1, 個別支出先2, ...]
            (Layer 3, isOther=true)  (Layer 4, isOther=true)
          → [集約事業1, 集約事業2, ...]
             (aggregatedIds)
```

**問題点**:
- 「その他の事業」ノードは `type === 'project'` であり、Layer 4の「その他の支出先」と同じ構造を持つ
- しかし現在のBFSアルゴリズムは Layer 4（支出先）の「その他」ノードのみ特殊処理
- 「その他の事業」ノードは通常のprojectノードとして扱われ、出エッジがないため探索が停止

## 根本原因

### データ構造（compute-layout.ts）

「その他」ノードは以下の特徴を持つ:
- `metadata.isOther = true`
- `metadata.aggregatedIds = [集約されたノードのID配列]`
- **集約されたノードへの出エッジは作成されない**（視覚的な簡略化のため）

### 現在のBFSロジック（RecipientsTab.tsx:49-82）

```typescript
for (const edge of outgoingEdges) {
  const targetNode = nodes.find(n => n.id === edge.targetId)
  if (!targetNode) continue

  // Layer 4「その他の支出先」のみ特殊処理
  if (targetNode.type === 'recipient' && targetNode.metadata.isOther) {
    // aggregatedIds を使って個別支出先を記録
  }
  // 通常の支出先ノード
  else if (targetNode.type === 'recipient') {
    // 記録
  }
  // 支出先以外のノード → 探索継続
  else {
    if (!visited.has(targetNode.id)) {
      visited.add(targetNode.id)
      queue.push(targetNode.id)  // ← 「その他の事業」はここに該当するが、出エッジがないため停止
    }
  }
}
```

**問題**: 「その他の事業」ノードは `type === 'project'` なので「支出先以外のノード」として扱われるが、出エッジがないため、その先の探索ができない。

## 解決策の再考

### ❌ 複雑なアプローチ: BFS探索の拡張

「その他」ノード検出時に `aggregatedIds` を探索キューに追加する方法。

**問題点**:
- グラフ構造への依存度が高い
- 「サンキー図の文脈」と「一覧表示の文脈」が混在
- BFSロジックが複雑化し、保守性が低下
- エッジケースの考慮が必要

### ✅ シンプルなアプローチ: 直接フィルタリング（推奨）

**基本方針**: サンキー図の構造を辿らず、全ノードから直接フィルタリング

#### 支出先タブ（RecipientsTab）

選択ノードに関連する支出先を表示する = 「選択ノードと同じ府省庁の支出先」を表示

```typescript
// 現在: BFSでグラフを辿る（複雑）
const recipients = useMemo(() => {
  const recipientMap = new Map()
  const queue = [node.id]
  // ... BFSロジック
}, [node.id, edges, nodes])

// 新方式: sourceMinistries で直接フィルタ（シンプル＋正確）
const recipients = useMemo(() => {
  return nodes
    .filter(n =>
      n.type === 'recipient' &&
      !n.metadata.isOther &&
      n.metadata.sourceMinistries?.includes(node.ministryId) // ← 複数府省庁対応
    )
    .map(n => ({
      node: n,
      amount: calculateAmountFromEdges(n.id, edges) // エッジから実際の金額を計算
    }))
    .sort((a, b) => b.amount - a.amount)
}, [node.ministryId, nodes, edges])
```

**メリット**:
- グラフ構造に依存しない
- 「その他」ノードの存在を気にする必要がない
- コードが短く、理解しやすい
- パフォーマンスも良い（単純なフィルタ）

#### 事業タブ（ProjectsTab）

支出先に関連する事業を表示する = 「その支出先への入エッジを持つ事業」

```typescript
// 現在: 入エッジを辿る（やや複雑）
const projects = useMemo(() => {
  const projectMap = new Map()
  const incomingEdges = edges.filter(e => e.targetId === node.id)
  // ... 「その他」ノード経由の処理
}, [node.id, edges, nodes])

// 新方式: 全事業から支出先へのエッジでフィルタ（シンプル）
const projects = useMemo(() => {
  const projectsWithEdges = nodes
    .filter(n => n.type === 'project' && !n.metadata.isOther)
    .map(projectNode => {
      // この事業から選択支出先へのエッジを探す（直接 or 「その他の支出先」経由）
      const directEdges = edges.filter(e =>
        e.sourceId === projectNode.id && e.targetId === node.id
      )

      // 「その他の支出先」経由のエッジも探す
      const otherRecipientEdges = edges.filter(e => {
        if (e.sourceId !== projectNode.id) return false
        const target = nodes.find(n => n.id === e.targetId)
        return target?.type === 'recipient' &&
               target.metadata.isOther &&
               target.metadata.aggregatedIds?.includes(node.id)
      })

      const totalAmount = [...directEdges, ...otherRecipientEdges]
        .reduce((sum, e) => sum + e.value, 0)

      return { node: projectNode, amount: totalAmount }
    })
    .filter(p => p.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  return projectsWithEdges
}, [node.id, nodes, edges])
```

## 実装方針

### RecipientsTab の全面リファクタリング

**現在のBFSベース実装を削除し、シンプルなフィルタリングに置き換える**

```typescript
// src/components/InfoPanel/RecipientsTab.tsx

const recipients = useMemo(() => {
  // 支出先ノード自体は空配列
  if (node.type === 'recipient') return []

  // この府省庁から支出を受ける全支出先を取得（「その他」ノードを除く）
  const allRecipients = nodes.filter(n =>
    n.type === 'recipient' &&
    !n.metadata.isOther &&
    n.metadata.sourceMinistries?.includes(node.ministryId) // ← 複数府省庁対応
  )

  // 各支出先の金額をエッジから計算
  return allRecipients
    .map(recipient => {
      // この支出先への全入エッジの合計金額
      const totalAmount = edges
        .filter(e => e.targetId === recipient.id)
        .reduce((sum, e) => sum + e.value, 0)

      return { node: recipient, amount: totalAmount }
    })
    .filter(r => r.amount > 0) // 金額がある支出先のみ
    .sort((a, b) => b.amount - a.amount)
}, [node.type, node.ministryId, nodes, edges])
```

**特徴**:
- グラフ構造を辿らない
- 「その他の事業」も「その他の支出先」も特別扱い不要
- `sourceMinistries` でフィルタするだけ（複数府省庁支出先も正しく表示）

### ProjectsTab の簡略化（オプション）

現在の実装も悪くないが、さらにシンプルにできる:

```typescript
const projects = useMemo(() => {
  if (node.type !== 'recipient') return []

  // 全事業（「その他」を除く）から、この支出先へのエッジを探す
  const allProjects = nodes.filter(n =>
    n.type === 'project' &&
    !n.metadata.isOther
  )

  return allProjects
    .map(project => {
      // この事業からの直接エッジ
      const directAmount = edges
        .filter(e => e.sourceId === project.id && e.targetId === node.id)
        .reduce((sum, e) => sum + e.value, 0)

      // 「その他の支出先」経由のエッジ
      const otherRecipientAmount = edges
        .filter(e => {
          if (e.sourceId !== project.id) return false
          const target = nodes.find(n => n.id === e.targetId)
          return target?.type === 'recipient' &&
                 target.metadata.isOther &&
                 target.metadata.aggregatedIds?.includes(node.id)
        })
        .reduce((sum, e) => {
          const target = nodes.find(n => n.id === e.targetId)!
          const count = target.metadata.aggregatedIds?.length || 1
          return sum + (e.value / count) // 均等配分
        }, 0)

      return {
        node: project,
        amount: directAmount + otherRecipientAmount
      }
    })
    .filter(p => p.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}, [node.id, node.type, nodes, edges])
```

## 実装の影響範囲

### 修正ファイル

1. `src/components/InfoPanel/RecipientsTab.tsx` - **全面リファクタリング**（BFS削除、シンプルフィルタに置き換え）
2. `src/components/InfoPanel/ProjectsTab.tsx` - **簡略化**（オプション、現状維持でも可）

### 変更の規模

- **RecipientsTab**: 約100行 → 約30行（大幅削減）
- **ProjectsTab**: 微調整（現状でも動作するため、優先度低）

### テストケース

全て自動的に解決される:
1. ✅ 府省 → 局 → 課 → 事業 → 支出先（基本ケース）
2. ✅ 府省 → 局 → 課 → 「その他の事業」配下の支出先
3. ✅ 「その他の支出先」配下の個別支出先
4. ✅ 複数府省庁にまたがる支出先
5. ✅ エッジケース: 金額0の支出先（自動除外）

### パフォーマンス影響

**改善**:
- BFS探索（O(V+E)） → 単純フィルタ（O(N)）
- メモリ使用量削減（visitedセット、queue不要）
- コードの可読性・保守性向上

## 実装タスク

- [ ] RecipientsTab.tsx をシンプルフィルタリングに書き換え
- [ ] 動作確認（府省庁選択、局選択、課選択、事業選択）
- [ ] ProjectsTab.tsx の簡略化（オプション）
- [ ] ドキュメント更新（この分析ドキュメント）
- [ ] コミット・PR作成

## まとめ

**Before（複雑）**:
- BFSでグラフを辿る
- 「その他」ノードの特殊処理
- visited、queue、recipientMapの管理
- 100行超のコード

**After（シンプル）**:
- `sourceMinistries` でフィルタ（複数府省庁対応）
- エッジで金額計算
- 30行程度のコード
- グラフ構造に非依存

**利点**:
- Issue #2 が自動的に解決（「その他の事業」を特別扱い不要）
- コードが短く理解しやすい
- バグが入りにくい
- パフォーマンス向上

## 前提条件の再確認（2025-12-26 23:30追記）

### 支出先の `ministryId` について

当初、支出先の `ministryId` は不要と考えたが、以下の理由で必須:

1. **「その他の支出先」ノード生成**: 府省庁横断の単一ノードに変更（PR #5）したが、データ生成ロジックは残す
2. **「その他の事業」ノード生成**: 府省庁ごとに作成されるため `ministryId` が必要
3. **視覚的グルーピング**: 支出先は赤固定だが、将来的な拡張のため保持

### `ministryId` の決定方法

- **データ生成順**: CSVファイルの読み込み順で最初に見つかった府省庁
- **sourceMinistries**: 実際に支出している全府省庁のリスト
- **関係性**: `ministryId === sourceMinistries[0]` (100%一致)

### 複数府省庁支出先の統計

- **割合**: 16.9% (4,377件 / 25,892件)
- **最大**: 36府省庁から支出を受ける支出先が存在
- **対応**: `sourceMinistries` を使用したフィルタリングが必要

## 実装の前提条件

### RecipientsTab の要件

選択ノードに関連する支出先を表示する際:

1. **府省庁ノード選択時**: その府省庁の全支出先
2. **局/課/事業ノード選択時**: 親府省庁の全支出先
3. **複数府省庁支出先**: `sourceMinistries` で判定

**重要**: `ministryId` だけでは不十分。`sourceMinistries.includes(ministryId)` が必要。

## 実装タスクの更新

- [ ] RecipientsTab.tsx をシンプルフィルタリングに書き換え
  - `sourceMinistries` を使用したフィルタリング
  - 複数府省庁支出先の正しい表示
- [ ] 動作確認（府省庁選択、局選択、課選択、事業選択）
  - 複数府省庁支出先が正しく表示されるか確認
- [ ] ProjectsTab.tsx の簡略化（オプション）
- [ ] ドキュメント更新（この分析ドキュメント）
- [ ] コミット・PR作成

## 参考

- Issue: https://github.com/igomuni/budget-flow-map/issues/2
- 関連PR:
  - #3（支出先タブ実装）
  - #4（事業タブ実装）
  - #5（「その他の支出先」府省庁横断化）
- データ生成:
  - `scripts/generate-graph.ts` (sourceMinistries 生成ロジック)
  - `scripts/compute-layout.ts` (「その他」ノード生成ロジック)
- 分析スクリプト: `scripts/analyze-recipients.js`
