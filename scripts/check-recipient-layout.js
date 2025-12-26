import fs from 'fs';
import zlib from 'zlib';

const gzipData = fs.readFileSync('public/data/layout.json.gz');
const data = JSON.parse(zlib.gunzipSync(gzipData).toString('utf-8'));

// 支出先ノードのX座標を確認
const recipients = data.nodes.filter(n => n.type === 'recipient' && (!n.metadata || !n.metadata.isOther)).slice(0, 20);

console.log('=== 支出先ノードのレイアウト確認 ===');
const uniqueX = new Set(recipients.map(r => r.x));
console.log(`X座標の種類数: ${uniqueX.size}`);
console.log(`X座標の値: ${Array.from(uniqueX).join(', ')}`);

console.log('\n支出先ノードのサンプル:');
recipients.forEach(r => {
  console.log(`  ${r.name.slice(0, 40).padEnd(40)} x=${r.x}, ministryId=${r.ministryId}`);
});

// Layer 4のLAYER_X_POSITIONを確認
console.log('\n=== 他レイヤーとの比較 ===');
const layer0 = data.nodes.find(n => n.layer === 0);
const layer1 = data.nodes.find(n => n.layer === 1);
const layer2 = data.nodes.find(n => n.layer === 2);
const layer3 = data.nodes.find(n => n.layer === 3);
const layer4 = data.nodes.find(n => n.layer === 4 && (!n.metadata || !n.metadata.isOther));

console.log(`Layer 0 (府省): x=${layer0?.x}`);
console.log(`Layer 1 (局):   x=${layer1?.x}`);
console.log(`Layer 2 (課):   x=${layer2?.x}`);
console.log(`Layer 3 (事業): x=${layer3?.x}`);
console.log(`Layer 4 (支出): x=${layer4?.x}`);
