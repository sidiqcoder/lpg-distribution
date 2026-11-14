import assert from 'node:assert/strict';
import { calculatePerformance, scheduledStops } from '../functions/lpg-api/performance.js';
import { CHECKLIST_SECTIONS } from '../functions/lpg-api/checklist.js';
import { LOCATIONS, locationAt } from '../functions/lpg-api/locations.js';
import { PRESCRIBED_ROUTES } from '../functions/lpg-api/prescribed-routes.js';
import { registerOperations } from '../functions/lpg-api/operations.js';
import { createRouter } from '../functions/lpg-api/router.js';

const date = '2026-11-04';
const routes = [{ id: 0, urutan: 0 }, ...[1,2].map(id => ({ id, urutan: id, pangkalan_nama: `Lokasi ${id}`, latitude: -8, longitude: 115 + id }))];
const proof = { foto_sebelum: '1.jpg', foto_proses: '2.jpg', foto_sesudah: '3.jpg', penerima_nama: 'Penerima' };

Deno.test('20 document locations map correctly to both prescribed routes', () => {
  assert.equal(LOCATIONS.length,20);
  assert.equal(LOCATIONS[0].nama,'Bumdes Antap');
  assert.equal(LOCATIONS[19].nama,'Wayan Wirasa BS');
  const mapped = Object.values(PRESCRIBED_ROUTES).flat().map(p => locationAt(...p));
  assert.equal(new Set(mapped.map(p => p.no)).size,20);
  assert.ok(mapped.every(p => p.permintaan_tabung === 56));
});
Deno.test('deadlines skip origin, start 09 WITA, and roll over across midnight', () => {
  const schedule=scheduledStops(routes,date);
  assert.equal(schedule[0].deadline_at,'2026-11-04T01:00:00.000Z');
  assert.equal(schedule[1].deadline_at,'2026-11-04T02:00:00.000Z');
  assert.equal(scheduledStops(Array.from({length: 17},(_,i) => ({ id:i,urutan:i+1 })),date)[16].deadline_at,'2026-11-04T17:00:00.000Z');
});
Deno.test('late and missing deliveries reduce punctuality; duplicate proofs do not inflate completion', () => {
  const deliveries=[{ ...routes[1], ...proof, created_at:'2026-11-04T01:00:00Z' }, { ...routes[1], ...proof, created_at:'2026-11-04T01:10:00Z' }];
  const result=calculatePerformance({date,routes,deliveries,now:Date.parse('2026-11-04T03:00:00Z')});
  assert.equal(result.items[0].realization,50);
  assert.equal(result.items[1].realization,50);
  assert.equal(result.overdue.length,1);
  assert.equal(result.items[4].realization,100);
  assert.equal(result.items[2].realization,0);
  assert.equal(result.total,result.items.reduce((s,i)=>s+i.finalScore,0));
});
Deno.test('six KPI weights and formulas use GPS, checklist completion, and predeparture condition checks', () => {
  const deliveries=routes.slice(1).map(r => ({ ...r,...proof,created_at:'2026-11-04T00:50:00Z' }));
  const checklist=CHECKLIST_SECTIONS.flatMap(s=>s.items.map(item=>({section:s.id,item,status:'TIDAK'})));
  const inspection={created_at:'2026-11-04T00:00:00Z',checklist_json:JSON.stringify(checklist),physical_checked:true,fatigue_checked:true};
  const result=calculatePerformance({date,routes,deliveries,inspection,samples:[{on_route:true},{on_route:false}]});
  assert.deepEqual(result.items.map(i=>i.weight),[25,20,15,15,10,15]);
  assert.equal(result.items[0].score,105.26);
  assert.equal(result.items[2].realization,50);
  assert.equal(result.items[3].realization,100);
  assert.equal(result.items[5].realization,100);
  inspection.created_at='2026-11-04T02:00:00Z';
  const late=calculatePerformance({date,routes,deliveries,inspection});
  assert.equal(late.items[3].realization,0);
  assert.equal(late.items[5].realization,0);
});
Deno.test('manual demand rejects invalid quantities before mutation and writes valid changes atomically', async () => {
  const app=createRouter(); const writes=[];
  registerOperations(app,{queryAll:()=>[],database:{begin:fn=>fn({unsafe:async(sql,args)=>{writes.push({sql,args});return [];}})}});
  const handler=app.match('POST','/api/manager/demands').handler;
  const future='2099-01-01';
  for (const quantity of [-1,1.5,'56',NaN]) await assert.rejects(()=>handler({body:{date:future,entries:[{id:1,quantity}]}},{}),{status:400});
  assert.equal(writes.length,0);
  let result;
  await handler({user:{nama:'Manager'},body:{date:future,entries:[{location_no:1,quantity:72}]}},{json:value=>{result=value;}});
  assert.deepEqual(writes.find(w=>w.sql.startsWith('INSERT INTO location_demands')).args,[future,1,72,'Manager']);
  assert.deepEqual(writes.find(w=>w.sql.startsWith('UPDATE rute_harian')).args,[72,future,LOCATIONS[0].latitude,LOCATIONS[0].longitude]);
  assert.equal(result.ok,true);
});
