#!/usr/bin/env npx tsx
/**
 * 現在のレイアウトから各ノードのサイズ(px)を分析・出力するスクリプト
 *
 * 出力: data/analysis/node-sizes.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface LayoutNode {
  id: string
  type: string
  layer: number
  name: string
  amount: number
  ministryId: string
  x: number
  y: number
  width: number
  height: number
  metadata: Record<string, unknown>
}

interface LayoutData {
  metadata: {
    canvasWidth: number
    canvasHeight: number
    nodeCount: number
    edgeCount: number
  }
  nodes: LayoutNode[]
  bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
}

interface NodeSizeInfo {
  id: string
  type: string
  layer: number
  name: string
  amount: number
  amountTrillion: number // 兆円単位
  ministryId: string
  width: number
  height: number
  x: number
  y: number
}

interface LayerStats {
  layer: number
  typeName: string
  nodeCount: number
  totalHeight: number
  avgHeight: number
  minHeight: number
  maxHeight: number
  heightDistribution: {
    under1px: number
    '1-5px': number
    '5-10px': number
    '10-50px': number
    '50-100px': number
    '100-500px': number
    '500px+': number
  }
}

async function main() {
  const inputPath = path.resolve(__dirname, '../public/data/layout.json')
  const outputDir = path.resolve(__dirname, '../data/analysis')
  const outputPath = path.resolve(outputDir, 'node-sizes.json')

  console.log('📊 ノードサイズ分析を開始...')
  console.log(`   入力: ${inputPath}`)

  // 出力ディレクトリを作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // layout.jsonを読み込み
  const layoutData: LayoutData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))

  console.log(`\n📈 レイアウト概要:`)
  console.log(`   キャンバス: ${layoutData.metadata.canvasWidth} x ${layoutData.metadata.canvasHeight}`)
  console.log(`   ノード数: ${layoutData.metadata.nodeCount}`)
  console.log(`   バウンド: (${layoutData.bounds.minX}, ${layoutData.bounds.minY}) - (${layoutData.bounds.maxX}, ${layoutData.bounds.maxY})`)

  // ノードサイズ情報を収集
  const nodeSizes: NodeSizeInfo[] = layoutData.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    layer: node.layer,
    name: node.name,
    amount: node.amount,
    amountTrillion: node.amount / 1e12, // 兆円単位
    ministryId: node.ministryId,
    width: node.width,
    height: node.height,
    x: node.x,
    y: node.y,
  }))

  // レイヤー別統計
  const typeNames = ['府省庁', '局', '課', '事業', '支出先']
  const layerStats: LayerStats[] = []

  for (let layer = 0; layer <= 4; layer++) {
    const layerNodes = nodeSizes.filter((n) => n.layer === layer)
    const heights = layerNodes.map((n) => n.height)

    const stats: LayerStats = {
      layer,
      typeName: typeNames[layer],
      nodeCount: layerNodes.length,
      totalHeight: heights.reduce((sum, h) => sum + h, 0),
      avgHeight: heights.length > 0 ? heights.reduce((sum, h) => sum + h, 0) / heights.length : 0,
      minHeight: heights.length > 0 ? Math.min(...heights) : 0,
      maxHeight: heights.length > 0 ? Math.max(...heights) : 0,
      heightDistribution: {
        under1px: heights.filter((h) => h < 1).length,
        '1-5px': heights.filter((h) => h >= 1 && h < 5).length,
        '5-10px': heights.filter((h) => h >= 5 && h < 10).length,
        '10-50px': heights.filter((h) => h >= 10 && h < 50).length,
        '50-100px': heights.filter((h) => h >= 50 && h < 100).length,
        '100-500px': heights.filter((h) => h >= 100 && h < 500).length,
        '500px+': heights.filter((h) => h >= 500).length,
      },
    }

    layerStats.push(stats)
  }

  // コンソールに統計を出力
  console.log('\n📊 レイヤー別統計:')
  console.log('─'.repeat(80))
  console.log(
    'Layer'.padEnd(8) +
      'Type'.padEnd(10) +
      'Count'.padEnd(8) +
      'TotalH'.padEnd(12) +
      'AvgH'.padEnd(10) +
      'MinH'.padEnd(8) +
      'MaxH'.padEnd(10)
  )
  console.log('─'.repeat(80))

  for (const stats of layerStats) {
    console.log(
      `${stats.layer}`.padEnd(8) +
        stats.typeName.padEnd(10) +
        `${stats.nodeCount}`.padEnd(8) +
        `${stats.totalHeight.toFixed(0)}px`.padEnd(12) +
        `${stats.avgHeight.toFixed(2)}px`.padEnd(10) +
        `${stats.minHeight.toFixed(2)}px`.padEnd(8) +
        `${stats.maxHeight.toFixed(0)}px`.padEnd(10)
    )
  }

  // 高さ分布を出力
  console.log('\n📊 高さ分布:')
  console.log('─'.repeat(80))
  console.log(
    'Layer'.padEnd(8) +
      '<1px'.padEnd(8) +
      '1-5px'.padEnd(8) +
      '5-10px'.padEnd(8) +
      '10-50px'.padEnd(10) +
      '50-100px'.padEnd(10) +
      '100-500px'.padEnd(12) +
      '500px+'.padEnd(8)
  )
  console.log('─'.repeat(80))

  for (const stats of layerStats) {
    const d = stats.heightDistribution
    console.log(
      `${stats.layer}`.padEnd(8) +
        `${d.under1px}`.padEnd(8) +
        `${d['1-5px']}`.padEnd(8) +
        `${d['5-10px']}`.padEnd(8) +
        `${d['10-50px']}`.padEnd(10) +
        `${d['50-100px']}`.padEnd(10) +
        `${d['100-500px']}`.padEnd(12) +
        `${d['500px+']}`.padEnd(8)
    )
  }

  // トップ10ノード（高さ順）
  console.log('\n📊 高さトップ10ノード:')
  console.log('─'.repeat(100))
  const topNodes = [...nodeSizes].sort((a, b) => b.height - a.height).slice(0, 10)
  for (const node of topNodes) {
    console.log(
      `  ${node.name.slice(0, 30).padEnd(32)} ` +
        `Layer ${node.layer} ` +
        `Height: ${node.height.toFixed(0).padStart(10)}px ` +
        `Amount: ${node.amountTrillion.toFixed(2).padStart(8)}兆円`
    )
  }

  // 府省庁ごとの統計
  console.log('\n📊 府省庁別統計（上位10）:')
  console.log('─'.repeat(80))

  const ministryNodes = nodeSizes.filter((n) => n.type === 'ministry')
  const ministryStats = ministryNodes
    .map((m) => {
      const children = nodeSizes.filter((n) => n.ministryId === m.name)
      return {
        name: m.name,
        height: m.height,
        amount: m.amountTrillion,
        childCount: children.length,
        childTotalHeight: children.reduce((sum, c) => sum + c.height, 0),
      }
    })
    .sort((a, b) => b.height - a.height)

  for (const m of ministryStats.slice(0, 10)) {
    console.log(
      `  ${m.name.slice(0, 20).padEnd(22)} ` +
        `Height: ${m.height.toFixed(0).padStart(10)}px ` +
        `Amount: ${m.amount.toFixed(2).padStart(8)}兆円 ` +
        `Children: ${m.childCount}`
    )
  }

  // 結果をJSONに出力
  const output = {
    generatedAt: new Date().toISOString(),
    layoutMetadata: layoutData.metadata,
    bounds: layoutData.bounds,
    layerStats,
    topNodes: topNodes.map((n) => ({
      name: n.name,
      layer: n.layer,
      type: n.type,
      height: n.height,
      amountTrillion: n.amountTrillion,
    })),
    allNodes: nodeSizes,
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(`\n✅ 出力完了: ${outputPath}`)

  const stats = fs.statSync(outputPath)
  console.log(`   ファイルサイズ: ${(stats.size / 1024).toFixed(1)} KB`)
}

main().catch((err) => {
  console.error('❌ エラー:', err)
  process.exit(1)
})
