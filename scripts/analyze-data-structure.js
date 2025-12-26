import fs from 'fs';
import zlib from 'zlib';

// layout.json.gz を読み込み
const gzipData = fs.readFileSync('public/data/layout.json.gz');
const jsonData = zlib.gunzipSync(gzipData).toString('utf-8');
const data = JSON.parse(jsonData);

console.log('=== データ構造の基本情報 ===');
console.log(`総ノード数: ${data.nodes.length.toLocaleString()}件`);
console.log(`総エッジ数: ${data.edges.length.toLocaleString()}件`);

// サンプル支出先ノードを1つ取得
const sampleRecipient = data.nodes.find(n => n.type === 'recipient' && (!n.metadata || !n.metadata.isOther));

console.log('\n=== 支出先ノードのデータ構造（例）===');
console.log(JSON.stringify(sampleRecipient, null, 2));

// この支出先への入エッジを取得
const incomingEdges = data.edges.filter(e => e.targetId === sampleRecipient.id);

console.log(`\n=== この支出先「${sampleRecipient.name}」への入エッジ ===`);
console.log(`入エッジ数: ${incomingEdges.length}件`);
incomingEdges.slice(0, 3).forEach((edge, i) => {
  const sourceNode = data.nodes.find(n => n.id === edge.sourceId);
  console.log(`\nエッジ${i + 1}:`);
  console.log(`  sourceId: ${edge.sourceId}`);
  console.log(`  source名: ${sourceNode?.name || '不明'}`);
  console.log(`  sourceタイプ: ${sourceNode?.type}`);
  console.log(`  金額: ${edge.value.toLocaleString()}円`);
});

// エッジのデータ構造
console.log('\n=== エッジのデータ構造（例）===');
console.log(JSON.stringify(incomingEdges[0], null, 2));

// 複数事業から支出を受ける支出先を探す
console.log('\n=== 複数事業から支出を受ける支出先の統計 ===');
const recipientsWithMultipleProjects = data.nodes
  .filter(n => n.type === 'recipient' && (!n.metadata || !n.metadata.isOther))
  .map(recipient => {
    const projectEdges = data.edges.filter(e => {
      const source = data.nodes.find(n => n.id === e.sourceId);
      return e.targetId === recipient.id && source?.type === 'project';
    });
    return { recipient, projectCount: projectEdges.length, edges: projectEdges };
  })
  .filter(r => r.projectCount > 1)
  .sort((a, b) => b.projectCount - a.projectCount);

console.log(`複数事業から支出を受ける支出先: ${recipientsWithMultipleProjects.length.toLocaleString()}件`);

if (recipientsWithMultipleProjects.length > 0) {
  const top = recipientsWithMultipleProjects[0];
  console.log(`\n最大事業数の例:`);
  console.log(`  支出先名: ${top.recipient.name}`);
  console.log(`  事業数: ${top.projectCount}件`);
  console.log('  事業リスト（一部）:');
  top.edges.slice(0, 5).forEach(edge => {
    const project = data.nodes.find(n => n.id === edge.sourceId);
    console.log(`    - ${project?.name} (${edge.value.toLocaleString()}円)`);
  });
}

// 事業数の分布
console.log('\n=== 支出先あたりの事業数分布 ===');
const projectCountDistribution = new Map();
data.nodes
  .filter(n => n.type === 'recipient' && (!n.metadata || !n.metadata.isOther))
  .forEach(recipient => {
    const projectEdges = data.edges.filter(e => {
      const source = data.nodes.find(n => n.id === e.sourceId);
      return e.targetId === recipient.id && source?.type === 'project';
    });
    const count = projectEdges.length;
    projectCountDistribution.set(count, (projectCountDistribution.get(count) || 0) + 1);
  });

const sortedDist = Array.from(projectCountDistribution.entries()).sort((a, b) => a[0] - b[0]);
console.log('事業数 → 支出先数:');
sortedDist.forEach(([projectCount, recipientCount]) => {
  console.log(`  ${projectCount}事業: ${recipientCount.toLocaleString()}件の支出先`);
});
