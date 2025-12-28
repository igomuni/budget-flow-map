#!/usr/bin/env npx tsx
/**
 * グラフ → レイアウトJSON 変換スクリプト
 *
 * 入力: data/intermediate/graph-raw.json
 * 出力: public/data/layout.json (座標付きノード・Bezierパス付きエッジ)
 *
 * 独自レイアウトアルゴリズム:
 * - 府省庁ごとに垂直セクションを分割
 * - 各セクション内で5層を左から右に配置
 * - ノードの重なりを防止
 * - 支出先は複数府省から参照される場合があるため特別処理
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

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

// ============================================================================
// レイアウト設定
// ============================================================================

// レイヤーごとのX位置（5層を左から右に配置）
const LAYER_X_POSITIONS: Record<number, number> = {
  0: 100,    // 府省庁
  1: 500,    // 局
  2: 900,    // 課
  3: 1300,   // 事業
  4: 1700,   // 支出先
}

const NODE_WIDTH = 50
const MIN_NODE_HEIGHT = 1 // 基準データと同じ最小高さ
const MIN_OTHER_NODE_HEIGHT = 3 // 「その他」ノードの最小高さ（視認性確保）
const NODE_VERTICAL_PADDING = 0 // 基準データでは隙間なし

// 最小ノード高さの閾値（高さ計算用）
// 1兆円 = 1e12円
const AMOUNT_THRESHOLD = 1e12 // 1兆円（円単位）

// 金額→高さの変換
// 1兆円 = 10px スケール（150兆円 → 1500px で画面に収まる）
// 金額は円単位
// isOther: 「その他」ノードは閾値を無視して金額比例で高さを計算
function amountToHeight(amount: number, isOther: boolean = false): number {
  if (amount <= 0) return isOther ? MIN_OTHER_NODE_HEIGHT : MIN_NODE_HEIGHT

  // 1兆円 = 10px のスケール
  const scale = 1e-11 // 1 / 1000億 = 1兆円 = 10px

  // 「その他」ノードは閾値を無視して金額比例、最小高さも大きめ
  if (isOther) {
    return Math.max(MIN_OTHER_NODE_HEIGHT, amount * scale)
  }

  // 通常ノード: 閾値以下は最小高さ
  if (amount <= AMOUNT_THRESHOLD) {
    return MIN_NODE_HEIGHT
  }

  return Math.max(MIN_NODE_HEIGHT, amount * scale)
}

// エッジ幅の計算（対数スケール）
function valueToWidth(value: number, maxValue: number): number {
  if (value <= 0) return 0.5
  const logScale = Math.log10(value + 1) / Math.log10(maxValue + 1)
  return Math.max(0.5, logScale * 20)
}

// ============================================================================
// Bezierパス生成
// ============================================================================

function generateBezierPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  numPoints: number = 8
): [number, number][] {
  const points: [number, number][] = []
  const midX = (sourceX + targetX) / 2

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
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
  console.log(`   モード: 全ノード（クライアント側動的集約用）`)

  const rawGraph: RawGraph = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
  console.log(`\n📊 グラフ読み込み完了: ${rawGraph.nodes.length} ノード, ${rawGraph.edges.length} エッジ`)

  // 全ノードをそのまま使用（クライアント側で動的に集約）
  const processGraph = rawGraph

  // =========================================================================
  // Step 1: ノードとエッジのマップを作成
  // =========================================================================
  console.log('\n🔧 データ構造を構築中...')

  const nodeMap = new Map<string, RawNode>()
  for (const node of processGraph.nodes) {
    nodeMap.set(node.id, node)
  }

  // エッジをソース→ターゲットのマップに
  const outgoingEdges = new Map<string, RawEdge[]>()
  const incomingEdges = new Map<string, RawEdge[]>()
  for (const edge of processGraph.edges) {
    if (!outgoingEdges.has(edge.sourceId)) outgoingEdges.set(edge.sourceId, [])
    if (!incomingEdges.has(edge.targetId)) incomingEdges.set(edge.targetId, [])
    outgoingEdges.get(edge.sourceId)!.push(edge)
    incomingEdges.get(edge.targetId)!.push(edge)
  }

  // 最大エッジ値を取得（スケーリング用）
  const maxEdgeValue = Math.max(...processGraph.edges.map((e) => e.value))

  // =========================================================================
  // Step 2: 府省庁ごとにノードをグループ化
  // =========================================================================
  console.log('\n📁 府省庁ごとにグループ化中...')

  // 府省庁ノードを金額順にソート
  const ministryNodes = processGraph.nodes
    .filter((n) => n.type === 'ministry')
    .sort((a, b) => b.amount - a.amount)

  console.log(`   → ${ministryNodes.length} 府省庁`)

  // 各府省庁に属するノードを収集
  const nodesByMinistry = new Map<string, Map<number, RawNode[]>>()

  for (const ministry of ministryNodes) {
    nodesByMinistry.set(ministry.id, new Map())
    for (let layer = 0; layer <= 4; layer++) {
      nodesByMinistry.get(ministry.id)!.set(layer, [])
    }
    // 府省庁自身をLayer 0に追加
    nodesByMinistry.get(ministry.id)!.get(0)!.push(ministry)
  }

  // 府省庁以外のノードを対応する府省庁に割り当て
  for (const node of processGraph.nodes) {
    if (node.type === 'ministry') continue

    // 府省庁IDからグループを特定
    const ministryId = findMinistryId(node, nodeMap, incomingEdges)
    if (!ministryId || !nodesByMinistry.has(ministryId)) continue

    const layerMap = nodesByMinistry.get(ministryId)!
    if (!layerMap.has(node.layer)) layerMap.set(node.layer, [])
    layerMap.get(node.layer)!.push(node)
  }

  // 各レイヤーのノードを金額順にソート（「その他」ノードは最後に配置）
  for (const [, layerMap] of nodesByMinistry) {
    for (const [, nodes] of layerMap) {
      nodes.sort((a, b) => {
        // 「その他」ノードは常に最後
        const aIsOther = a.metadata?.isOther === true
        const bIsOther = b.metadata?.isOther === true
        if (aIsOther && !bIsOther) return 1
        if (!aIsOther && bIsOther) return -1
        // 両方「その他」または両方通常の場合は金額順
        return b.amount - a.amount
      })
    }
  }

  // =========================================================================
  // Step 3: レイアウト計算（レイヤーごとに連続配置）
  // =========================================================================
  console.log('\n📏 レイアウト計算中...')

  const layoutNodes: LayoutNode[] = []
  const nodePositions = new Map<string, { x: number; y: number; height: number }>()

  // 各レイヤーのノードを収集（府省庁順、金額順にソート）
  const nodesByLayer = new Map<number, RawNode[]>()
  for (let layer = 0; layer <= 4; layer++) {
    nodesByLayer.set(layer, [])
  }

  // 府省庁順に各レイヤーのノードを収集
  for (const ministry of ministryNodes) {
    const layerMap = nodesByMinistry.get(ministry.id)!
    for (let layer = 0; layer <= 4; layer++) {
      const nodes = layerMap.get(layer) || []
      // 府省庁内は金額順でソート済み
      nodesByLayer.get(layer)!.push(...nodes)
    }
  }

  // 各レイヤーでノードを上から順に配置
  for (let layer = 0; layer <= 4; layer++) {
    const nodes = nodesByLayer.get(layer)!
    const layerX = LAYER_X_POSITIONS[layer]
    let nodeY = 0

    for (const node of nodes) {
      const isOther = node.metadata?.isOther === true
      const height = amountToHeight(node.amount, isOther)

      const layoutNode: LayoutNode = {
        id: node.id,
        type: node.type,
        layer: node.layer as LayerIndex,
        name: node.name,
        amount: node.amount,
        ministryId: node.ministryId,
        x: layerX + NODE_WIDTH / 2,
        y: nodeY + height / 2,
        width: NODE_WIDTH,
        height: height,
        metadata: node.metadata,
      }

      layoutNodes.push(layoutNode)
      nodePositions.set(node.id, {
        x: layoutNode.x,
        y: layoutNode.y,
        height: layoutNode.height,
      })

      nodeY += height + NODE_VERTICAL_PADDING
    }
  }

  // 支出先ノード（Layer 4）の位置を調整（入エッジの平均Y位置ベース）
  adjustRecipientPositionsByEdges(layoutNodes, nodePositions, processGraph.edges)

  console.log(`   → ${layoutNodes.length} ノード配置完了`)

  // =========================================================================
  // Step 4: エッジのパス生成
  // =========================================================================
  console.log('\n🔗 エッジパス生成中...')

  const layoutEdges: LayoutEdge[] = []

  for (const edge of processGraph.edges) {
    const sourcePos = nodePositions.get(edge.sourceId)
    const targetPos = nodePositions.get(edge.targetId)

    if (!sourcePos || !targetPos) continue

    const sourceNode = nodeMap.get(edge.sourceId)
    const targetNode = nodeMap.get(edge.targetId)
    if (!sourceNode || !targetNode) continue

    // ソースの右端からターゲットの左端へ
    const sourceX = LAYER_X_POSITIONS[sourceNode.layer] + NODE_WIDTH
    const targetX = LAYER_X_POSITIONS[targetNode.layer]

    layoutEdges.push({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      value: edge.value,
      width: valueToWidth(edge.value, maxEdgeValue),
      path: generateBezierPath(sourceX, sourcePos.y, targetX, targetPos.y),
    })
  }

  console.log(`   → ${layoutEdges.length} エッジ生成完了`)

  // =========================================================================
  // Step 5: バウンディングボックス計算と出力
  // =========================================================================
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const node of layoutNodes) {
    minX = Math.min(minX, node.x - node.width / 2)
    maxX = Math.max(maxX, node.x + node.width / 2)
    minY = Math.min(minY, node.y - node.height / 2)
    maxY = Math.max(maxY, node.y + node.height / 2)
  }

  const layoutData: LayoutData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      fiscalYear: rawGraph.metadata.fiscalYear,
      nodeCount: layoutNodes.length,
      edgeCount: layoutEdges.length,
      canvasWidth: Math.ceil(maxX) + 100,
      canvasHeight: Math.ceil(maxY) + 100,
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

  fs.writeFileSync(outputPath, JSON.stringify(layoutData))
  console.log(`\n✅ 出力完了: ${outputPath}`)

  const stats = fs.statSync(outputPath)
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
  console.log(`   ファイルサイズ: ${sizeMB} MB`)

  console.log('\n🗜️  gzip圧縮中...')
  const { execSync } = await import('child_process')
  execSync(`gzip -k -f "${outputPath}"`)
  const gzStats = fs.statSync(`${outputPath}.gz`)
  const gzSizeMB = (gzStats.size / 1024 / 1024).toFixed(2)
  console.log(`   圧縮後: ${gzSizeMB} MB (${((gzStats.size / stats.size) * 100).toFixed(1)}%)`)

  console.log('\n📈 レイアウト統計:')
  console.log(`   バウンド: (${layoutData.bounds.minX}, ${layoutData.bounds.minY}) - (${layoutData.bounds.maxX}, ${layoutData.bounds.maxY})`)
  console.log(`   ノード: ${layoutData.nodes.length}`)
  console.log(`   エッジ: ${layoutData.edges.length}`)
}

/**
 * ノードが属する府省庁IDを探す
 */
