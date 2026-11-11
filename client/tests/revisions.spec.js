import { test, expect } from '@playwright/test';

async function mockSession(context, role) {
  const user = { role, id: role === 'driver' ? 1 : null, nama: role === 'driver' ? 'Budi' : 'Manager' };
  await context.addInitScript(user => {
    localStorage.setItem('lpg:session','test-token'); localStorage.setItem('lpg:user',JSON.stringify(user));
  },user);
  const state = { quantity: 56, loginCalls: 0, ready: true };
  const stop = { id: 1, sopir_id: 1, sopir_nama: 'Budi', pangkalan_id: 1001, pangkalan_nama: 'Bumdes Antap', latitude: -8.530381144598763, longitude: 115.00622830864008, urutan: 1, estimasi_waktu_tiba: '09:00', deadline_at: '2026-11-04T01:00:00Z' };
  await context.route('**/functions/v1/lpg-api/api/**', async route => {
    const path=new URL(route.request().url()).pathname.split('/api')[1];
    let result={ok:true};
    if(path==='/session') result={user};
    else if(path==='/login') { state.loginCalls++; result={user,token:'test-token'}; }
    else if(path==='/health') result={ok:true};
    else if(path==='/tracking') result=route.request().method()==='GET'?[]:{ok:true};
    else if(path==='/manager/summary') result={stats:{},inspeksi:[],pengiriman:[],laporanBahaya:[],kpiData:[],permintaanLpg:[],currentPositions:[],semuaSopir:[],persediaanLpg:520};
    else if(path==='/manager/demands' && route.request().method()==='POST') state.quantity=route.request().postDataJSON().entries[0].quantity;
    else if(path==='/manager/demands') result={routes:[{...stop,permintaan_tabung:state.quantity}]};
    else if(path==='/driver/1/routes') result={rute:[{...stop,permintaan_tabung:state.quantity}],delivered:[],origin:{latitude:-8.511797,longitude:115.109831}};
    else if(path==='/driver/1/announcements') result={overdue:[{...stop,permintaan_tabung:state.quantity}]};
    else if(path==='/driver/1/summary') result={sopir:user,siapBerangkat:state.ready,maxTabung:543,stok:520};
    else if(path==='/driver/1/fatigue') result={monitoring:null,latest:null};
    await route.fulfill({json:result});
  });
  return state;
}

for(const role of ['driver','manager']) test(`${role} session survives visiting homepage, login entry, and reload`,async({page,context})=>{
  const state=await mockSession(context,role);
  const entry=role==='driver'?'/login':'/admin/login';
  const destination=role==='driver'?'/sopir':'/manager';
  await page.goto(entry); await expect(page).toHaveURL(new RegExp(destination+'$'));
  await page.goto('/'); await page.goto(entry); await expect(page).toHaveURL(new RegExp(destination+'$'));
  await page.reload(); await expect(page.locator('main')).toBeVisible();
  expect(state.loginCalls).toBe(0);
});

test('manager saves manual demand without polling erasing draft',async({page,context})=>{
  const state=await mockSession(context,'manager');
  await page.goto('/manager/pengiriman');
  const input=page.getByRole('spinbutton',{name:'Permintaan Bumdes Antap untuk Budi'});
  await input.fill('72');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(input).toHaveValue('72');
  await page.getByRole('button',{name:'Simpan Permintaan Lokasi'}).click();
  await expect(page.getByRole('status')).toContainText('Permintaan disimpan');
  expect(state.quantity).toBe(72); await expect(input).toHaveValue('72');
});

test('driver sees location name, tabung demand, deadline alert and rendered map symbols',async({page,context})=>{
  await mockSession(context,'driver');
  await page.goto('/sopir/rute-map');
  await expect(page.getByRole('alert')).toContainText('Bumdes Antap');
  await expect(page.getByRole('alert')).toContainText('56 tabung');
  await expect(page.locator('.leaflet-tooltip')).toContainText('Bumdes Antap');
  await expect(page.locator('.leaflet-marker-icon svg')).toBeVisible();
  await page.goto('/sopir/on-duty');
  await expect(page.getByText('Permintaan: 56 Tabung')).toBeVisible();
  await expect(page.getByText('Batas tiba: 09:00 WITA')).toBeVisible();
  await page.getByRole('button',{name:'Lapor Bahaya / Kendala'}).click();
  await expect(page.getByRole('heading',{name:'Lapor Kendala / Bahaya Keselamatan (K3)'})).toBeVisible();
  await expect(page.locator('.modal-card summary')).toContainText('MSDS LPG');
});

 test('MSDS and hazard reporting remain accessible before delivery approval',async({page,context})=>{
  const state=await mockSession(context,'driver'); state.ready=false;
  await page.goto('/sopir/bahaya');
  await expect(page.getByRole('heading',{name:'Laporkan Bahaya',exact:true})).toBeVisible();
  await page.locator('summary').click();
  await expect(page.getByRole('heading',{name:'Prosedur Mitigasi 5S'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Kirim Laporan Bahaya'})).toBeEnabled();
});
