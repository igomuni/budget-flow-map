# LODプロトタイプ実装プロンプト

## コンテキスト

budget-flow-mapプロジェクトで、現在のレイアウトは縦に3億pxあり、ズームアウトすると線にしか見えない問題がある。
Google Mapsのような「固定キャンバス + 動的LOD」アプローチで解決したい。

## 設計ドキュメント

詳細は `docs/20251228_dynamic_lod_design.md` を参照。

## データ分析結果（重要）

```
全体予算: 151兆円
Top1（厚生労働省）: 93.3兆円（全体の62%）

閾値別の表示ノード数:
- 1兆円以上: 79件
- 1000億円以上: 424件
- 100億円以上: 1,504件
- 10億円以上: 4,170件
```

## 実装タスク

### 1. データパイプライン（compute-layout-lod.ts）

既存の `scripts/compute-layout.ts` を参考に、新規ファイル `scripts/compute-layout-lod.ts` を作成。

**目標**:
- キャンバス高さを約3000pxに固定
- 1px = 930億円（Top1が約1000pxになる計算）
- 最小ノード高さ1px（それ未満は非表示扱い）

**出力**: `public/data/layout-lod.json.gz`

### 2. フロントエンド切り替え

`src/hooks/useLayoutData.ts` で読み込むファイルを切り替え可能にする。
（環境変数または設定で）

### 3. package.jsonにスクリプト追加

```json
{
  "scripts": {
    "data:layout-lod": "npx tsx scripts/compute-layout-lod.ts"
  }
}
```

## 実装の詳細

### ノード高さ計算

```typescript
const SCALE = 9.3e10  // 1px = 930億円
const MIN_HEIGHT = 1

function calculateHeight(amount: number): number {
  const height = amount / SCALE
  if (height < MIN_HEIGHT) return 0  // 非表示
  return Math.max(MIN_HEIGHT, height)
}
```

### Y座標の計算

府省庁を金額順にソートし、上から順に配置。
各府省庁内でも子ノードを金額順に配置。

### エッジパスの生成

既存の `generateSankeyPath` を流用。

## 期待する成果

- 俯瞰ビューで府省庁の全体像が見える
- ズームインで詳細が見える
- 現行版と比較可能

## 注意点

- 現行の `compute-layout.ts` は変更しない
- 新規ファイルで実装
- ビルド成功を確認してからコミット

---

## 開始コマンド

```bash
# ブランチ確認（feat/zoom-based-visibility で作業中）
git status

# 設計ドキュメント確認
cat docs/20251228_dynamic_lod_design.md

# 既存のcompute-layout.tsを参考に
cat scripts/compute-layout.ts
```
