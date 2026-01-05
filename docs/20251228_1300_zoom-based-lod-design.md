# ズーム連動LOD（Level of Detail）設計

作成日: 2025-12-28
最終更新: 2026-01-04
ステータス: 基本実装完了

## 1. 概要

現在の「TopNフィルタリング」方式から「ズーム連動の閾値ベース集約」方式へ移行する。

### 1.1 現状（TopN方式）

- 事業Top500、支出先Top1000を表示
- それ以外は「その他」ノードに集約
- ズームレベルに関係なく、常に同じノード数を表示
- **問題**: ズームアウト時にも詳細ノードが存在し、パフォーマンスと視認性に課題

### 1.2 目標（ズーム連動LOD方式）

- TopNを廃止し、**閾値ベースの集約のみ**を使用
- ズームレベルに応じて集約閾値が動的に変化
- ズームアウト時: 高い閾値 → 大きなノードのみ表示
- ズームイン時: 低い閾値 → 詳細なノードまで表示
- **メンタルマップ保持**: 集約・展開時にノードが消えずに「その他」に統合/分離

---

## 2. 基準データ（Target Reference）

現在のTopN表示で得られる画面を基準とする。

**出典**: `data/analysis/displayed-nodes-20251228T033538.json`

### 2.1 表示範囲

```
bounds: (100, 0) - (1750, 1913)
キャンバス幅: 1650px
キャンバス高さ: 1913px
```

### 2.2 ノード数

| Layer | 種別 | ノード数 | 総高さ(px) |
|-------|------|----------|------------|
| 0 | 府省庁 | 37 | 171 |
| 1 | 局 | 181 | 287 |
| 2 | 課 | 1,037 | 1,128 |
| 3 | 事業 | 537 | 620 |
| 4 | 支出先 | 1,001 | 1,118 |
| **合計** | | **2,793** | - |

### 2.3 元データ（layout.json）

```
総ノード数: 32,609
総エッジ数: 41,574
キャンバス高さ: 308,755,569px（約3億px）
```

---

## 3. 設計原則

### 3.1 スケール基準

元のlayout.jsonのスケール（1px = 1兆円）を維持する。
これにより、ノードの高さが金額を直接反映する。

### 3.2 集約ルール

**TopNを使わない**。代わりに:

1. **閾値以上**: 個別ノードとして表示
2. **閾値未満**: 親単位で「その他」ノードに集約

集約の粒度:
- 事業（Layer 3）: 課（Layer 2）ごとに「その他の事業」
- 支出先（Layer 4）: 事業（Layer 3）ごとに「その他の支出先」

### 3.3 ズーム連動

| ズームレベル | 閾値 | 期待される表示 |
|-------------|------|----------------|
| -4〜-3（俯瞰） | 10兆円+ | 府省庁、大局のみ |
| -2〜-1（中間） | 1兆円 | 局・課の主要部分 |
| 0〜+1（詳細） | 1000億円 | 事業の詳細 |
| +2〜+3（超詳細） | 100億円 | 支出先の詳細 |

---

## 4. 実装アプローチ

### 4.1 クライアントサイド動的集約

現在の `useDynamicTopN` フックを `useDynamicLOD` に置き換える。

```typescript
interface LODConfig {
  // ズームレベルから閾値を計算
  getThreshold: (zoom: number) => number
}

function useDynamicLOD(
  rawData: LayoutData | null,
  zoom: number,
  config: LODConfig
): LayoutData | null
```

### 4.2 閾値計算式

```typescript
// 指数関数的にスケール
// zoom -4 → 閾値 10兆円 (1e13)
// zoom  0 → 閾値 1000億円 (1e11)
// zoom +4 → 閾値 10億円 (1e9)
const threshold = 1e11 * Math.pow(10, -zoom)
```

### 4.3 集約アルゴリズム

1. 各レイヤーで閾値を適用
2. 閾値未満のノードを親ごとにグループ化
3. グループを「その他」ノードに置換
4. エッジを再接続

### 4.4 パフォーマンス考慮

- デバウンス: ズーム変更後100msで集約を再計算
- メモ化: 同じズームレベルでは再計算しない
- 差分更新: 可能であれば差分のみ更新

---

## 5. 視覚的連続性（メンタルマップ保持）

### 5.1 ノード位置の安定性

「その他」ノードは集約されたノードの**重心位置**に配置する。
これにより、ズーム時にノードが大きくジャンプしない。

### 5.2 アニメーション

集約/展開時にはスムーズなトランジション（300ms）を適用。

### 5.3 視覚的ヒント

- 「その他」ノード: 点線ボーダーで区別
- 集約数をラベルに表示（例: 「その他（123件）」）

---

## 6. 段階的実装計画

