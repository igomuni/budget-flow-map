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
const MIN_NODE_HEIGHT = 2
const NODE_VERTICAL_PADDING = 1
const MINISTRY_SECTION_PADDING = 20 // 府省間のパディング

// TopN設定（デフォルト値、コマンドライン引数で変更可能）
const DEFAULT_TOP_PROJECTS = 500  // Layer 3: 事業
const DEFAULT_TOP_RECIPIENTS = 1000 // Layer 4: 支出先

// 閾値（1兆円 = 1,000,000百万円）
const AMOUNT_THRESHOLD = 1000000 // 百万円単位

// 金額→高さの変換（閾値以下は最小高さ、閾値以上は線形スケール、最大高さ制限なし）
function amountToHeight(amount: number, maxAmount: number, layer: number): number {
  if (amount <= 0) return MIN_NODE_HEIGHT

  // 閾値以下は最小高さ
  if (amount <= AMOUNT_THRESHOLD) {
    return MIN_NODE_HEIGHT
  }

  // 閾値以上は線形スケール（最大高さ制限なし）
  // 金額に直接比例（スケール係数で調整）
  const scale = 0.000002 // 1兆円 = 2px → 10兆円 = 20px
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
  console.log(`   モード: 全データ（動的フィルタリング用）`)

  const rawGraph: RawGraph = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
  console.log(`\n📊 グラフ読み込み完了: ${rawGraph.nodes.length} ノード, ${rawGraph.edges.length} エッジ`)
  console.log(`   ※ 集約なし（クライアントサイドで動的フィルタリング）`)

  // =========================================================================
  // Step 1: ノードとエッジのマップを作成
  // =========================================================================
  console.log('\n🔧 データ構造を構築中...')

  const nodeMap = new Map<string, RawNode>()
  for (const node of rawGraph.nodes) {
    nodeMap.set(node.id, node)
  }

  // エッジをソース→ターゲットのマップに
  const outgoingEdges = new Map<string, RawEdge[]>()
  const incomingEdges = new Map<string, RawEdge[]>()
  for (const edge of rawGraph.edges) {
    if (!outgoingEdges.has(edge.sourceId)) outgoingEdges.set(edge.sourceId, [])
    if (!incomingEdges.has(edge.targetId)) incomingEdges.set(edge.targetId, [])
    outgoingEdges.get(edge.sourceId)!.push(edge)
    incomingEdges.get(edge.targetId)!.push(edge)
  }

  // 最大金額を取得（スケーリング用）
  const maxAmount = Math.max(...rawGraph.nodes.map((n) => n.amount))
  const maxEdgeValue = Math.max(...rawGraph.edges.map((e) => e.value))

  // =========================================================================
  // Step 2: 府省庁ごとにノードをグループ化
  // =========================================================================
  console.log('\n📁 府省庁ごとにグループ化中...')

  // 府省庁ノードを金額順にソート
  const ministryNodes = rawGraph.nodes
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
  for (const node of rawGraph.nodes) {
    if (node.type === 'ministry') continue

    // 府省庁IDからグループを特定
    const ministryId = findMinistryId(node, nodeMap, incomingEdges)
    if (!ministryId || !nodesByMinistry.has(ministryId)) continue

    const layerMap = nodesByMinistry.get(ministryId)!
    if (!layerMap.has(node.layer)) layerMap.set(node.layer, [])
    layerMap.get(node.layer)!.push(node)
  }

  // 各レイヤーのノードを金額順にソート
  for (const [, layerMap] of nodesByMinistry) {
    for (const [, nodes] of layerMap) {
      nodes.sort((a, b) => b.amount - a.amount)
    }
  }

  // =========================================================================
  // Step 3: レイアウト計算（府省庁ごとにセクション配置）
  // =========================================================================
  console.log('\n📏 レイアウト計算中...')

  const layoutNodes: LayoutNode[] = []
  const nodePositions = new Map<string, { x: number; y: number; height: number }>()
  const ministrySections = new Map<string, { startY: number; endY: number }>()

  let currentY = 0

  for (const ministry of ministryNodes) {
    const layerMap = nodesByMinistry.get(ministry.id)!
    const sectionStartY = currentY

    // 各レイヤーの高さを計算（Layer 0-3のみ、支出先は別処理）
    const layerHeights: number[] = []
    for (let layer = 0; layer <= 4; layer++) {
      const nodes = layerMap.get(layer) || []
      let totalHeight = 0
      for (const node of nodes) {
        totalHeight += amountToHeight(node.amount, maxAmount, layer) + NODE_VERTICAL_PADDING
      }
      layerHeights.push(totalHeight)
    }
    // セクション高さはLayer 0-3の最大値で決定（支出先は除外）
    const sectionHeight = Math.max(...layerHeights.slice(0, 4), 30)

    // 各レイヤーのノードを配置
    for (let layer = 0; layer <= 4; layer++) {
      const nodes = layerMap.get(layer) || []
      const layerX = LAYER_X_POSITIONS[layer]

      // このレイヤーのノードをセクション内で中央寄せ
      const totalNodesHeight = layerHeights[layer]
      let nodeY = sectionStartY + (sectionHeight - totalNodesHeight) / 2

      for (const node of nodes) {
        const height = amountToHeight(node.amount, maxAmount, layer)

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

    // 府省庁セクションの範囲を記録
    ministrySections.set(ministry.name, {
      startY: sectionStartY,
      endY: sectionStartY + sectionHeight,
    })

    currentY += sectionHeight + MINISTRY_SECTION_PADDING
  }

  // 支出先ノード（Layer 4）の位置を調整
  adjustRecipientPositions(layoutNodes, nodePositions, rawGraph.edges, nodeMap, ministrySections)

  console.log(`   → ${layoutNodes.length} ノード配置完了`)

  // =========================================================================
  // Step 4: エッジのパス生成
  // =========================================================================
  console.log('\n🔗 エッジパス生成中...')

  const layoutEdges: LayoutEdge[] = []

  for (const edge of rawGraph.edges) {
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
 * 全体でTopNを超えるノードを府省庁ごとの"Other"ノードに集約
 */
function aggregateTopN(
  rawGraph: RawGraph,
  topProjects: number,
  topRecipients: number
): { nodes: RawNode[]; edges: RawEdge[] } {
  console.log(`\n🔄 TopN集約中 (全体で事業: ${topProjects}, 支出先: ${topRecipients})...`)

  const nodeMap = new Map<string, RawNode>()
  for (const node of rawGraph.nodes) {
    nodeMap.set(node.id, node)
  }

  // Layer 3(事業)とLayer 4(支出先)を全体で金額順ソート
  const projectNodes = rawGraph.nodes.filter(n => n.layer === 3).sort((a, b) => b.amount - a.amount)
  const recipientNodes = rawGraph.nodes.filter(n => n.layer === 4).sort((a, b) => b.amount - a.amount)

  const keptProjects = new Set(projectNodes.slice(0, topProjects).map(n => n.id))
  const keptRecipients = new Set(recipientNodes.slice(0, topRecipients).map(n => n.id))

  console.log(`   事業: ${keptProjects.size}個別 + ${projectNodes.length - keptProjects.size}集約`)
  console.log(`   支出先: ${keptRecipients.size}個別 + ${recipientNodes.length - keptRecipients.size}集約`)

  // 府省庁ごとにノードをグループ化（集約用）
  const nodesByMinistry = new Map<string, Map<number, RawNode[]>>()

  for (const node of rawGraph.nodes) {
    if (node.type === 'ministry') {
      nodesByMinistry.set(node.id, new Map())
      for (let layer = 0; layer <= 4; layer++) {
        nodesByMinistry.get(node.id)!.set(layer, [])
      }
      nodesByMinistry.get(node.id)!.get(0)!.push(node)
    }
  }

  for (const node of rawGraph.nodes) {
    if (node.type === 'ministry') continue

    const ministryId = findMinistryIdForNode(node, nodeMap, rawGraph.edges)
    if (!ministryId || !nodesByMinistry.has(ministryId)) continue

    const layerMap = nodesByMinistry.get(ministryId)!
    if (!layerMap.has(node.layer)) layerMap.set(node.layer, [])
    layerMap.get(node.layer)!.push(node)
  }

  // 結果ノードとOtherノードマップ
  const resultNodes: RawNode[] = []
  const resultEdges: RawEdge[] = []
  const otherNodeIds = new Map<string, string>() // ministryId:layer -> otherNodeId

  // Layer 0-2のノードはそのまま追加
  for (const node of rawGraph.nodes) {
    if (node.layer <= 2) {
      resultNodes.push(node)
    }
  }

  // Layer 3(事業): TopN内のノードと、府省庁ごとのOtherノード
  for (const [ministryId, layerMap] of nodesByMinistry) {
    const projects = layerMap.get(3) || []
    const kept = projects.filter(n => keptProjects.has(n.id))
    const aggregated = projects.filter(n => !keptProjects.has(n.id))

    resultNodes.push(...kept)

    if (aggregated.length > 0) {
      const ministryNode = nodeMap.get(ministryId)
      const otherNodeId = `other_${ministryId}_layer3`
      const totalAmount = aggregated.reduce((sum, n) => sum + n.amount, 0)

      const otherNode: RawNode = {
        id: otherNodeId,
        type: 'project',
        layer: 3,
        name: `その他の事業 (${aggregated.length}件)`,
        amount: totalAmount,
        ministryId: ministryNode?.name || '',
        metadata: {
          isOther: true,
          aggregatedCount: aggregated.length,
          aggregatedIds: aggregated.map(n => n.id)
        }
      }

      resultNodes.push(otherNode)
      otherNodeIds.set(`${ministryId}:3`, otherNodeId)
    }
  }

  // Layer 4(支出先): TopN内のノードと、府省庁ごとのOtherノード
  for (const [ministryId, layerMap] of nodesByMinistry) {
    const recipients = layerMap.get(4) || []
    const kept = recipients.filter(n => keptRecipients.has(n.id))
    const aggregated = recipients.filter(n => !keptRecipients.has(n.id))

    resultNodes.push(...kept)

    if (aggregated.length > 0) {
      const ministryNode = nodeMap.get(ministryId)
      const otherNodeId = `other_${ministryId}_layer4`
      const totalAmount = aggregated.reduce((sum, n) => sum + n.amount, 0)

      const otherNode: RawNode = {
        id: otherNodeId,
        type: 'recipient',
        layer: 4,
        name: `その他の支出先 (${aggregated.length}件)`,
        amount: totalAmount,
        ministryId: ministryNode?.name || '',
        metadata: {
          isOther: true,
          aggregatedCount: aggregated.length,
          aggregatedIds: aggregated.map(n => n.id)
        }
      }

      resultNodes.push(otherNode)
      otherNodeIds.set(`${ministryId}:4`, otherNodeId)
    }
  }

  // エッジを再構築（Otherノードへのリダイレクト）
  const aggregatedNodeIds = new Set(
    Array.from(otherNodeIds.values()).flatMap(otherId => {
      const otherNode = resultNodes.find(n => n.id === otherId)
      return (otherNode?.metadata?.aggregatedIds as string[]) || []
    })
  )

  for (const edge of rawGraph.edges) {
    const source = nodeMap.get(edge.sourceId)
    const target = nodeMap.get(edge.targetId)
    if (!source || !target) continue

    let newSourceId = edge.sourceId
    let newTargetId = edge.targetId

    // ソースが集約された場合
    if (aggregatedNodeIds.has(edge.sourceId)) {
      const ministryId = findMinistryIdForNode(source, nodeMap, rawGraph.edges)
      if (ministryId) {
        const key = `${ministryId}:${source.layer}`
        newSourceId = otherNodeIds.get(key) || edge.sourceId
      }
    }

    // ターゲットが集約された場合
    if (aggregatedNodeIds.has(edge.targetId)) {
      const ministryId = findMinistryIdForNode(target, nodeMap, rawGraph.edges)
      if (ministryId) {
        const key = `${ministryId}:${target.layer}`
        newTargetId = otherNodeIds.get(key) || edge.targetId
      }
    }

    // 同じOtherノードへの重複エッジを防ぐ
    const edgeKey = `${newSourceId}->${newTargetId}`
    const existing = resultEdges.find(e => `${e.sourceId}->${e.targetId}` === edgeKey)

    if (existing) {
      existing.value += edge.value
    } else {
      resultEdges.push({
        id: `edge_${newSourceId}_${newTargetId}`,
        sourceId: newSourceId,
        targetId: newTargetId,
        value: edge.value
      })
    }
  }

  console.log(`   → 集約後: ${resultNodes.length} ノード, ${resultEdges.length} エッジ`)

  return { nodes: resultNodes, edges: resultEdges }
}

/**
 * ノードが属する府省庁IDを探す（集約用）
 */
function findMinistryIdForNode(
  node: RawNode,
  nodeMap: Map<string, RawNode>,
  edges: RawEdge[]
): string | null {
  if (node.type === 'ministry') return node.id

  if (node.ministryId) {
    for (const [id, n] of nodeMap) {
      if (n.type === 'ministry' && n.name === node.ministryId) {
        return id
      }
    }
  }

  // エッジを辿る
  const incomingEdges = edges.filter(e => e.targetId === node.id)
  for (const edge of incomingEdges) {
    const source = nodeMap.get(edge.sourceId)
    if (source) {
      const ministryId = findMinistryIdForNode(source, nodeMap, edges)
      if (ministryId) return ministryId
    }
  }

  return null
}

/**
 * 支出先ノードの位置を調整
 * - 府省庁ごとにセクション内で支出先を配置
 * - 重なりを解消しつつセクション内に収める
 */
function adjustRecipientPositions(
  layoutNodes: LayoutNode[],
  nodePositions: Map<string, { x: number; y: number; height: number }>,
  edges: RawEdge[],
  nodeMap: Map<string, RawNode>,
  ministrySections: Map<string, { startY: number; endY: number }>
) {
  // 府省庁ごとに支出先をグループ化
  const recipientsByMinistry = new Map<string, LayoutNode[]>()

  for (const node of layoutNodes) {
    if (node.type !== 'recipient') continue
    const ministryName = node.ministryId
    if (!recipientsByMinistry.has(ministryName)) {
      recipientsByMinistry.set(ministryName, [])
    }
    recipientsByMinistry.get(ministryName)!.push(node)
  }

  // 支出先ノードごとに、参照元のY位置を収集
  const recipientSources = new Map<string, number[]>()
  for (const edge of edges) {
    const targetNode = nodeMap.get(edge.targetId)
    if (!targetNode || targetNode.type !== 'recipient') continue

    const sourcePos = nodePositions.get(edge.sourceId)
    if (!sourcePos) continue

    if (!recipientSources.has(edge.targetId)) {
      recipientSources.set(edge.targetId, [])
    }
    recipientSources.get(edge.targetId)!.push(sourcePos.y)
  }

  // 各府省庁のセクション内で支出先を配置
  for (const [ministryName, recipients] of recipientsByMinistry) {
    const section = ministrySections.get(ministryName)
    if (!section) continue

    // 参照元の平均Y位置でソート
    recipients.sort((a, b) => {
      const aYs = recipientSources.get(a.id) || [a.y]
      const bYs = recipientSources.get(b.id) || [b.y]
      const aAvg = aYs.reduce((x, y) => x + y, 0) / aYs.length
      const bAvg = bYs.reduce((x, y) => x + y, 0) / bYs.length
      return aAvg - bAvg
    })

    // セクション内で均等配置
    const totalHeight = recipients.reduce((sum, n) => sum + n.height + NODE_VERTICAL_PADDING, 0)
    const availableHeight = section.endY - section.startY
    const startY = section.startY + Math.max(0, (availableHeight - totalHeight) / 2)

    let currentY = startY
    for (const node of recipients) {
      node.y = currentY + node.height / 2
      const pos = nodePositions.get(node.id)
      if (pos) pos.y = node.y
      currentY += node.height + NODE_VERTICAL_PADDING
    }
  }
}

main().catch((err) => {
  console.error('❌ エラー:', err)
  process.exit(1)
})
