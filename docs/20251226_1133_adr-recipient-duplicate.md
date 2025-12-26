# ADR: 支出先ノードの重複問題と対応方針

## ステータス
承認済み

## コンテキスト

支出先（recipient）レイヤーで同じ名前のノードが複数存在するケースが発見された。

### 発見事例: 「北海道」

| 項目 | ri3fldw | rcpjir |
|------|---------|--------|
| 府省庁 | 内閣府 | 消費者庁 |
| 金額 | 約2.4兆円 | 約69億円 |
| 法人番号 | `7000020010006` | （なし） |
| 所在地 | 札幌市中央区北三条西6丁目1 | （なし） |
| 法人種別 | 地方公共団体 | （なし） |

### 技術的原因

`scripts/generate-graph.ts` のノードID生成ロジック（380-383行目）:

```typescript
const recipientNodeId = corporateNumber
  ? createNodeId('recipient', corporateNumber)  // 法人番号でハッシュ
  : createNodeId('recipient', recipientName)    // 名前でハッシュ
```

- **法人番号あり**: 法人番号でIDを生成 → 同一法人は同一ノード
- **法人番号なし**: 名前でIDを生成 → 同名の異なる団体が同一ノードになるリスク

### ソースデータの問題

消費者庁の事業（農薬等ポジティブリスト制度推進事業）のCSVデータで、「北海道」の法人番号・所在地・法人種別が空欄。これはmarumie-rssystemのソースデータの品質問題。

## 決定

### 方針: 案2 - 名前での統一（ノード作成を優先）

法人番号がない場合も、支出先名で統一してノードを作成する。内部的に法人番号ありとなしのデータが混在することを許容する。

### 理由

1. **ノード作成の優先**: 可視化ツールとしてノードを作成することが最優先
2. **データ品質の現実**: 上流CSVデータの品質改善は時間がかかる
3. **ユーザー視点**: 同じ「北海道」が2つあると混乱を招く
4. **統計の一貫性**: 同名の支出先への支出を集計できる

### 許容するトレードオフ

- 異なる団体が同名の場合、誤って統合される可能性
- 法人番号が欠落したデータはメタデータが不完全なまま

## 実装変更

### 1. ノードID生成の統一

```typescript
// 変更前
const recipientNodeId = corporateNumber
  ? createNodeId('recipient', corporateNumber)
  : createNodeId('recipient', recipientName)

// 変更後（案2）
const recipientNodeId = createNodeId('recipient', recipientName)
```

### 2. メタデータのマージ戦略

同名支出先が複数回出現した場合、法人番号ありのデータを優先してメタデータをマージ:

```typescript
// 既存ノードに法人番号がなく、新しいデータに法人番号がある場合はマージ
if (!existingNode.metadata.corporateNumber && corporateNumber) {
  existingNode.metadata = { ...existingNode.metadata, ...newMetadata }
}
```

### 3. 複数府省庁の追跡

支出先が複数の府省庁から支出を受けている場合、すべての府省庁を記録:

```typescript
interface RecipientMetadata {
  corporateNumber?: string
  location?: string
  corporateType?: string
  sourceMinistries?: string[]  // 追加: 支出元府省庁リスト
}
```

## UI表示の改善

### 支出先パネルでの府省庁表示

「※ 複数府省から支出を受けている場合があります」という曖昧な表示ではなく、実際の府省庁リストを表示:

```
支出元府省:
・内閣府
・消費者庁
・農林水産省
```

## 影響範囲

- `scripts/generate-graph.ts`: ノードID生成とメタデータマージ
- `src/types/layout.ts`: RecipientMetadataの型定義
- `src/components/InfoPanel/BasicInfoTab.tsx`: 複数府省庁表示

## 関連課題

同様の問題が他の支出先でも発生している可能性がある。データ品質調査を別途実施することを推奨。

## 日付

2025-12-26
