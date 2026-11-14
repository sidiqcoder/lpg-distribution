import { LOCATIONS } from './locations.js';
import { ROUTE_ORIGIN } from './prescribed-routes.js';

// Kilometres, transcribed from image 1 in update perbaikan web 2.docx.
// These are document examples, never presented as live Google data.
export const DOCUMENT_MATRIX = [
  [0,16.3,14.4,35.4,14.3,2.1,16.5,6.5,24,9.9,26.1,.3,23.2,22.6,7.1,24.6,22.1,40.3,1.1,2.1,47.4],
  [16.3,0,7.4,20.8,28.7,14.8,19.5,19,8,12.6,13.2,16.1,11.5,33.2,17.5,8.6,24.1,24.3,16.3,15.2,33.5],
  [14.4,7.4,0,28.1,29.3,13.1,21,18.2,15.3,15.5,19.3,14.3,17.7,33.8,17.9,15.9,26.6,31.6,14.6,13.4,40.8],
  [35.4,20.8,28.1,0,45.4,33.5,33.4,38.3,12.9,32.5,13.6,35,13.5,45.4,38.2,12,33.8,10.3,35.1,33.9,15.2],
  [14.3,28.7,29.3,45.4,0,16.8,13.8,18.7,35.4,21.7,32.7,15.6,28.3,11.7,18.2,36,15.7,50.3,14.5,15.7,57.3],
  [2.1,14.8,13.1,33.5,16.8,0,16.1,5.3,22.7,8.8,24.8,2.9,21.9,24.6,5.2,23.3,21.7,39,2.5,3.5,46],
  [16.5,19.5,21,33.4,13.8,16.1,0,20.3,26.2,20.8,21.5,17.2,18.7,21.2,20.4,26.8,8.3,37.9,16.5,17.7,44.9],
  [6.5,19,18.2,38.3,18.7,5.3,20.3,0,26.9,5.2,29,7.2,26.1,26.5,2.4,27.5,25.8,43.8,6.8,7.9,50.8],
  [24,8,15.3,12.9,35.4,22.7,26.2,26.9,0,20.6,5.3,24,3.6,40,25.4,.6,30.8,16.4,24.2,23.1,23.1],
  [9.9,12.6,15.5,32.5,21.7,8.8,20.8,5.2,20.6,0,23.2,10.4,20.3,29.5,6.2,21.2,26.3,38,10.3,11.4,45],
  [26.1,13.2,19.3,13.6,32.7,24.8,21.5,29,5.3,23.2,0,26.1,2.2,37.3,27.5,5.9,26.1,17.1,26.3,25.2,23.8],
  [.3,16.1,14.3,35,15.6,2.9,17.2,7.2,24,10.4,26.1,0,23.2,23.4,7.1,24.6,22.8,40.5,1.1,2.1,47.5],
  [23.2,11.5,17.7,13.5,28.3,21.9,18.7,26.1,3.6,20.3,2.2,23.2,0,32.9,24.6,4.2,23.3,17,23.4,22.3,23.7],
  [22.6,33.2,33.8,45.4,11.7,24.6,21.2,26.5,40,29.5,37.3,23.4,32.9,0,26,40.6,23.1,50.3,22.3,23.5,57.3],
  [7.1,17.5,17.9,38.2,18.2,5.2,20.4,2.4,25.4,6.2,27.5,7.1,24.6,26,0,26,25.9,43.7,6.7,7.8,50.7],
  [24.6,8.6,15.9,12,36,23.3,26.8,27.5,.6,21.2,5.9,24.6,4.2,40.6,26,0,31.4,15.5,24.8,23.7,22.2],
  [22.1,24.1,26.6,33.8,15.7,21.7,8.3,25.8,30.8,26.3,26.1,22.8,23.3,23.1,25.9,31.4,0,38.3,22.1,23.2,45.3],
  [40.3,24.3,31.6,10.3,50.3,39,37.9,43.8,16.4,38,17.1,40.5,17,50.3,43.7,15.5,38.3,0,40.6,39.4,14.1],
  [1.1,16.3,14.6,35.1,14.5,2.5,16.5,6.8,24.2,10.3,26.3,1.1,23.4,22.3,6.7,24.8,22.1,40.6,0,1.1,47.6],
  [2.1,15.2,13.4,33.9,15.7,3.5,17.7,7.9,23.1,11.4,25.2,2.1,22.3,23.5,7.8,23.7,23.2,39.4,1.1,0,46.4],
  [47.4,33.5,40.8,15.2,57.3,46,44.9,50.8,23.1,45,23.8,47.5,23.7,57.3,50.7,22.2,45.3,14.1,47.6,46.4,0]
];

