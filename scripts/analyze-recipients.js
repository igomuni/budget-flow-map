import fs from 'fs';
import zlib from 'zlib';

// layout.json.gz を読み込み
const gzipData = fs.readFileSync('public/data/layout.json.gz');
const jsonData = zlib.gunzipSync(gzipData).toString('utf-8');
const data = JSON.parse(jsonData);

// 府省庁ごとの支出先数をカウント
const ministryRecipients = new Map();

data.nodes
  .filter(n => n.type === 'recipient' && (!n.metadata || !n.metadata.isOther))
  .forEach(recipient => {
    const ministryId = recipient.ministryId;
    if (!ministryRecipients.has(ministryId)) {
      ministryRecipients.set(ministryId, []);
    }
    ministryRecipients.get(ministryId).push(recipient.id);
  });

// 府省庁ごとの件数を表示
const sorted = Array.from(ministryRecipients.entries())
  .map(([ministry, recipients]) => ({ ministry, count: recipients.length }))
  .sort((a, b) => b.count - a.count);

console.log('府省庁別支出先数（Top 10）:');
sorted.slice(0, 10).forEach(({ ministry, count }) => {
  console.log(`  ${ministry}: ${count.toLocaleString()}件`);
});

const totalRecipients = data.nodes.filter(n => n.type === 'recipient' && (!n.metadata || !n.metadata.isOther)).length;
console.log(`\n合計支出先数: ${totalRecipients.toLocaleString()}件`);

// 統計情報
console.log(`\n=== 支出先統計 ===`);
console.log(`  府省庁数: ${sorted.length}件`);
console.log(`  平均支出先数: ${Math.round(totalRecipients / sorted.length).toLocaleString()}件/府省庁`);
console.log(`  最大: ${sorted[0].count.toLocaleString()}件 (${sorted[0].ministry})`);
console.log(`  最小: ${sorted[sorted.length - 1].count.toLocaleString()}件 (${sorted[sorted.length - 1].ministry})`);

// 事業数も調査
console.log(`\n=== 事業数調査 ===`);
const ministryProjects = new Map();

data.nodes
  .filter(n => n.type === 'project' && (!n.metadata || !n.metadata.isOther))
  .forEach(project => {
    const ministryId = project.ministryId;
    if (!ministryProjects.has(ministryId)) {
      ministryProjects.set(ministryId, []);
    }
    ministryProjects.get(ministryId).push(project.id);
  });

const sortedProjects = Array.from(ministryProjects.entries())
  .map(([ministry, projects]) => ({ ministry, count: projects.length }))
  .sort((a, b) => b.count - a.count);

console.log('府省庁別事業数（Top 10）:');
sortedProjects.slice(0, 10).forEach(({ ministry, count }) => {
  console.log(`  ${ministry}: ${count.toLocaleString()}件`);
});

const totalProjects = data.nodes.filter(n => n.type === 'project' && (!n.metadata || !n.metadata.isOther)).length;
console.log(`\n合計事業数: ${totalProjects.toLocaleString()}件`);
console.log(`  最大: ${sortedProjects[0].count.toLocaleString()}件 (${sortedProjects[0].ministry})`);

// エッジ数の調査
console.log(`\n=== エッジ統計 ===`);
console.log(`  総エッジ数: ${data.edges.length.toLocaleString()}件`);

// 支出先への入エッジ数（最大・平均）
const recipientInEdges = new Map();
data.edges.forEach(edge => {
  const target = data.nodes.find(n => n.id === edge.targetId);
  if (target && target.type === 'recipient' && (!target.metadata || !target.metadata.isOther)) {
    recipientInEdges.set(edge.targetId, (recipientInEdges.get(edge.targetId) || 0) + 1);
  }
});

const maxInEdges = Math.max(...Array.from(recipientInEdges.values()));
const avgInEdges = Array.from(recipientInEdges.values()).reduce((sum, count) => sum + count, 0) / recipientInEdges.size;

console.log(`  支出先への入エッジ:`);
console.log(`    最大: ${maxInEdges.toLocaleString()}本/支出先`);
console.log(`    平均: ${avgInEdges.toFixed(1)}本/支出先`);

