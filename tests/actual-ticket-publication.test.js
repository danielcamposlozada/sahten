import {beforeAll,it,expect,vi} from 'vitest';
import {buildTestBundle,openApp,loadRawDemo} from './app-harness.js';

beforeAll(()=>buildTestBundle(),120000);

it('imprime publicidad publicada de ticket cliente desde el RPC y pastilla online; cocina no',async()=>{
 const {window:w}=await openApp();
 try{
  loadRawDemo(w);
  const order={id:'ticket-live-1',num:603,status:'pendiente',source:'pickup',
    origin:'mostrador',createdAt:'2026-11-02T16:00:00Z',
    items:[{productId:'fatay',name:'Fatay',qty:1,lineTotal:5850,unitPrice:5850}],
    subtotal:5850,total:5850};
  w.eval('SAHTEN_ORDERS='+JSON.stringify([order]));
  const config={source:'published_server',enabled:true,ticket:{enabled:true,advertise:true},
    campaigns:[{id:'weekly-meals',name:'Platos semanales',kind:'public',enabled:true,
      channels:['online','mostrador'],schedule:{type:'weekly',weekdays:[1,2,3]},
      advertising:{enabled:true,placement:['ticket'],message:'Platos semanales seleccionados'}}]};
  const controller=w.SAHTEN.online?.controller;
  expect(controller).toBeTruthy();
  const read=vi.spyOn(controller,'readPromotionTicketCampaigns').mockResolvedValue(config);
  const print=vi.spyOn(w.SAHTEN,'printDocument').mockResolvedValue(true);
  await w.printTicketCliente(order.id);
  expect(read).toHaveBeenCalledTimes(1);
  const html=print.mock.calls[0][0];
  expect(html).toContain('receipt-promo--A');
  expect(html).toContain('receipt-online-invite');
  expect(html).toContain('sahten.online');
  await w.printComanda(order.id);
  const kitchen=print.mock.calls[1][0];
  expect(kitchen).not.toContain('receipt-promo--');
  expect(kitchen).not.toContain('receipt-online-invite');
  expect(read).toHaveBeenCalledTimes(1);
 }finally{w.close();}
});
