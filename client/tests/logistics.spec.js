import {test,expect} from '@playwright/test';
import {documentPlan,inventoryMetrics} from '../../supabase/functions/lpg-api/logistics.js';
import {LOCATIONS} from '../../supabase/functions/lpg-api/locations.js';

const plan=documentPlan();
function assignedStops(state,driver) {
  return plan.routes.find(r=>r.driver===driver).sequence.map((no,index)=>{
    const p=LOCATIONS.find(p=>p.no===no);
    return {id:no,location_no:no,sopir_id:driver==='budi'?1:2,sopir_nama:driver==='budi'?'Budi':'Ahmad',
      pangkalan_nama:p.nama,latitude:p.latitude,longitude:p.longitude,urutan:index+1,
      permintaan_tabung:state.quantities[no]??0,entered:state.quantities[no]!=null,estimasi_waktu_tiba:`${String(index+9).padStart(2,'0')}:00`};
  });
}
async function session(context,role,state) {
  const user={role,id:role==='driver'?1:null,nama:role==='driver'?'Budi':'Manager'};
  await context.addInitScript(user=>{localStorage.setItem('lpg:session','logistics-test');localStorage.setItem('lpg:user',JSON.stringify(user));},user);
  await context.route('**/functions/v1/lpg-api/api/**',async route=>{
    const path=new URL(route.request().url()).pathname.split('/api')[1],method=route.request().method();
    let data={ok:true};
    if(path==='/session')data={user};
    else if(path==='/health')data={ok:true};
    else if(path==='/tracking')data=role==='driver'?[]:[{sopir_id:1,nama:'Budi',route:assignedStops(state,'budi')},{sopir_id:2,nama:'Ahmad',route:assignedStops(state,'ahmad')}];
    else if(path==='/manager/summary')data={stats:{},inspeksi:[],pengiriman:[],laporanBahaya:[],kpiData:[],permintaanLpg:[],currentPositions:[],semuaSopir:[],persediaanLpg:520};
    else if(path==='/manager/demands'&&method==='POST'){
      const body=route.request().postDataJSON();state.saved=body;
      for(const entry of body.entries)state.quantities[entry.location_no]=entry.quantity;
    }
    else if(path==='/manager/demands')data={routes:LOCATIONS.map(p=>[...assignedStops(state,'budi'),...assignedStops(state,'ahmad')].find(r=>r.location_no===p.no))};
    else if(path==='/manager/route-planning')data={...plan,locations:LOCATIONS,googleConfigured:false};
    else if(path==='/manager/inventory-planning')data=inventoryMetrics(Array.from({length:6},(_,i)=>({tanggal:`2026-11-${14-i}`,locations:20,total:1000})),520);
    else if(path==='/manager/activity')data={reports:[state.report],logins:[],monitoring:[]};
    else if(path==='/manager/fatigue/1/delete-media'){
      state.deletes++;state.report={...state.report,foto:null,media_deleted_at:new Date().toISOString(),media_deleted_by:'Manager'};
    }
    else if(path==='/driver/1/routes')data={rute:assignedStops(state,'budi'),origin:{latitude:-8.511797322884732,longitude:115.10983104232992},delivered:[],route_source:plan.source_label};
    else if(path==='/driver/1/announcements')data={overdue:[]};
    else if(path==='/driver/1/summary')data={sopir:user,siapBerangkat:true,maxTabung:543,stok:520};
    else if(path==='/driver/1/fatigue')data={latest:null,monitoring:null};
    await route.fulfill({json:data});
  });
}
const initial=()=>({quantities:{},deletes:0,report:{id:1,nama:'Budi',kind:'foto',status:'FIT',foto:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1EAAAAASUVORK5CYII=',created_at:new Date().toISOString(),captured_at:new Date().toISOString()}});

test('20 manual daily inputs persist and appear on the assigned driver map, with zero supported',async({page,context,browser})=>{
  const state=initial();await session(context,'manager',state);
  await page.goto('/manager/permintaan');
  await expect(page.getByRole('link',{name:'Permintaan per Lokasi'})).toBeVisible();
  await expect(page.getByRole('spinbutton')).toHaveCount(20);
  const first=page.getByRole('spinbutton',{name:'Permintaan Bumdes Antap untuk Budi'});
  await first.fill('73');
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(first).toHaveValue('73');
  await page.getByRole('button',{name:'Simpan Permintaan Lokasi'}).click();
  await expect(page.getByRole('status')).toContainText('Permintaan disimpan');
  expect(state.saved.entries).toHaveLength(20);expect(state.quantities[1]).toBe(73);expect(state.quantities[2]).toBe(0);
  await page.reload();await expect(first).toHaveValue('73');
  await expect(page.getByRole('button',{name:'Hitung Ulang dengan Google Maps'})).toBeDisabled();
  await expect(page.getByText(/137.6 km/)).toBeVisible();await expect(page.getByText(/95.6 km/)).toBeVisible();
  const driver=await browser.newContext({viewport:{width:390,height:844}});
  await session(driver,'driver',state);const driverPage=await driver.newPage();
  await driverPage.goto('/sopir/rute-map');
  await expect(driverPage.getByText('Bumdes Antap · Permintaan: 73 Tabung',{exact:false})).toBeVisible();
  await driverPage.locator('.leaflet-marker-icon').nth(2).click();
  await expect(driverPage.locator('.leaflet-popup-content')).toContainText('Permintaan: 73 Tabung');
  await driverPage.screenshot({path:'../.local/revision2-driver-mobile.png',fullPage:true});
  await driver.close();
  await page.screenshot({path:'../.local/revision2-manager-demands.png',fullPage:true});
});

test('stock shows document formulas, six complete demand days, sample lead time, and reorder warning',async({page,context})=>{
  await session(context,'manager',initial());await page.goto('/manager/stok');
  await expect(page.getByRole('heading',{name:'Safety Stock & Reorder Point'})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Segera order LPG lagi');
  await expect(page.getByText('823 tabung',{exact:true})).toBeVisible();
  await expect(page.getByText('3.323 tabung',{exact:true})).toBeVisible();
  await expect(page.getByText(/Sampel ini merupakan asumsi/)).toBeVisible();
});

test('manager deletion supports cancel and removes photo while retaining report history',async({page,context})=>{
  const state=initial();await session(context,'manager',state);await page.goto('/manager/aktivitas');
  await expect(page.locator('.fatigue-preview')).toBeVisible();
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Hapus Rekaman'}).click();expect(state.deletes).toBe(0);
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Hapus Rekaman'}).click();
  await expect(page.getByText(/Foto\/video dihapus oleh Manager/)).toBeVisible();
  await expect(page.locator('.fatigue-preview')).toHaveCount(0);expect(state.deletes).toBe(1);
});

test('manager map shows both sets of destinations even before drivers provide GPS',async({page,context})=>{
  await session(context,'manager',initial());await page.goto('/manager/pelacakan');
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(20);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(2);
});