### Phase 1: 基盤 ✅ 完了

- [x] `useZoomVisibility` フック作成（`useDynamicLOD`から改名）
  - ファイル: `src/hooks/useZoomVisibility.ts`
- [x] 閾値ベース集約ロジック実装
  - `amountToHeight()`: 金額から高さを計算
  - `getMinVisibleAmount()`: ズームから閾値を計算
- [x] TopN設定UIを廃止、固定閾値（1兆円）に統一
  - 詳細: [20251230_0030_height-scale-analysis.md](./20251230_0030_height-scale-analysis.md)

### Phase 2: ズーム連動 ✅ 完了

- [x] ズームレベルから閾値を計算するロジック
  - 公式: `threshold = 1兆円 / 4^zoom`
  - zoom=0: 1兆円、zoom=2: 625億円、zoom=4: 39億円...
- [x] メモ化による再計算抑制（useMemo使用）
- [x] レイヤー別の集約ルール
  - Layer 0-2（府省・局・課）: 集約なし、閾値以下は最小高さ（1px）
  - Layer 3-4（事業・支出先）: 閾値以下を「その他」に集約

### Phase 3: 視覚的改善 🚧 一部完了

- [x] 「その他」ノードのスタイル差別化
  - 最小高さ3px（通常ノードは1px）
  - 件数表示「その他（N件）」
- [ ] 集約/展開アニメーション → 未実装
- [ ] 位置の連続性保持 → 現状は全体レイアウト再計算

### Phase 4: maxZoom拡大 ✅ 完了

- [x] maxZoomを6→8に拡大
- [x] パフォーマンステスト（17,000ノード、60fps維持）
- 結果: 最大ズーム6400%、閾値1526万円、カバー率55%
- 根拠: [20260104_recipient-distribution-analysis.md](./20260104_recipient-distribution-analysis.md)

---

## 7. 制約と考慮事項

### 7.1 レイアウト計算

現在のレイアウトはビルド時に計算されている。
LOD方式でも同様に、ビルド時に全ノードの位置を計算し、
クライアント側では表示/非表示と「その他」への集約のみを行う。

### 7.2 エッジの再計算

集約時にエッジのパスを再計算する必要がある。
パフォーマンスへの影響を監視すること。

### 7.3 互換性

既存のURL共有機能（ノードID指定）との互換性を維持する。
選択されたノードが集約されている場合は、自動的に展開（閾値を下げる）。

---

## 8. 成功基準

1. **パフォーマンス**: ズーム操作時に60fps維持
2. **視認性**: ズームアウト時にノードが重ならない
3. **直感性**: ズームで詳細度が変わることが自然に感じられる
4. **連続性**: ズーム時にノードが突然消えたり現れたりしない

---

## 9. 参考

- [displayed-nodes-20251228T033538.json](../data/analysis/displayed-nodes-20251228T033538.json) - 基準データ
- [spec.ja.md](./spec.ja.md) - 仕様書
- [20251226_0730_roadmap.md](./20251226_0730_roadmap.md) - ロードマップ
- [20251230_0030_height-scale-analysis.md](./20251230_0030_height-scale-analysis.md) - 高さスケール分析
- [20260104_recipient-distribution-analysis.md](./20260104_recipient-distribution-analysis.md) - 金額分布分析
- [20260104_budget-scale-visualization.md](./20260104_budget-scale-visualization.md) - スケール可視化限界
- [20260104_data-aggregation-issue.md](./20260104_data-aggregation-issue.md) - 集約による情報損失

---

## 10. 実装済みコード

### useZoomVisibility.ts（抜粋）

```typescript
const VISIBILITY_THRESHOLD = 1e12 // 1兆円
const HEIGHT_SCALE = 1e-11 // 1兆円 = 10px
const MIN_NODE_HEIGHT = 1
const MIN_OTHER_NODE_HEIGHT = 3

function getMinVisibleAmount(layer: LayerIndex, zoom: number): number {
  const baseThreshold = BASE_THRESHOLDS[layer]
  if (baseThreshold === 0) return 0
  const effectiveZoom = Math.max(0, zoom)
  const reductionFactor = Math.pow(4, effectiveZoom)
  return baseThreshold / reductionFactor
}

function amountToHeight(amount: number, threshold: number, isOther: boolean = false): number {
  if (amount <= 0) return isOther ? MIN_OTHER_NODE_HEIGHT : MIN_NODE_HEIGHT
  if (isOther) return Math.max(MIN_OTHER_NODE_HEIGHT, amount * HEIGHT_SCALE)
  if (amount < threshold) return MIN_NODE_HEIGHT
  return Math.max(MIN_NODE_HEIGHT, amount * HEIGHT_SCALE)
}
```
