import { useMemo } from 'react'
import type { LayoutData, LayoutNode, LayoutEdge } from '@/types/layout'

interface DynamicTopNOptions {
  topProjects: number
  topRecipients: number
}

/**
 * 動的にTopNフィルタリングを適用するフック
 * クライアントサイドでノードを集約し、エッジを再構築します
 */
export function useDynamicTopN(
  originalData: LayoutData | null,
  options: DynamicTopNOptions
): LayoutData | null {
  return useMemo(() => {
    if (!originalData) return null

    const { topProjects, topRecipients } = options

    // Layer 3と4のノードを金額順にソート
    const projectNodes = originalData.nodes
      .filter(n => n.layer === 3 && !n.metadata.isOther)
      .sort((a, b) => b.amount - a.amount)

    const recipientNodes = originalData.nodes
      .filter(n => n.layer === 4 && !n.metadata.isOther)
      .sort((a, b) => b.amount - a.amount)

    // TopN内のノードID
    const keptProjectIds = new Set(projectNodes.slice(0, topProjects).map(n => n.id))
    const keptRecipientIds = new Set(recipientNodes.slice(0, topRecipients).map(n => n.id))

    // 集約されるノードID
    const aggregatedProjectIds = new Set(projectNodes.slice(topProjects).map(n => n.id))
    const aggregatedRecipientIds = new Set(recipientNodes.slice(topRecipients).map(n => n.id))

    // 府省庁ごとの事業集約データ（事業は府省庁に依存）
    const projectsByMinistry = new Map<string, LayoutNode[]>()

    for (const node of originalData.nodes) {
      if (node.layer === 3 && aggregatedProjectIds.has(node.id)) {
        if (!projectsByMinistry.has(node.ministryId)) {
          projectsByMinistry.set(node.ministryId, [])
        }
        projectsByMinistry.get(node.ministryId)!.push(node)
      }
    }

    // 支出先は府省庁横断的に集約（単一のOtherノード）
    const aggregatedRecipients = originalData.nodes.filter(n =>
      n.layer === 4 && aggregatedRecipientIds.has(n.id)
    )

    // 新しいノードリスト作成
    const newNodes: LayoutNode[] = []
    const otherProjectMap = new Map<string, LayoutNode>() // ministryId -> otherProjectNode
    let otherRecipientNode: LayoutNode | null = null

    // Layer 0-2と、TopN内のLayer 3-4を追加
    for (const node of originalData.nodes) {
      if (node.layer <= 2) {
        newNodes.push(node)
      } else if (node.layer === 3 && keptProjectIds.has(node.id)) {
        newNodes.push(node)
      } else if (node.layer === 4 && keptRecipientIds.has(node.id)) {
        newNodes.push(node)
      }
    }

    // 府省庁ごとの事業Otherノードを作成
    for (const [ministryId, projects] of projectsByMinistry) {
      if (projects.length > 0) {
        const totalAmount = projects.reduce((sum, n) => sum + n.amount, 0)
        const avgY = projects.reduce((sum, n) => sum + n.y, 0) / projects.length
        const firstProject = projects[0]

        const otherNode: LayoutNode = {
          id: `other_${ministryId}_layer3_dynamic`,
          type: 'project',
          layer: 3,
          name: `その他の事業 (${projects.length}件)`,
          amount: totalAmount,
          ministryId,
          x: firstProject.x,
          y: avgY,
          width: firstProject.width,
          height: Math.max(2, Math.log10(totalAmount + 1) * 3),
          metadata: {
            isOther: true,
            aggregatedCount: projects.length,
            aggregatedIds: projects.map(n => n.id)
          }
        }
        newNodes.push(otherNode)
        otherProjectMap.set(ministryId, otherNode)
      }
    }

    // 支出先の単一Otherノードを作成（府省庁横断）
    if (aggregatedRecipients.length > 0) {
      const totalAmount = aggregatedRecipients.reduce((sum, n) => sum + n.amount, 0)
      const avgY = aggregatedRecipients.reduce((sum, n) => sum + n.y, 0) / aggregatedRecipients.length
      const firstRecipient = aggregatedRecipients[0]

      otherRecipientNode = {
        id: `other_recipients_layer4_dynamic`,
        type: 'recipient',
        layer: 4,
        name: `その他の支出先 (${aggregatedRecipients.length}件)`,
        amount: totalAmount,
        ministryId: '', // 府省庁に依存しない
        x: firstRecipient.x,
        y: avgY,
        width: firstRecipient.width,
        height: Math.max(2, Math.log10(totalAmount + 1) * 2),
        metadata: {
          isOther: true,
          aggregatedCount: aggregatedRecipients.length,
          aggregatedIds: aggregatedRecipients.map(n => n.id)
        }
      }
      newNodes.push(otherRecipientNode)
    }

    // エッジを再構築
    const newEdges: LayoutEdge[] = []
    const edgeMap = new Map<string, LayoutEdge>() // key: sourceId->targetId

    for (const edge of originalData.edges) {
      let newSourceId = edge.sourceId
      let newTargetId = edge.targetId

      // ソース（事業）が集約された場合 → 府省庁ごとのOtherノード
      if (aggregatedProjectIds.has(edge.sourceId)) {
        const sourceNode = originalData.nodes.find(n => n.id === edge.sourceId)
        if (sourceNode) {
          const otherNode = otherProjectMap.get(sourceNode.ministryId)
          if (otherNode) newSourceId = otherNode.id
        }
      }

      // ターゲット（事業）が集約された場合 → 府省庁ごとのOtherノード
      if (aggregatedProjectIds.has(edge.targetId)) {
        const targetNode = originalData.nodes.find(n => n.id === edge.targetId)
        if (targetNode) {
          const otherNode = otherProjectMap.get(targetNode.ministryId)
          if (otherNode) newTargetId = otherNode.id
        }
      }

      // ターゲット（支出先）が集約された場合 → 単一のOtherノード
      if (aggregatedRecipientIds.has(edge.targetId)) {
        if (otherRecipientNode) {
          newTargetId = otherRecipientNode.id
        }
      }

      // エッジを統合
      const edgeKey = `${newSourceId}->${newTargetId}`
      const existing = edgeMap.get(edgeKey)

      if (existing) {
        existing.value += edge.value
        existing.width = Math.max(0.5, Math.log10(existing.value + 1) * 2)
      } else {
        const sourceNode = newNodes.find(n => n.id === newSourceId)
        const targetNode = newNodes.find(n => n.id === newTargetId)

        if (sourceNode && targetNode) {
          const newEdge: LayoutEdge = {
            ...edge,
            id: `edge_${newSourceId}_${newTargetId}`,
            sourceId: newSourceId,
            targetId: newTargetId,
            path: [[sourceNode.x + sourceNode.width/2, sourceNode.y], [targetNode.x - targetNode.width/2, targetNode.y]]
          }
          edgeMap.set(edgeKey, newEdge)
        }
      }
    }

    newEdges.push(...edgeMap.values())

    // バウンディングボックス再計算
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const node of newNodes) {
      minX = Math.min(minX, node.x - node.width / 2)
      maxX = Math.max(maxX, node.x + node.width / 2)
      minY = Math.min(minY, node.y - node.height / 2)
      maxY = Math.max(maxY, node.y + node.height / 2)
    }

    return {
      ...originalData,
      metadata: {
        ...originalData.metadata,
        nodeCount: newNodes.length,
        edgeCount: newEdges.length,
        topNSettings: {
          projects: topProjects,
          recipients: topRecipients
        }
      },
      nodes: newNodes,
      edges: newEdges,
      bounds: {
        minX: Math.floor(minX),
        maxX: Math.ceil(maxX),
        minY: Math.floor(minY),
        maxY: Math.ceil(maxY),
      }
    }
  }, [originalData, options.topProjects, options.topRecipients])
}