export function planRoutes(matrix) {
  const n = LOCATIONS.length + 1;
  if (matrix.length !== n || matrix.some((row, i) => row.length !== n || row.some((v,j) => !Number.isFinite(v) || v < 0 || (i === j && v !== 0)))) throw new Error('Matriks jarak 21 titik tidak lengkap.');
  const savings = [];
  for (let i=1;i<n;i++) for (let j=i+1;j<n;j++) {
    // Directed savings: depot -> j is replaced by i -> j, then i -> depot.
    savings.push({ from:i, to:j, km:matrix[i][0]+matrix[0][j]-matrix[i][j] });
    savings.push({ from:j, to:i, km:matrix[j][0]+matrix[0][i]-matrix[j][i] });
  }
  savings.sort((a,b) => b.km-a.km || a.from-b.from || a.to-b.to);
  let clusters = LOCATIONS.map(p => [p.no]);
  for (const edge of savings) {
    if (clusters.length === 2) break;
    const a=clusters.findIndex(c=>c.at(-1)===edge.from), b=clusters.findIndex(c=>c[0]===edge.to);
    if (a<0 || b<0 || a===b || clusters[a].length+clusters[b].length>10) continue;
    const merged=[...clusters[a],...clusters[b]];
    const candidate=[...clusters.filter((_,i)=>i!==a && i!==b),merged];
    const sizes=new Set([0]);
    for(const group of candidate) for(const size of [...sizes]) sizes.add(size+group.length);
    if(!sizes.has(10)) continue;
    clusters=candidate;
  }
  // Reconsider endpoints after merges, keeping a feasible 10/10 partition.
  while (clusters.length > 2) {
    let best=null;
    for (let a=0;a<clusters.length;a++) for(let b=0;b<clusters.length;b++) {
      if(a===b||clusters[a].length+clusters[b].length>10)continue;
      const candidate=[...clusters.filter((_,i)=>i!==a&&i!==b),[...clusters[a],...clusters[b]]];
      const sizes=new Set([0]);
      for(const group of candidate)for(const size of [...sizes])sizes.add(size+group.length);
      if(!sizes.has(10))continue;
      const i=clusters[a].at(-1),j=clusters[b][0];
      const saving=matrix[i][0]+matrix[0][j]-matrix[i][j];
      if (!best || saving>best.saving) best={candidate,saving};
    }
    if (!best) throw new Error('Pembagian dua rute tidak dapat dibentuk.');
    clusters=best.candidate;
  }
  clusters.sort((a,b)=>Math.max(...b.map(i=>matrix[0][i]))-Math.max(...a.map(i=>matrix[0][i])));
  const routes=clusters.map((cluster,index)=>{
    const pending=new Set(cluster), sequence=[]; let current=0, km=0;
    while(pending.size) {
      const next=[...pending].sort((a,b)=>matrix[current][a]-matrix[current][b] || a-b)[0];
      km+=matrix[current][next]; sequence.push(next); pending.delete(next); current=next;
    }
    km+=matrix[current][0];
    return {driver:index===0?'budi':'ahmad',cluster,sequence,km:Math.round(km*100)/100};
  });
  return {matrix,savings,routes,method:'Saving Matrix + Nearest Neighbor'};
}

export function documentPlan() {
  return {...planRoutes(DOCUMENT_MATRIX),source:'document-example',source_label:'Matriks contoh revisi 2; belum memakai jarak Google Maps',version:'saving-nn-v2-document'};
}

export async function googleMatrix(key, fetcher=fetch) {
  if (!key) throw Object.assign(new Error('API key Google Routes belum tersedia. Matriks contoh dokumen tetap digunakan.'),{status:409});
  const points=[{latitude:ROUTE_ORIGIN[0],longitude:ROUTE_ORIGIN[1]},...LOCATIONS];
  const waypoints=points.map(p=>({waypoint:{location:{latLng:{latitude:p.latitude,longitude:p.longitude}}}}));
  const response=await fetcher('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',{
    method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'originIndex,destinationIndex,distanceMeters,status,condition'},
    body:JSON.stringify({origins:waypoints,destinations:waypoints,travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE'}),signal:AbortSignal.timeout(45000)
  });
  if(!response.ok) throw Object.assign(new Error('Google Routes gagal mengambil matriks. Periksa aktivasi API, billing, dan pembatasan key.'),{status:502});
  const matrix=points.map(()=>points.map(()=>null));
  for(const row of await response.json()) {
    const i=row.originIndex??0,j=row.destinationIndex??0;
    if(!matrix[i] || j<0 || j>=points.length || row.status?.code || row.condition!=='ROUTE_EXISTS' || !Number.isFinite(row.distanceMeters)) continue;
    matrix[i][j]=row.distanceMeters/1000;
  }
  for(let i=0;i<points.length;i++) matrix[i][i]=0;
  planRoutes(matrix); // Reject incomplete/failed elements; never fabricate distances.
  return matrix;
}

export const SAMPLE_LEAD_TIMES=[2,3,2,3,3,2];
export function inventoryMetrics(days, stock) {
  const complete=days.filter(d=>Number(d.locations)===20).slice(0,6);
  const averageDemand=complete.length?complete.reduce((sum,d)=>sum+Number(d.total),0)/complete.length:null;
  const leadMean=SAMPLE_LEAD_TIMES.reduce((s,v)=>s+v,0)/6;
  const leadStd=Math.sqrt(SAMPLE_LEAD_TIMES.reduce((s,v)=>s+(v-leadMean)**2,0)/6);
  const safetyStock=averageDemand==null?null:Math.ceil(1.645*averageDemand*leadStd);
  const reorderPoint=averageDemand==null?null:Math.ceil(averageDemand*leadMean+safetyStock);
  return {days:complete,dayCount:complete.length,averageDemand,leadTimes:SAMPLE_LEAD_TIMES,leadMean,leadStd,z:1.645,safetyStock,reorderPoint,stock:Number(stock),reorder:reorderPoint!=null && Number(stock)<=reorderPoint,provisional:complete.length<6};
}
