/**
 * Behavioural tests for the LINE webhook worker.
 * Run with: node server/test.mjs
 */
import crypto from 'node:crypto';
import worker from './worker.js';

const SECRET='test-secret', GROUP='Gtest';
const kv=new Map();
const env={
  LINE_CHANNEL_SECRET:SECRET, LINE_ACCESS_TOKEN:'tok', LINE_GROUP_ID:GROUP,
  ALLOWED_ORIGIN:'https://example.test',
  PROJECTS:{ async get(k,t){const v=kv.get(k); return v?(t==='json'?JSON.parse(v):v):null;},
             async put(k,v){kv.set(k,v);} }
};
const replies=[];
globalThis.fetch=async(u,o)=>{ replies.push(JSON.parse(o.body).messages[0].text); return {ok:true}; };

const post=async(events)=>{
  const body=JSON.stringify({events});
  const sig=crypto.createHmac('sha256',SECRET).update(body).digest('base64');
  return worker.fetch(new Request('https://w/',{method:'POST',body,headers:{'x-line-signature':sig}}),env);
};
const feed=async()=>(await (await worker.fetch(new Request('https://w/projects.json'),env)).json()).entries;

let pass=0, fail=0;
const check=(name,cond)=>{ cond?pass++:fail++; console.log((cond?'  ok  ':'  FAIL')+'  '+name); };

// 1. bad signature rejected
const bad=await worker.fetch(new Request('https://w/',{method:'POST',body:'{}',headers:{'x-line-signature':'nope'}}),env);
check('bad signature → 401', bad.status===401);

// 2. untagged chatter is ignored
await post([{type:'message',timestamp:Date.now(),source:{type:'group',groupId:GROUP},
  message:{id:'m0',type:'text',text:'今日の飲み会、16:30から予約しました〜'},replyToken:'r0'}]);
check('untagged message not stored', (await feed()).length===0);

// 3. a tagged recruit is parsed
await post([{type:'message',timestamp:Date.parse('2026-09-01T03:00:00Z'),source:{type:'group',groupId:GROUP},
  message:{id:'m1',type:'text',text:'#募集\n曲: サボテンの花 / チューリップ\nパート: Lead, Cho ×2, Bass\n締切: 2026-09-05\n場所: 大宮周辺 スタジオ\n9月の土曜で1日企画やりませんか？'},replyToken:'r1'}]);
let e=(await feed())[0];
check('tagged message stored', e && e.song==='サボテンの花');
check('artist split from 曲', e && e.artist==='チューリップ');
check('parts parsed', e && e.parts==='Lead, Cho ×2, Bass');
check('loose line → body', e && e.body.includes('9月の土曜'));
check('kind/status preset', e && e.kind==='企画募集' && e.status==='募集中');
check('no sender recorded', e && !JSON.stringify(e).includes('userId'));
check('bot replied with delete id', replies.some(r=>r.includes('#削除 m1')));

// 4. another group is ignored
await post([{type:'message',timestamp:Date.now(),source:{type:'group',groupId:'Gother'},
  message:{id:'m2',type:'text',text:'#募集\n曲: よそのグループ'},replyToken:'r2'}]);
check('other group ignored', (await feed()).length===1);

// 5. unsend withdraws the entry
await post([{type:'unsend',timestamp:Date.now(),source:{type:'group',groupId:GROUP},unsend:{messageId:'m1'}}]);
check('unsend removes entry', (await feed()).length===0);

// 6. #削除 works
await post([{type:'message',timestamp:Date.now(),source:{type:'group',groupId:GROUP},
  message:{id:'m3',type:'text',text:'#お知らせ\n9月のOMIYAcappella’s Day'},replyToken:'r3'}]);
check('お知らせ stored', (await feed()).length===1);
await post([{type:'message',timestamp:Date.now(),source:{type:'group',groupId:GROUP},
  message:{id:'m4',type:'text',text:'#削除 m3'},replyToken:'r4'}]);
check('#削除 removes entry', (await feed()).length===0);

// 7. join triggers the intro
replies.length=0;
await post([{type:'join',timestamp:Date.now(),source:{type:'group',groupId:'GbrandNew'},replyToken:'r5'}]);
check('join → intro reply', replies[0] && replies[0].includes('サイト連携Bot'));
check('intro states what it ignores', replies[0] && replies[0].includes('読み捨てます'));

// 8. CORS on the feed
const r=await worker.fetch(new Request('https://w/projects.json'),env);
check('CORS origin set', r.headers.get('Access-Control-Allow-Origin')==='https://example.test');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