// パフォーマンス試算
console.log(`\n=== パフォーマンス試算 ===`);
console.log(`最悪ケース（経済産業省選択時）:`);
console.log(`  支出先数: ${sorted[0].count.toLocaleString()}件`);
console.log(`  総エッジ数: ${data.edges.length.toLocaleString()}件`);
console.log(`  想定イテレーション: ${sorted[0].count.toLocaleString()} × ${data.edges.length.toLocaleString()} = ${(sorted[0].count * data.edges.length).toLocaleString()}回`);
console.log(`\n  → エッジのMap化により O(支出先数) = ${sorted[0].count.toLocaleString()}回 に削減可能`);

// 複数府省庁にまたがる支出先の調査
console.log(`\n=== 複数府省庁調査 ===`);
const recipientMinistries = new Map();

data.nodes
  .filter(n => n.type === 'recipient' && (!n.metadata || !n.metadata.isOther))
  .forEach(recipient => {
    if (recipient.metadata && recipient.metadata.sourceMinistries) {
      recipientMinistries.set(recipient.id, recipient.metadata.sourceMinistries);
    }
  });

const multiMinistryRecipients = Array.from(recipientMinistries.entries())
  .filter(([_, ministries]) => ministries.length > 1);

console.log(`複数府省庁から支出を受ける支出先: ${multiMinistryRecipients.length.toLocaleString()}件 / ${totalRecipients.toLocaleString()}件`);
console.log(`  割合: ${((multiMinistryRecipients.length / totalRecipients) * 100).toFixed(1)}%`);

if (multiMinistryRecipients.length > 0) {
  const maxMinistries = Math.max(...multiMinistryRecipients.map(([_, m]) => m.length));
  const recipientWithMax = multiMinistryRecipients.find(([_, m]) => m.length === maxMinistries);
  const nodeWithMax = data.nodes.find(n => n.id === recipientWithMax[0]);
  console.log(`  最大府省庁数: ${maxMinistries}府省庁 (${nodeWithMax?.name || '不明'})`);
}

// ministryIdがnullの支出先チェック
console.log(`\n=== データ整合性チェック ===`);
const recipientsWithoutMinistry = data.nodes.filter(n =>
  n.type === 'recipient' &&
  (!n.metadata || !n.metadata.isOther) &&
  !n.ministryId
);

console.log(`ministryIdがnullの支出先: ${recipientsWithoutMinistry.length}件`);
if (recipientsWithoutMinistry.length > 0) {
  console.log(`  警告: データ整合性に問題がある可能性があります`);
  recipientsWithoutMinistry.slice(0, 3).forEach(n => {
    console.log(`    - ${n.name} (ID: ${n.id})`);
  });
}

// ministryId vs sourceMinistries の関係調査
console.log(`\n=== ministryId vs sourceMinistries の関係 ===`);
const allRecipients = data.nodes.filter(n =>
  n.type === 'recipient' && (!n.metadata || !n.metadata.isOther)
);

let ministryIdMatchesFirst = 0;
let ministryIdInSourceMinistries = 0;
let ministryIdNotInSourceMinistries = 0;

allRecipients.forEach(r => {
  if (r.metadata && r.metadata.sourceMinistries) {
    if (r.metadata.sourceMinistries[0] === r.ministryId) {
      ministryIdMatchesFirst++;
    } else if (r.metadata.sourceMinistries.includes(r.ministryId)) {
      ministryIdInSourceMinistries++;
    } else {
      ministryIdNotInSourceMinistries++;
    }
  }
});

console.log(`ministryIdがsourceMinistries[0]と一致: ${ministryIdMatchesFirst.toLocaleString()}件`);
console.log(`ministryIdがsourceMinistries内にある(但し先頭以外): ${ministryIdInSourceMinistries.toLocaleString()}件`);
console.log(`ministryIdがsourceMinistries内にない: ${ministryIdNotInSourceMinistries.toLocaleString()}件`);

// サンプル表示
const sampleMulti = data.nodes.find(n =>
  n.type === 'recipient' &&
  n.metadata?.sourceMinistries?.length > 1
);

if (sampleMulti) {
  console.log(`\n=== 複数府省庁支出先のサンプル ===`);
  console.log(`名前: ${sampleMulti.name}`);
  console.log(`ministryId: ${sampleMulti.ministryId}`);
  console.log(`sourceMinistries: ${sampleMulti.metadata.sourceMinistries.join(', ')}`);
  console.log(`\n解釈: ministryIdは代表府省庁(通常は先頭), sourceM inistriesが実際の全府省庁リスト`);
}