function findMinistryId(
  node: RawNode,
  nodeMap: Map<string, RawNode>,
  incomingEdges: Map<string, RawEdge[]>
): string | null {
  // ministryIdが既に設定されている場合はそれを使用
  if (node.ministryId) {
    // ministryIdは府省庁名なので、対応する府省庁ノードのIDを探す
    for (const [id, n] of nodeMap) {
      if (n.type === 'ministry' && n.name === node.ministryId) {
        return id
      }
    }
  }

  // インカミングエッジを辿って府省庁を探す
  const visited = new Set<string>()
  const queue = [node.id]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const current = nodeMap.get(currentId)
    if (!current) continue

    if (current.type === 'ministry') {
      return current.id
    }

    const edges = incomingEdges.get(currentId) || []
    for (const edge of edges) {
      queue.push(edge.sourceId)
    }
  }

  return null
}

/**
 * 支出先ノードの位置を調整（入エッジの平均Y位置ベース）
 * - 府省庁セクションに依存せず、入エッジの平均Y位置で配置
 * - 複数府省庁支出先にも対応
 */
function adjustRecipientPositionsByEdges(
  layoutNodes: LayoutNode[],
  nodePositions: Map<string, { x: number; y: number; height: number }>,
  edges: RawEdge[]
) {
  // 支出先ノードのみ取得
  const recipients = layoutNodes.filter(n => n.type === 'recipient')

  // 支出先ノードごとに、参照元のY位置を収集
  const recipientSources = new Map<string, number[]>()
  for (const edge of edges) {
    const sourcePos = nodePositions.get(edge.sourceId)
    if (!sourcePos) continue

    const targetNode = layoutNodes.find(n => n.id === edge.targetId)
    if (!targetNode || targetNode.type !== 'recipient') continue

    if (!recipientSources.has(edge.targetId)) {
      recipientSources.set(edge.targetId, [])
    }
    recipientSources.get(edge.targetId)!.push(sourcePos.y)
  }

  // 入エッジの平均Y位置でソート
  recipients.sort((a, b) => {
    const aYs = recipientSources.get(a.id) || [a.y]
    const bYs = recipientSources.get(b.id) || [b.y]
    const aAvg = aYs.reduce((sum, y) => sum + y, 0) / aYs.length
    const bAvg = bYs.reduce((sum, y) => sum + y, 0) / bYs.length
    return aAvg - bAvg
  })

  // 上から順に配置
  let currentY = 0
  for (const node of recipients) {
    node.y = currentY + node.height / 2
    const pos = nodePositions.get(node.id)
    if (pos) pos.y = node.y
    currentY += node.height + NODE_VERTICAL_PADDING
  }
}

main().catch((err) => {
  console.error('❌ エラー:', err)
  process.exit(1)
})
