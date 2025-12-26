import { useMemo } from 'react'
import { generateSankeyPath } from '@/utils/sankeyPath'
import type { LayoutData, LayoutNode, LayoutEdge } from '@/types/layout'

interface DynamicTopNOptions {
  topProjects: number
  topRecipients: number
  threshold: number // 円単位（1兆円 = 1e12）
}

// 定数
// 閾値を基準に線形スケール: 閾値 = MIN_HEIGHT
// 例: 閾値1000億円なら、1000億円 = 1px, 2000億円 = 2px, 1兆円 = 10px
const MIN_HEIGHT = 1

/**
 * 動的にTopNフィルタリングと閾値ベースの高さ調整を適用するフック
 */
export function useDynamicTopN(
  originalData: LayoutData | null,
  options: DynamicTopNOptions
): LayoutData | null {
  return useMemo(() => {
    if (!originalData) return null

    const { topProjects, topRecipients, threshold } = options

    // 閾値に基づいてノードの高さを計算
    // 閾値未満: MIN_HEIGHT
    // 閾値以上: (金額 / 閾値) × MIN_HEIGHT
    const calculateHeight = (amount: number): number => {
      if (amount < threshold) {
        return MIN_HEIGHT
      }
      return (amount / threshold) * MIN_HEIGHT
    }

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

    // 府省庁ごとの事業集約データ
    const projectsByMinistry = new Map<string, LayoutNode[]>()
    for (const node of originalData.nodes) {
      if (node.layer === 3 && aggregatedProjectIds.has(node.id) && node.ministryId) {
        if (!projectsByMinistry.has(node.ministryId)) {
          projectsByMinistry.set(node.ministryId, [])
        }
        projectsByMinistry.get(node.ministryId)!.push(node)
      }
    }

    // 支出先は府省庁横断で集約
    const aggregatedRecipients = originalData.nodes.filter(n =>
      n.layer === 4 && aggregatedRecipientIds.has(n.id)
    )

    // 新しいノードリスト
    const newNodes: LayoutNode[] = []
    const otherProjectMap = new Map<string, LayoutNode>()
    let otherRecipientNode: LayoutNode | null = null

    // nodeSpacingは常に0（BudgetFlowMapでnodeSpacingYを適用）
    const nodeSpacing = 0

    // Layer 0-2を府省庁ごとにグループ化
    const nodesByMinistryByLayer = new Map<string, Map<number, LayoutNode[]>>()
    for (const node of originalData.nodes) {
      if (node.layer <= 2 && node.ministryId) {
        if (!nodesByMinistryByLayer.has(node.ministryId)) {
          nodesByMinistryByLayer.set(node.ministryId, new Map())
        }
        const layerMap = nodesByMinistryByLayer.get(node.ministryId)!
        if (!layerMap.has(node.layer)) {
          layerMap.set(node.layer, [])
        }
        layerMap.get(node.layer)!.push(node)
      }
    }

    // 府省庁を金額順にソート
    const sortedMinistries = Array.from(nodesByMinistryByLayer.entries())
      .sort(([, aMap], [, bMap]) => {
        const aMinistry = (aMap.get(0) || [])[0]
        const bMinistry = (bMap.get(0) || [])[0]
        return (bMinistry?.amount || 0) - (aMinistry?.amount || 0)
      })

    // 府省庁ごとにLayer 0-3をまとめて配置しつつ、各レイヤーのTopを揃える
    const ministryEndY = new Map<string, number>()
    const ministrySectionPadding = 20 // 府省庁間のパディング

    // 各レイヤーの現在のY位置を追跡（全府省庁で共有）
    const layerCurrentY = new Map<number, number>()
    for (let layer = 0; layer <= 3; layer++) {
      layerCurrentY.set(layer, 0)
    }

    // Layer 3 (事業) を府省庁ごとにグループ化
    const projectsByMinistryForLayout = new Map<string, LayoutNode[]>()
    for (const node of originalData.nodes) {
      if (node.layer === 3 && keptProjectIds.has(node.id) && node.ministryId) {
        if (!projectsByMinistryForLayout.has(node.ministryId)) {
          projectsByMinistryForLayout.set(node.ministryId, [])
        }
        projectsByMinistryForLayout.get(node.ministryId)!.push(node)
      }
    }

    for (const [ministryId, layerMap] of sortedMinistries) {
      const layerEndY = new Map<number, number>()

      // Layer 0 (府省) を配置
      let layer0Y = layerCurrentY.get(0)!
      const ministryNodes = (layerMap.get(0) || []).sort((a, b) => b.amount - a.amount)
      for (const node of ministryNodes) {
        const height = calculateHeight(node.amount)
        newNodes.push({
          ...node,
          height,
          y: layer0Y + height / 2
        })
        layer0Y += height + nodeSpacing
      }
      layerEndY.set(0, layer0Y)
      layerCurrentY.set(0, layer0Y)

      // Layer 1 (局) を配置し、各局のY位置を記録
      let layer1Y = layerCurrentY.get(1)!
      const bureauNodes = (layerMap.get(1) || []).sort((a, b) => b.amount - a.amount)
      const bureauYPositions = new Map<string, number>() // 局ID → Y位置

      for (const node of bureauNodes) {
        const height = calculateHeight(node.amount)
        const yPos = layer1Y + height / 2
        newNodes.push({
          ...node,
          height,
          y: yPos
        })
        bureauYPositions.set(node.id, yPos) // 局の中心Y位置を記録
        layer1Y += height + nodeSpacing
      }
      layerEndY.set(1, layer1Y)
      layerCurrentY.set(1, layer1Y)

      // Layer 2 (課) を配置 - 所属する局の位置順に合わせるが、重ならないように順次配置
      const divisionNodes = (layerMap.get(2) || [])

      // 局ごとに課をグループ化（局がない場合は府省から直接接続）
      const divisionsByBureau = new Map<string, LayoutNode[]>()
      const divisionsWithoutBureau: LayoutNode[] = []

      for (const div of divisionNodes) {
        // 元データから課の親（局 or 府省）を探す
        const parentEdge = originalData.edges.find(e => e.targetId === div.id)
        if (parentEdge) {
          const parentNode = originalData.nodes.find(n => n.id === parentEdge.sourceId)
          if (parentNode?.layer === 1) {
            // 親が局の場合
            const bureauId = parentEdge.sourceId
            if (!divisionsByBureau.has(bureauId)) {
              divisionsByBureau.set(bureauId, [])
            }
            divisionsByBureau.get(bureauId)!.push(div)
          } else if (parentNode?.layer === 0) {
            // 親が府省の場合（局がない）
            divisionsWithoutBureau.push(div)
          }
        }
      }

      // 局のY位置順に課を配置（重ならないように順次配置）
      let layer2Y = layerCurrentY.get(2)!

      // 局をY位置順にソート
      const sortedBureaus = Array.from(divisionsByBureau.entries())
        .map(([bureauId, divisions]) => ({
          bureauId,
          divisions,
          bureauY: bureauYPositions.get(bureauId) || 0
        }))
        .sort((a, b) => a.bureauY - b.bureauY)

      for (const { divisions } of sortedBureaus) {
        // この局に属する課を金額順でソート
        const sortedDivisions = divisions.sort((a, b) => b.amount - a.amount)

        for (const node of sortedDivisions) {
          const height = calculateHeight(node.amount)
          newNodes.push({
            ...node,
            height,
            y: layer2Y + height / 2
          })
          layer2Y += height + nodeSpacing
        }
      }

      // 局がない課（府省から直接接続）を配置
      if (divisionsWithoutBureau.length > 0) {
        const sortedDivisionsWithoutBureau = divisionsWithoutBureau.sort((a, b) => b.amount - a.amount)
        for (const node of sortedDivisionsWithoutBureau) {
          const height = calculateHeight(node.amount)
          newNodes.push({
            ...node,
            height,
            y: layer2Y + height / 2
          })
          layer2Y += height + nodeSpacing
        }
      }

      layerEndY.set(2, layer2Y)
      layerCurrentY.set(2, layer2Y)

      // Layer 3 (事業) を配置
      let layer3Y = layerCurrentY.get(3)!
      const projects = projectsByMinistryForLayout.get(ministryId)
      if (projects && projects.length > 0) {
        const sortedProjects = projects.sort((a, b) => b.amount - a.amount)
        for (const node of sortedProjects) {
          const height = calculateHeight(node.amount)
          newNodes.push({
            ...node,
            height,
            y: layer3Y + height / 2
          })
          layer3Y += height + nodeSpacing
        }
      }

      // 「その他の事業」ノードを配置
      const otherProjects = projectsByMinistry.get(ministryId)
      if (otherProjects && otherProjects.length > 0) {
        const totalAmount = otherProjects.reduce((sum, n) => sum + n.amount, 0)
        const firstProject = otherProjects[0]
        const otherHeight = calculateHeight(totalAmount)

        const otherNode: LayoutNode = {
          id: `other_${ministryId}_layer3_dynamic`,
          type: 'project',
          layer: 3,
          name: `その他の事業 (${otherProjects.length}件)`,
          amount: totalAmount,
          ministryId,
          x: firstProject.x,
          y: layer3Y + otherHeight / 2,
          width: firstProject.width,
          height: otherHeight,
          metadata: {
            isOther: true,
            aggregatedCount: otherProjects.length,
            aggregatedIds: otherProjects.map(n => n.id)
          }
        }
        newNodes.push(otherNode)
        otherProjectMap.set(ministryId, otherNode)
        layer3Y += otherHeight + nodeSpacing
      }

      layerEndY.set(3, layer3Y)
      layerCurrentY.set(3, layer3Y)

      // この府省庁の終端位置を記録
      const maxEndY = Math.max(...Array.from(layerEndY.values()))
      ministryEndY.set(ministryId, maxEndY)

      // 次の府省庁のために全レイヤーの開始位置を更新
      const nextStartY = maxEndY + ministrySectionPadding
      for (let layer = 0; layer <= 3; layer++) {
        layerCurrentY.set(layer, Math.max(layerCurrentY.get(layer)!, nextStartY))
      }
    }

    // Layer 4 (支出先) の配置（レイヤーの最初は0から開始）
    const keptRecipientNodes = originalData.nodes
      .filter(n => n.layer === 4 && keptRecipientIds.has(n.id))
      .sort((a, b) => b.amount - a.amount)

    let recipientY = 0
    for (const node of keptRecipientNodes) {
      const height = calculateHeight(node.amount)
      newNodes.push({
        ...node,
        height,
        y: recipientY + height / 2
      })
      recipientY += height + nodeSpacing
    }

    // 支出先のOtherノード
    if (aggregatedRecipients.length > 0) {
      const totalAmount = aggregatedRecipients.reduce((sum, n) => sum + n.amount, 0)
      const firstRecipient = aggregatedRecipients[0]
      const otherHeight = Math.max(MIN_HEIGHT, Math.log10(totalAmount + 1) * 2)

      // 集約された支出先の全sourceministriesを収集
      const allSourceMinistries = new Set<string>()
      for (const node of aggregatedRecipients) {
        if (node.metadata?.sourceMinistries) {
          for (const ministry of node.metadata.sourceMinistries) {
            allSourceMinistries.add(ministry)
          }
        }
      }

      otherRecipientNode = {
        id: `other_recipients_layer4_dynamic`,
        type: 'recipient',
        layer: 4,
        name: `その他の支出先 (${aggregatedRecipients.length}件)`,
        amount: totalAmount,
        x: firstRecipient.x,
        y: recipientY + otherHeight / 2,
        width: firstRecipient.width,
        height: otherHeight,
        metadata: {
          isOther: true,
          aggregatedCount: aggregatedRecipients.length,
          aggregatedIds: aggregatedRecipients.map(n => n.id),
          sourceMinistries: Array.from(allSourceMinistries).sort()
        }
      }
      newNodes.push(otherRecipientNode)
    }

    // エッジを再構築
    const newEdges: LayoutEdge[] = []
    const edgeMap = new Map<string, LayoutEdge>()

    for (const edge of originalData.edges) {
      let newSourceId = edge.sourceId
      let newTargetId = edge.targetId

      if (aggregatedProjectIds.has(edge.sourceId)) {
        const sourceNode = originalData.nodes.find(n => n.id === edge.sourceId)
        if (sourceNode?.ministryId) {
          const otherNode = otherProjectMap.get(sourceNode.ministryId)
          if (otherNode) newSourceId = otherNode.id
        }
      }

      if (aggregatedProjectIds.has(edge.targetId)) {
        const targetNode = originalData.nodes.find(n => n.id === edge.targetId)
        if (targetNode?.ministryId) {
          const otherNode = otherProjectMap.get(targetNode.ministryId)
          if (otherNode) newTargetId = otherNode.id
        }
      }

      if (aggregatedRecipientIds.has(edge.targetId)) {
        if (otherRecipientNode) {
          newTargetId = otherRecipientNode.id
        }
      }

      const edgeKey = `${newSourceId}->${newTargetId}`
      const existing = edgeMap.get(edgeKey)

      if (existing) {
        existing.value += edge.value
        // Sankey principle: width is proportional to value
        // Use threshold-relative scaling (same as node height)
        existing.width = (existing.value / threshold) * MIN_HEIGHT
      } else {
        const sourceNode = newNodes.find(n => n.id === newSourceId)
        const targetNode = newNodes.find(n => n.id === newTargetId)

        if (sourceNode && targetNode) {
          // Sankey principle: edge width proportional to flow amount
          const edgeWidth = (edge.value / threshold) * MIN_HEIGHT

          const newEdge: LayoutEdge = {
            ...edge,
            id: `edge_${newSourceId}_${newTargetId}`,
            sourceId: newSourceId,
            targetId: newTargetId,
            width: edgeWidth,
            path: generateSankeyPath(
              sourceNode.x + sourceNode.width / 2,
              sourceNode.y,
              targetNode.x - targetNode.width / 2,
              targetNode.y
            )
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
  }, [originalData, options.topProjects, options.topRecipients, options.threshold])
}
