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

    // Layer 0-2を追加
    for (const node of originalData.nodes) {
      if (node.layer <= 2) {
        newNodes.push(node)
      }
    }

    // Layer 3 (事業): 府省庁ごとにTopN内のノードを金額降順で並べ替え、Y座標を再計算
    const projectsByMinistryForLayout = new Map<string, LayoutNode[]>()

    for (const node of originalData.nodes) {
      if (node.layer === 3 && keptProjectIds.has(node.id)) {
        if (!projectsByMinistryForLayout.has(node.ministryId)) {
          projectsByMinistryForLayout.set(node.ministryId, [])
        }
        projectsByMinistryForLayout.get(node.ministryId)!.push(node)
      }
    }

    const projectSpacing = 1 // ノード間のスペーシング
    const otherGap = 3 // 「その他」ノードの前の間隔（通常スペーシングの倍数）
    const ministryProjectYPositions = new Map<string, number>() // 府省庁ごとの現在Y座標を追跡

    // 府省庁ごとに事業ノードをソートして配置
    for (const [ministryId, projects] of projectsByMinistryForLayout) {
      // 金額降順でソート
      const sortedProjects = projects.sort((a, b) => b.amount - a.amount)

      // この府省庁の開始Y座標（最初のノードのY座標を使用）
      let currentY = sortedProjects.length > 0 ? sortedProjects[0].y - sortedProjects[0].height / 2 : 0

      const repositionedProjects = sortedProjects.map(node => {
        const newNode = {
          ...node,
          y: currentY + node.height / 2 // 中心座標
        }
        currentY += node.height + projectSpacing
        return newNode
      })

      newNodes.push(...repositionedProjects)

      // この府省庁の「その他」ノードの配置用にcurrentYを保存
      // 「その他」ノードの前に追加の間隔を設ける
      ministryProjectYPositions.set(ministryId, currentY + projectSpacing * otherGap)
    }

    // Layer 4 (支出先): TopN内のノードを金額降順で並べ替え、Y座標を再計算
    const keptRecipientNodes = originalData.nodes
      .filter(n => n.layer === 4 && keptRecipientIds.has(n.id))
      .sort((a, b) => b.amount - a.amount)

    // 支出先のY座標を金額降順に再配置
    const recipientStartY = 0 // 開始Y座標
    const recipientSpacing = 3 // ノード間のスペーシング
    let currentY = recipientStartY

    const repositionedRecipients = keptRecipientNodes.map(node => {
      const newNode = {
        ...node,
        y: currentY + node.height / 2 // 中心座標
      }
      currentY += node.height + recipientSpacing
      return newNode
    })

    newNodes.push(...repositionedRecipients)

    // 府省庁ごとの事業Otherノードを作成（各府省庁セクションの最下位に配置）
    for (const [ministryId, projects] of projectsByMinistry) {
      if (projects.length > 0) {
        const totalAmount = projects.reduce((sum, n) => sum + n.amount, 0)
        const firstProject = projects[0]
        const otherHeight = Math.max(2, Math.log10(totalAmount + 1) * 3)

        // 府省庁ごとの現在Y座標を取得（保存されている位置）
        const otherY = ministryProjectYPositions.get(ministryId) || firstProject.y

        const otherNode: LayoutNode = {
          id: `other_${ministryId}_layer3_dynamic`,
          type: 'project',
          layer: 3,
          name: `その他の事業 (${projects.length}件)`,
          amount: totalAmount,
          ministryId,
          x: firstProject.x,
          y: otherY + otherHeight / 2, // 最下位に配置
          width: firstProject.width,
          height: otherHeight,
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
    // Y座標は全支出先の最下位（currentYの続き）に配置
    if (aggregatedRecipients.length > 0) {
      const totalAmount = aggregatedRecipients.reduce((sum, n) => sum + n.amount, 0)
      const firstRecipient = aggregatedRecipients[0]
      const otherHeight = Math.max(2, Math.log10(totalAmount + 1) * 2)

      otherRecipientNode = {
        id: `other_recipients_layer4_dynamic`,
        type: 'recipient',
        layer: 4,
        name: `その他の支出先 (${aggregatedRecipients.length}件)`,
        amount: totalAmount,
        ministryId: '', // 府省庁に依存しない
        x: firstRecipient.x,
        y: currentY + otherHeight / 2, // 最下位に配置
        width: firstRecipient.width,
        height: otherHeight,
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
