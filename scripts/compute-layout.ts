#!/usr/bin/env npx tsx
/**
 * グラフ → レイアウトJSON 変換スクリプト
 *
 * 入力: data/intermediate/graph-raw.json
 * 出力: public/data/layout.json (座標付きノード・Bezierパス付きエッジ)
 *
 * d3-sankey を使用して5層Sankeyレイアウトを計算
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import type { SankeyNode, SankeyLink } from 'd3-sankey'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================================
// 型定義
// ============================================================================

type NodeType = 'ministry' | 'bureau' | 'division' | 'project' | 'recipient'
type LayerIndex = 0 | 1 | 2 | 3 | 4

interface RawNode {
  id: string
  type: NodeType
  layer: number
  name: string
  amount: number
  ministryId: string
  metadata: Record<string, unknown>
}

interface RawEdge {
  id: string
  sourceId: string
  targetId: string
  value: number
}

interface RawGraph {
  metadata: {
    generatedAt: string
    fiscalYear: number
    sourceFiles: string[]
  }
  nodes: RawNode[]
  edges: RawEdge[]
}

// 出力型
interface LayoutNode {
  id: string
  type: NodeType
  layer: LayerIndex
  name: string
  amount: number
  ministryId: string
  x: number
  y: number
  width: number
  height: number
  metadata: Record<string, unknown>
}

interface LayoutEdge {
  id: string
  sourceId: string
  targetId: string
  value: number
  width: number
  path: [number, number][]
}

interface LayoutData {
  metadata: {
    generatedAt: string
    fiscalYear: number
    nodeCount: number
    edgeCount: number
    canvasWidth: number
    canvasHeight: number
  }
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
}

// d3-sankey用拡張型
interface SankeyNodeExtended {
  id: string
  type: NodeType
  layer: number
  name: string
  amount: number
  ministryId: string
  metadata: Record<string, unknown>
  // d3-sankeyが追加するプロパティ
  x0?: number
  x1?: number
  y0?: number
  y1?: number
}

interface SankeyLinkExtended {
  id: string
  source: SankeyNodeExtended | string | number
  target: SankeyNodeExtended | string | number
  value: number
  // d3-sankeyが追加するプロパティ
  width?: number
  y0?: number
  y1?: number
}

// ============================================================================
// レイアウト設定
// ============================================================================

const CANVAS_WIDTH = 4000 // 横幅
const CANVAS_HEIGHT = 8000 // 縦幅（32K+ノード対応）
const NODE_PADDING = 2 // ノード間の最小スペース
const NODE_WIDTH = 60 // ノードの幅

// レイヤーごとのX位置（5層を均等配置）
const LAYER_X_POSITIONS = [
  100, // Layer 0: 府省庁
  900, // Layer 1: 局
  1700, // Layer 2: 課
  2500, // Layer 3: 事業
  3300, // Layer 4: 支出先
]

// ============================================================================
// Bezierパス生成
// ============================================================================

function generateBezierPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  numPoints: number = 10
): [number, number][] {
  const points: [number, number][] = []

  // 水平Bezier曲線の制御点
  const midX = (sourceX + targetX) / 2

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints

    // 3次Bezier曲線: P0 -> P1 -> P2 -> P3
    // P0 = (sourceX, sourceY)
    // P1 = (midX, sourceY)
    // P2 = (midX, targetY)
    // P3 = (targetX, targetY)
    const x =
      (1 - t) ** 3 * sourceX +
      3 * (1 - t) ** 2 * t * midX +
      3 * (1 - t) * t ** 2 * midX +
      t ** 3 * targetX

    const y =
      (1 - t) ** 3 * sourceY +
      3 * (1 - t) ** 2 * t * sourceY +
      3 * (1 - t) * t ** 2 * targetY +
      t ** 3 * targetY

    points.push([Math.round(x), Math.round(y)])
  }

  return points
}

// ============================================================================
// メイン処理
// ============================================================================

async function main() {
  const inputPath = path.resolve(__dirname, '../data/intermediate/graph-raw.json')
  const outputPath = path.resolve(__dirname, '../public/data/layout.json')

  console.log('📐 レイアウト計算を開始...')
  console.log(`   入力: ${inputPath}`)
  console.log(`   出力: ${outputPath}`)

  // グラフ読み込み
  const rawGraph: RawGraph = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
  console.log(`\n📊 グラフ読み込み完了: ${rawGraph.nodes.length} ノード, ${rawGraph.edges.length} エッジ`)

  // =========================================================================
  // Step 1: d3-sankey用のデータ構造に変換
  // =========================================================================
  console.log('\n🔧 d3-sankeyデータ構造に変換中...')

  // 有効なノードIDセット
  const validNodeIds = new Set(rawGraph.nodes.map((n) => n.id))

  // d3-sankey用ノード（layerを強制するため独自にソート）
  const sankeyNodes: SankeyNodeExtended[] = rawGraph.nodes.map((node) => ({
    ...node,
  }))

  // d3-sankey用リンク（source/targetはIDを使用）
  const sankeyLinks: SankeyLinkExtended[] = rawGraph.edges
    .filter((edge) => {
      return validNodeIds.has(edge.sourceId) && validNodeIds.has(edge.targetId)
    })
    .map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      value: Math.max(edge.value, 1), // 最小値1（0だとd3-sankeyがエラー）
    }))

  console.log(`   → ${sankeyNodes.length} ノード, ${sankeyLinks.length} リンク`)

  // =========================================================================
  // Step 2: d3-sankeyレイアウト計算
  // =========================================================================
  console.log('\n📏 d3-sankeyレイアウト計算中...')

  const sankeyGenerator = sankey<SankeyNodeExtended, SankeyLinkExtended>()
    .nodeId((d) => d.id)
    .nodeWidth(NODE_WIDTH)
    .nodePadding(NODE_PADDING)
    .extent([
      [0, 0],
      [CANVAS_WIDTH, CANVAS_HEIGHT],
    ])
    .nodeSort((a, b) => {
      // 同じレイヤー内では金額順（大きい順）
      return b.amount - a.amount
    })
    .linkSort((a, b) => {
      // リンクは値が大きい順
      return (b.value || 0) - (a.value || 0)
    })

  // Sankeyグラフ生成
  const sankeyGraph = sankeyGenerator({
    nodes: sankeyNodes.map((n) => ({ ...n })),
    links: sankeyLinks.map((l) => ({ ...l })),
  })

  console.log(`   → レイアウト計算完了`)

  // =========================================================================
  // Step 3: レイヤーごとのX座標を強制（d3-sankeyはレイヤー自動判定するが上書き）
  // =========================================================================
  console.log('\n🎯 レイヤー位置を調整中...')

  // レイヤーごとにノードをグループ化
  const nodesByLayer = new Map<number, typeof sankeyGraph.nodes>()
  for (const node of sankeyGraph.nodes) {
    const layer = (node as unknown as RawNode).layer || 0
    if (!nodesByLayer.has(layer)) {
      nodesByLayer.set(layer, [])
    }
    nodesByLayer.get(layer)!.push(node)
  }

  // 各レイヤーのX座標を設定し、Y座標を再計算
  for (const [layer, nodes] of nodesByLayer) {
    const layerX = LAYER_X_POSITIONS[layer] || LAYER_X_POSITIONS[4]

    // Y座標でソート（金額順を維持）
    nodes.sort((a, b) => (a.y0 || 0) - (b.y0 || 0))

    // Y座標を再配置
    let currentY = 0
    for (const node of nodes) {
      const height = (node.y1 || 0) - (node.y0 || 0)
      node.x0 = layerX
      node.x1 = layerX + NODE_WIDTH
      node.y0 = currentY
      node.y1 = currentY + height
      currentY += height + NODE_PADDING
    }
  }

  // =========================================================================
  // Step 4: 出力用データ構造に変換
  // =========================================================================
  console.log('\n📦 出力データ構造に変換中...')

  // ノードマップを作成（ID→座標）
  const nodePositions = new Map<
    string,
    { x0: number; x1: number; y0: number; y1: number }
  >()
  for (const node of sankeyGraph.nodes) {
    nodePositions.set(node.id, {
      x0: node.x0 || 0,
      x1: node.x1 || NODE_WIDTH,
      y0: node.y0 || 0,
      y1: node.y1 || 10,
    })
  }

  // LayoutNode作成
  const layoutNodes: LayoutNode[] = sankeyGraph.nodes.map((node) => {
    const x0 = node.x0 || 0
    const x1 = node.x1 || NODE_WIDTH
    const y0 = node.y0 || 0
    const y1 = node.y1 || 10
    const rawNode = node as unknown as RawNode

    return {
      id: node.id,
      type: rawNode.type,
      layer: rawNode.layer as LayerIndex,
      name: rawNode.name,
      amount: rawNode.amount,
      ministryId: rawNode.ministryId,
      x: (x0 + x1) / 2, // 中心X
      y: (y0 + y1) / 2, // 中心Y
      width: x1 - x0,
      height: Math.max(y1 - y0, 1),
      metadata: rawNode.metadata || {},
    }
  })

  // LayoutEdge作成（Bezierパス生成）
  const layoutEdges: LayoutEdge[] = []

  for (const link of sankeyGraph.links) {
    const sourceNode =
      typeof link.source === 'object' ? link.source : null
    const targetNode =
      typeof link.target === 'object' ? link.target : null

    if (!sourceNode || !targetNode) continue

    const sourceX = sourceNode.x1 || 0
    const sourceY = (link.y0 ?? (sourceNode.y0! + sourceNode.y1!) / 2)
    const targetX = targetNode.x0 || 0
    const targetY = (link.y1 ?? (targetNode.y0! + targetNode.y1!) / 2)

    const originalLink = link as unknown as SankeyLinkExtended

    layoutEdges.push({
      id: originalLink.id,
      sourceId: sourceNode.id,
      targetId: targetNode.id,
      value: link.value || 0,
      width: Math.max(link.width || 1, 0.5),
      path: generateBezierPath(sourceX, sourceY, targetX, targetY, 8),
    })
  }

  // バウンディングボックス計算
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
  for (const node of layoutNodes) {
    minX = Math.min(minX, node.x - node.width / 2)
    maxX = Math.max(maxX, node.x + node.width / 2)
    minY = Math.min(minY, node.y - node.height / 2)
    maxY = Math.max(maxY, node.y + node.height / 2)
  }

  // 出力データ
  const layoutData: LayoutData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      fiscalYear: rawGraph.metadata.fiscalYear,
      nodeCount: layoutNodes.length,
      edgeCount: layoutEdges.length,
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
    },
    nodes: layoutNodes,
    edges: layoutEdges,
    bounds: {
      minX: Math.floor(minX),
      maxX: Math.ceil(maxX),
      minY: Math.floor(minY),
      maxY: Math.ceil(maxY),
    },
  }

  // =========================================================================
  // Step 5: 出力
  // =========================================================================
  fs.writeFileSync(outputPath, JSON.stringify(layoutData))
  console.log(`\n✅ 出力完了: ${outputPath}`)

  // ファイルサイズ表示
  const stats = fs.statSync(outputPath)
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
  console.log(`   ファイルサイズ: ${sizeMB} MB`)

  // 圧縮
  console.log('\n🗜️  gzip圧縮中...')
  const { execSync } = await import('child_process')
  execSync(`gzip -k -f "${outputPath}"`)
  const gzStats = fs.statSync(`${outputPath}.gz`)
  const gzSizeMB = (gzStats.size / 1024 / 1024).toFixed(2)
  console.log(`   圧縮後: ${gzSizeMB} MB (${((gzStats.size / stats.size) * 100).toFixed(1)}%)`)

  console.log('\n📈 レイアウト統計:')
  console.log(`   キャンバス: ${CANVAS_WIDTH} x ${CANVAS_HEIGHT}`)
  console.log(`   バウンド: (${layoutData.bounds.minX}, ${layoutData.bounds.minY}) - (${layoutData.bounds.maxX}, ${layoutData.bounds.maxY})`)
  console.log(`   ノード: ${layoutData.nodes.length}`)
  console.log(`   エッジ: ${layoutData.edges.length}`)
}

main().catch((err) => {
  console.error('❌ エラー:', err)
  process.exit(1)
})
