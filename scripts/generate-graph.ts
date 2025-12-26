#!/usr/bin/env npx tsx
/**
 * CSV → Graph JSON 変換スクリプト
 *
 * 入力: data/year_2024/*.csv (正規化済み RS システム CSV)
 * 出力: data/intermediate/graph-raw.json (座標なしのノード・エッジ)
 *
 * 5層構造:
 *   Layer 0: 府省庁 (ministry)
 *   Layer 1: 局・庁 (bureau)
 *   Layer 2: 課 (division)
 *   Layer 3: 事業 (project)
 *   Layer 4: 支出先 (recipient)
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'csv-parse/sync'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================================
// 型定義
// ============================================================================

type NodeType = 'ministry' | 'bureau' | 'division' | 'project' | 'recipient'

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

// CSV行の型
interface OrganizationRow {
  シート種別: string
  事業年度: string
  予算事業ID: string
  事業名: string
  建制順: string
  所管府省庁: string
  府省庁: string
  '局・庁': string
  部: string
  課: string
  室: string
  [key: string]: string
}

interface BudgetSummaryRow {
  シート種別: string
  事業年度: string
  予算事業ID: string
  事業名: string
  府省庁の建制順: string
  政策所管府省庁: string
  府省庁: string
  '局・庁': string
  部: string
  課: string
  室: string
  予算年度: string
  '当初予算(合計)': string
  '補正予算(合計)': string
  '計(歳出予算現額合計)': string
  '執行額(合計)': string
  執行率: string
  [key: string]: string
}

interface RecipientRow {
  シート種別: string
  事業年度: string
  予算事業ID: string
  事業名: string
  府省庁の建制順: string
  政策所管府省庁: string
  府省庁: string
  '局・庁': string
  部: string
  課: string
  室: string
  支出先ブロック番号: string
  支出先ブロック名: string
  支出先の数: string
  ブロックの合計支出額: string
  支出先名: string
  法人番号: string
  所在地: string
  法人種別: string
  支出先の合計支出額: string
  金額: string
  [key: string]: string
}

// ============================================================================
// ユーティリティ
// ============================================================================

function readCsv<T>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as T[]
}

function createNodeId(type: NodeType, ...parts: string[]): string {
  const joined = parts.filter(Boolean).join('_')
  // シンプルなハッシュで短いIDを生成
  const hash = joined.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0
  }, 0)
  return `${type.charAt(0)}${Math.abs(hash).toString(36)}`
}

function parseAmount(value: string | undefined): number {
  if (!value) return 0
  const num = parseFloat(value.replace(/,/g, ''))
  return isNaN(num) ? 0 : num
}

// 法人種別コード → 種別名
const CORPORATE_TYPE_MAP: Record<string, string> = {
  '101': '国の機関',
  '201': '地方公共団体',
  '301': '株式会社',
  '302': '有限会社',
  '303': '合名会社',
  '304': '合資会社',
  '305': '合同会社',
  '399': 'その他の設立登記法人',
  '401': '外国会社等',
  '499': 'その他',
}

// ============================================================================
// メイン処理
// ============================================================================

async function main() {
  const dataDir = path.resolve(__dirname, '../../marumie-rssystem/data/year_2024')
  const outputDir = path.resolve(__dirname, '../data/intermediate')

  // 出力ディレクトリ作成
  fs.mkdirSync(outputDir, { recursive: true })

  console.log('📊 CSV → Graph JSON 変換を開始...')
  console.log(`   入力: ${dataDir}`)
  console.log(`   出力: ${outputDir}`)

  // ノード・エッジを格納するマップ
  const nodes = new Map<string, RawNode>()
  const edges = new Map<string, RawEdge>()

  // 事業→予算のマッピング
  const projectBudgets = new Map<string, number>()

  // =========================================================================
  // Step 1: 予算サマリから事業の予算額を取得
  // =========================================================================
  console.log('\n📁 2-1_RS_2024_予算・執行_サマリ.csv を読み込み中...')
  const budgetPath = path.join(dataDir, '2-1_RS_2024_予算・執行_サマリ.csv')
  const budgetRows = readCsv<BudgetSummaryRow>(budgetPath)

  for (const row of budgetRows) {
    if (row.予算年度 !== '2024') continue // 2024年度のみ
    if (!row['計(歳出予算現額合計)']) continue

    const projectKey = `${row.予算事業ID}`
    const amount = parseAmount(row['計(歳出予算現額合計)'])

    if (amount > 0) {
      // 同じ事業IDでも複数行ある場合は合計
      const existing = projectBudgets.get(projectKey) || 0
      projectBudgets.set(projectKey, existing + amount)
    }
  }
  console.log(`   → ${projectBudgets.size} 事業の予算データを取得`)

  // =========================================================================
  // Step 2: 組織情報からノードと階層エッジを構築
  // =========================================================================
  console.log('\n📁 1-1_RS_2024_基本情報_組織情報.csv を読み込み中...')
  const orgPath = path.join(dataDir, '1-1_RS_2024_基本情報_組織情報.csv')
  const orgRows = readCsv<OrganizationRow>(orgPath)

  // 重複排除用セット
  const processedProjects = new Set<string>()

  for (const row of orgRows) {
    if (row.シート種別 !== 'レビューシート') continue

    const ministry = row.府省庁
    const bureau = row['局・庁']
    const division = row.課 || row.部 || row.室 || '(課未記載)'
    const projectId = row.予算事業ID
    const projectName = row.事業名

    if (!ministry || !projectId) continue

    // 重複スキップ
    const projectKey = `${ministry}_${projectId}`
    if (processedProjects.has(projectKey)) continue
    processedProjects.add(projectKey)

    // ノードID生成
    const ministryNodeId = createNodeId('ministry', ministry)
    const bureauNodeId = bureau
      ? createNodeId('bureau', ministry, bureau)
      : ministryNodeId
    const divisionNodeId = division
      ? createNodeId('division', ministry, bureau, division)
      : bureauNodeId
    const projectNodeId = createNodeId('project', ministry, projectId)

    // 予算額取得
    const amount = projectBudgets.get(projectId) || 0

    // 府省庁ノード
    if (!nodes.has(ministryNodeId)) {
      nodes.set(ministryNodeId, {
        id: ministryNodeId,
        type: 'ministry',
        layer: 0,
        name: ministry,
        amount: 0,
        ministryId: ministry,
        metadata: { order: parseInt(row.建制順) || 999 },
      })
    }
    // 府省庁の金額を加算
    const ministryNode = nodes.get(ministryNodeId)!
    ministryNode.amount += amount

    // 局ノード
    if (bureau && bureauNodeId !== ministryNodeId && !nodes.has(bureauNodeId)) {
      nodes.set(bureauNodeId, {
        id: bureauNodeId,
        type: 'bureau',
        layer: 1,
        name: bureau,
        amount: 0,
        ministryId: ministry,
        metadata: {},
      })
    }
    if (nodes.has(bureauNodeId)) {
      const bureauNode = nodes.get(bureauNodeId)!
      bureauNode.amount += amount
    }

    // 課ノード
    if (division && divisionNodeId !== bureauNodeId && !nodes.has(divisionNodeId)) {
      nodes.set(divisionNodeId, {
        id: divisionNodeId,
        type: 'division',
        layer: 2,
        name: division,
        amount: 0,
        ministryId: ministry,
        metadata: {},
      })
    }
    if (nodes.has(divisionNodeId)) {
      const divisionNode = nodes.get(divisionNodeId)!
      divisionNode.amount += amount
    }

    // 事業ノード
    if (!nodes.has(projectNodeId)) {
      nodes.set(projectNodeId, {
        id: projectNodeId,
        type: 'project',
        layer: 3,
        name: projectName,
        amount: amount,
        ministryId: ministry,
        metadata: {
          projectId,
          hierarchyPath: [ministry, bureau, division].filter(Boolean),
        },
      })
    }

    // エッジ: 府省庁 → 局
    if (bureau && bureauNodeId !== ministryNodeId) {
      const edgeId = `${ministryNodeId}-${bureauNodeId}`
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          sourceId: ministryNodeId,
          targetId: bureauNodeId,
          value: 0,
        })
      }
      edges.get(edgeId)!.value += amount
    }

    // エッジ: 局 → 課
    if (division && divisionNodeId !== bureauNodeId) {
      const sourceId = bureauNodeId !== ministryNodeId ? bureauNodeId : ministryNodeId
      const edgeId = `${sourceId}-${divisionNodeId}`
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          sourceId,
          targetId: divisionNodeId,
          value: 0,
        })
      }
      edges.get(edgeId)!.value += amount
    }

    // エッジ: 課 → 事業
    {
      const sourceId = divisionNodeId
      const edgeId = `${sourceId}-${projectNodeId}`
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          sourceId,
          targetId: projectNodeId,
          value: 0,
        })
      }
      edges.get(edgeId)!.value += amount
    }
  }

  console.log(`   → ${nodes.size} ノード, ${edges.size} エッジを構築`)

  // =========================================================================
  // Step 3: 支出先情報からレイヤー4ノードとエッジを追加
  // =========================================================================
  console.log('\n📁 5-1_RS_2024_支出先_支出情報.csv を読み込み中...')
  const recipientPath = path.join(dataDir, '5-1_RS_2024_支出先_支出情報.csv')
  const recipientRows = readCsv<RecipientRow>(recipientPath)

  // 事業→支出先のマッピング
  const projectRecipients = new Map<string, Map<string, number>>()

  for (const row of recipientRows) {
    if (row.シート種別 !== 'レビューシート') continue

    const projectId = row.予算事業ID
    const ministry = row.府省庁
    const recipientName = row.支出先名
    const corporateNumber = row.法人番号

    // CSVには各支出先に対して2種類の行がある:
    // 1. サマリー行: 支出先の合計支出額のみ記載、契約概要は空
    // 2. 詳細行: 金額と契約概要が記載
    // 詳細行のみを使用して重複を避ける
    const amount = parseAmount(row.金額)

    if (!recipientName || !amount) continue

    const projectNodeId = createNodeId('project', ministry, projectId)

    // 支出先ノードID（名前ベースで統一 - ADR: 20251226_1133_adr-recipient-duplicate.md）
    const recipientNodeId = createNodeId('recipient', recipientName)

    // 支出先ノード作成
    if (!nodes.has(recipientNodeId)) {
      nodes.set(recipientNodeId, {
        id: recipientNodeId,
        type: 'recipient',
        layer: 4,
        name: recipientName,
        amount: 0,
        // ministryIdは省略（支出先は府省庁横断、sourceministriesを使用）
        metadata: {
          corporateNumber: corporateNumber || undefined,
          location: row.所在地 || undefined,
          corporateType: CORPORATE_TYPE_MAP[row.法人種別] || row.法人種別 || undefined,
          sourceMinistries: [ministry],
        },
      })
    } else {
      // 既存ノードがある場合、メタデータをマージ
      const existingNode = nodes.get(recipientNodeId)!
      const existingMeta = existingNode.metadata as {
        corporateNumber?: string
        location?: string
        corporateType?: string
        sourceMinistries?: string[]
      }

      // 法人番号がない場合は新しいデータでマージ
      if (!existingMeta.corporateNumber && corporateNumber) {
        existingMeta.corporateNumber = corporateNumber
      }
      if (!existingMeta.location && row.所在地) {
        existingMeta.location = row.所在地
      }
      if (!existingMeta.corporateType && row.法人種別) {
        existingMeta.corporateType = CORPORATE_TYPE_MAP[row.法人種別] || row.法人種別
      }

      // 府省庁リストに追加（重複除去）
      if (!existingMeta.sourceMinistries) {
        existingMeta.sourceMinistries = []
      }
      if (!existingMeta.sourceMinistries.includes(ministry)) {
        existingMeta.sourceMinistries.push(ministry)
      }
    }
    const recipientNode = nodes.get(recipientNodeId)!
    recipientNode.amount += amount

    // エッジ: 事業 → 支出先
    const edgeId = `${projectNodeId}-${recipientNodeId}`
    if (!edges.has(edgeId)) {
      edges.set(edgeId, {
        id: edgeId,
        sourceId: projectNodeId,
        targetId: recipientNodeId,
        value: 0,
      })
    }
    edges.get(edgeId)!.value += amount

    // 事業→支出先のマッピングを記録（重複除去用）
    if (!projectRecipients.has(projectNodeId)) {
      projectRecipients.set(projectNodeId, new Map())
    }
    const recipientMap = projectRecipients.get(projectNodeId)!
    recipientMap.set(recipientNodeId, (recipientMap.get(recipientNodeId) || 0) + amount)
  }

  console.log(`   → 支出先追加後: ${nodes.size} ノード, ${edges.size} エッジ`)

  // =========================================================================
  // Step 4: 無効なエッジの削除（存在しないノードを参照するエッジ）
  // =========================================================================
  const validEdges: RawEdge[] = []
  for (const edge of edges.values()) {
    if (nodes.has(edge.sourceId) && nodes.has(edge.targetId) && edge.value > 0) {
      validEdges.push(edge)
    }
  }
  console.log(`   → 有効エッジ: ${validEdges.length}`)

  // =========================================================================
  // Step 5: 出力
  // =========================================================================
  const graph: RawGraph = {
    metadata: {
      generatedAt: new Date().toISOString(),
      fiscalYear: 2024,
      sourceFiles: [
        '1-1_RS_2024_基本情報_組織情報.csv',
        '2-1_RS_2024_予算・執行_サマリ.csv',
        '5-1_RS_2024_支出先_支出情報.csv',
      ],
    },
    nodes: Array.from(nodes.values()),
    edges: validEdges,
  }

  // ノード数・エッジ数のサマリ
  const nodesByType = new Map<NodeType, number>()
  for (const node of graph.nodes) {
    nodesByType.set(node.type, (nodesByType.get(node.type) || 0) + 1)
  }

  console.log('\n📈 グラフ統計:')
  console.log(`   府省庁 (layer 0): ${nodesByType.get('ministry') || 0}`)
  console.log(`   局 (layer 1): ${nodesByType.get('bureau') || 0}`)
  console.log(`   課 (layer 2): ${nodesByType.get('division') || 0}`)
  console.log(`   事業 (layer 3): ${nodesByType.get('project') || 0}`)
  console.log(`   支出先 (layer 4): ${nodesByType.get('recipient') || 0}`)
  console.log(`   ─────────────────`)
  console.log(`   合計ノード: ${graph.nodes.length}`)
  console.log(`   合計エッジ: ${graph.edges.length}`)

  // JSON出力
  const outputPath = path.join(outputDir, 'graph-raw.json')
  fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2))
  console.log(`\n✅ 出力完了: ${outputPath}`)

  // ファイルサイズ表示
  const stats = fs.statSync(outputPath)
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
  console.log(`   ファイルサイズ: ${sizeMB} MB`)
}

main().catch((err) => {
  console.error('❌ エラー:', err)
  process.exit(1)
})
