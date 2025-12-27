import type { LayoutNode, LayoutEdge } from '@/types/layout'

/**
 * Format amount in Japanese Yen with 億円 unit
 */
function formatAmountForCsv(amount: number): string {
  const oku = amount / 100000000
  return oku.toFixed(2)
}

/**
 * Get node type label in Japanese
 */
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    ministry: '府省',
    bureau: '局',
    division: '課',
    project: '事業',
    recipient: '支出先',
  }
  return labels[type] || type
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Export selected node and its related data as CSV
 */
export function exportNodeToCsv(
  node: LayoutNode,
  edges: LayoutEdge[],
  nodes: LayoutNode[]
): void {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // Build CSV content
  const lines: string[] = []

  // Header section
  lines.push('# 選択ノード情報')
  lines.push('名称,種別,金額(億円),法人番号,所在地')
  lines.push([
    escapeCsvField(node.name),
    getTypeLabel(node.type),
    formatAmountForCsv(node.amount),
    node.metadata.corporateNumber || '',
    escapeCsvField(node.metadata.location || ''),
  ].join(','))
  lines.push('')

  // Upstream nodes (sources)
  const incomingEdges = edges.filter(e => e.targetId === node.id)
  if (incomingEdges.length > 0) {
    lines.push('# 上流ノード（予算元）')
    lines.push('名称,種別,金額(億円),構成比(%)')

    const totalIncoming = incomingEdges.reduce((sum, e) => sum + e.value, 0)
    const sortedIncoming = [...incomingEdges].sort((a, b) => b.value - a.value)

    for (const edge of sortedIncoming) {
      const sourceNode = nodeMap.get(edge.sourceId)
      if (sourceNode) {
        const ratio = totalIncoming > 0 ? (edge.value / totalIncoming) * 100 : 0
        lines.push([
          escapeCsvField(sourceNode.name),
          getTypeLabel(sourceNode.type),
          formatAmountForCsv(edge.value),
          ratio.toFixed(1),
        ].join(','))
      }
    }
    lines.push('')
  }

  // Downstream nodes (targets)
  const outgoingEdges = edges.filter(e => e.sourceId === node.id)
  if (outgoingEdges.length > 0) {
    lines.push('# 下流ノード（支出先）')
    lines.push('名称,種別,金額(億円),構成比(%)')

    const totalOutgoing = outgoingEdges.reduce((sum, e) => sum + e.value, 0)
    const sortedOutgoing = [...outgoingEdges].sort((a, b) => b.value - a.value)

    for (const edge of sortedOutgoing) {
      const targetNode = nodeMap.get(edge.targetId)
      if (targetNode) {
        const ratio = totalOutgoing > 0 ? (edge.value / totalOutgoing) * 100 : 0
        lines.push([
          escapeCsvField(targetNode.name),
          getTypeLabel(targetNode.type),
          formatAmountForCsv(edge.value),
          ratio.toFixed(1),
        ].join(','))
      }
    }
  }

  // Create and download file
  const csvContent = lines.join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${node.name.replace(/[/\\?%*:|"<>]/g, '_')}_詳細.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export recipients list as CSV (for project nodes)
 */
export function exportRecipientsToCsv(
  node: LayoutNode,
  recipients: Array<{ node: LayoutNode; amount: number; ratio: number; rank?: number }>
): void {
  const lines: string[] = []

  lines.push(`# ${node.name} の支出先一覧`)
  lines.push('順位,名称,金額(億円),構成比(%),法人番号,所在地')

  for (let i = 0; i < recipients.length; i++) {
    const { node: recipient, amount, ratio, rank } = recipients[i]
    lines.push([
      (rank || i + 1).toString(),
      escapeCsvField(recipient.name),
      formatAmountForCsv(amount),
      ratio.toFixed(1),
      recipient.metadata.corporateNumber || '',
      escapeCsvField(recipient.metadata.location || ''),
    ].join(','))
  }

  const csvContent = lines.join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${node.name.replace(/[/\\?%*:|"<>]/g, '_')}_支出先.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
