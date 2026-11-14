import assert from 'node:assert/strict';
import { documentPlan,planRoutes,googleMatrix,inventoryMetrics } from '../functions/lpg-api/logistics.js';
import { ensureOptimizedRoutes } from '../functions/lpg-api/daily-routes.js';
import { createRouter,upload } from '../functions/lpg-api/router.js';
import { registerMonitoring } from '../functions/lpg-api/monitoring.js';

Deno.test('document example reproduces both nearest-neighbor routes and depot return distances',()=>{
  const plan=documentPlan();
  assert.equal(plan.source,'document-example');
  assert.deepEqual(plan.routes[0].sequence,[9,1,2,8,15,12,10,3,17,20]);
  assert.deepEqual(plan.routes[1].sequence,[11,18,19,5,14,7,4,13,6,16]);
  assert.deepEqual(plan.routes.map(r=>r.km),[137.6,95.6]);
  assert.equal(new Set(plan.routes.flatMap(r=>r.sequence)).size,20);
});
Deno.test('saving clusters remain two groups of ten on directed matrices; nearest decisions use directed road distances',()=>{
  let seed=13;
  for(let sample=0;sample<30;sample++) {
    const matrix=Array.from({length:21},(_,i)=>Array.from({length:21},(_,j)=>{seed=(seed*16807)%2147483647;return i===j?0:seed%100+1;}));
    const plan=planRoutes(matrix);
    assert.deepEqual(plan.routes.map(r=>r.sequence.length),[10,10]);
    assert.equal(new Set(plan.routes.flatMap(r=>r.sequence)).size,20);
    for(const route of plan.routes) {
      let current=0;
      for(let i=0;i<10;i++) {
        const selected=route.sequence[i];
        assert.ok(route.sequence.slice(i).every(next=>matrix[current][selected]<=matrix[current][next]));
        current=selected;
      }
    }
  }
});
Deno.test('Google matrix never falls back silently, validates elements, and accepts unordered indexed results',async()=>{
  await assert.rejects(()=>googleMatrix(''),{status:409});
  await assert.rejects(()=>googleMatrix('test',async()=>({ok:true,json:()=>[]})),/Matriks/);
  let body;
  const matrix=await googleMatrix('test',async(_url,options)=>{
    body=JSON.parse(options.body);
    return {ok:true,json:()=>Array.from({length:441},(_,n)=>{
      const i=Math.floor(n/21),j=n%21;
      return {originIndex:i,destinationIndex:j,condition:'ROUTE_EXISTS',distanceMeters:i===j?0:1000*(i+j+1)};
    }).reverse()};
  });
  assert.equal(body.origins.length,21);assert.equal(body.routingPreference,'TRAFFIC_AWARE');
  assert.equal(matrix[2][3],6);assert.equal(matrix[0][1],2);
});
Deno.test('inventory uses only complete manual days, six most recent, population lead deviation, rounded safety stock and threshold equality',()=>{
  const days=Array.from({length:7},(_,i)=>({tanggal:`2026-11-${14-i}`,locations:20,total:1000}));
  days.unshift({locations:19,total:99999});
  const result=inventoryMetrics(days,3323);
  assert.equal(result.dayCount,6);assert.equal(result.averageDemand,1000);
  assert.equal(result.leadMean,2.5);assert.equal(result.leadStd,.5);
  assert.equal(result.safetyStock,823);assert.equal(result.reorderPoint,3323);assert.equal(result.reorder,true);
  assert.equal(inventoryMetrics([],100).reorderPoint,null);
  assert.equal(inventoryMetrics([],100).reorder,false);
  assert.equal(inventoryMetrics(days.slice(0,2),100).provisional,true);
  assert.equal(inventoryMetrics([{locations:20,total:0}],1).reorderPoint,0);
});
Deno.test('route rebuild preserves history, freezes dispatched days, and seeds all locations exactly once',async()=>{
  const writes=[];let started=false,complete=false;
  const tx={unsafe:async(sql,args)=>{
    if(sql.startsWith('SELECT id,plan'))return [];
    if(sql.startsWith('SELECT s.id'))return [{id:1,username:'budi',kendaraan_id:1},{id:2,username:'ahmad',kendaraan_id:2}];
    if(sql.startsWith('SELECT * FROM rute_harian'))return complete?Array.from({length:22},()=>({sumber:'saving-nn-v2-document'})):[];
    if(sql.startsWith('SELECT EXISTS'))return [{value:started}];
    if(sql.startsWith('SELECT location_no'))return [{location_no:9,quantity:73}];
    if(sql.startsWith('INSERT')||sql.startsWith('DELETE'))writes.push({sql,args});
    return [];
  }};
  const db={begin:fn=>fn(tx)};
  started=true;await ensureOptimizedRoutes(db,'2026-11-14');assert.equal(writes.length,0);
  started=false;await ensureOptimizedRoutes(db,'2026-11-14');
  assert.equal(writes.filter(w=>w.sql.startsWith('INSERT')).length,22);
  assert.equal(writes.find(w=>w.sql.startsWith('INSERT')&&w.args[4]===9).args[11],73);
  assert.equal(writes[0].args[0],'2026-11-14');
  writes.length=0;complete=true;await ensureOptimizedRoutes(db,'2026-11-14');assert.equal(writes.length,0);
});
Deno.test('fatigue deletion retains idempotent capture ID, clears media, and retries storage cleanup after failure',async()=>{
  const app=createRouter();const row={id:8,foto:'proof.jpg',capture_id:'same-capture'};let removed=0;
  const unsafe=async(sql,args)=>{
    if(sql.startsWith('SELECT *'))return [{...row}];
    if(sql.includes('foto=NULL')){row.foto=null;row.video=null;row.deleted_media=JSON.parse(args[1]);row.media_deleted_at=new Date();}
    if(sql.includes('deleted_media=NULL'))row.deleted_media=null;
    return [];
  };
  registerMonitoring(app,{database:{begin:fn=>fn({unsafe}),unsafe},upload,removeMedia:files=>{assert.deepEqual(files,['proof.jpg']);if(++removed===1)throw new Error('Storage down');}});
  const route=app.match('POST','/api/manager/fatigue/8/delete-media');
  const req={params:route.params,user:{nama:'Manager'}};let result,status;
  const res={status:s=>{status=s;return res;},json:v=>{result=v;}};
  await route.handler(req,res);assert.equal(status,503);assert.equal(row.foto,null);assert.equal(row.capture_id,'same-capture');
  await route.handler(req,res);assert.equal(result.ok,true);assert.equal(row.deleted_media,null);assert.equal(removed,2);
});
