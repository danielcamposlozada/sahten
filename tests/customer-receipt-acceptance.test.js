import { beforeAll,it,expect,vi } from 'vitest';
import {buildTestBundle,openApp,loadRawDemo} from './app-harness.js';

beforeAll(()=>buildTestBundle(),120000);

it('al aceptar un pedido online, imprime automáticamente solo el ticket de cliente y una vez',async()=>{
 const {window:w}=await openApp();
 try{
  loadRawDemo(w);
  const product=w.SAHTEN.state.products[0];
  const order={id:'web-accept-test',remoteId:'remote-accept-test',origin:'menu-online',
   num:551,source:'pickup',status:'pendiente',createdAt:new Date().toISOString(),
   customerName:'Cliente de prueba',customerPhone:'1112223333',
   items:[{productId:product.id,name:product.name,qty:1,unitPrice:9000,lineTotal:9000}],
   subtotal:9000,total:9000};
  w.eval('SAHTEN_ORDERS='+JSON.stringify([order]));
  const enqueue=vi.spyOn(w.SAHTEN.receipts,'enqueue').mockReturnValue(true);
  w.orderSetStatus(order.id,'en_preparacion');
  expect(enqueue).toHaveBeenCalledTimes(1);
  expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({id:order.id,status:'en_preparacion'}),{origin:'online'});
  w.orderSetStatus(order.id,'listo');
  expect(enqueue).toHaveBeenCalledTimes(1);
  w.openOrderDetail(order.id);
  const detail=w.document.getElementById('order-detail-overlay');
  expect(detail?.textContent).toContain('Ticket cliente');
  expect(detail?.textContent).not.toContain('Imprimir comanda');
  w.showPanel('mostrador');w.mostSetTab('online');
  expect(w.document.querySelector('[data-online-action="print"][data-id="web-accept-test"]')).toBeTruthy();
 }finally{w.close();}
});

it('no imprime al cancelar ni al modificar una venta local',async()=>{
 const {window:w}=await openApp();
 try{
  loadRawDemo(w);
  const p=w.SAHTEN.state.products[0],order={id:'local-test',num:552,status:'pendiente',
   source:'pickup',orderType:'retiro',items:[{productId:p.id,name:p.name,qty:1,unitPrice:1000,lineTotal:1000}],
   subtotal:1000,total:1000,createdAt:new Date().toISOString()};
  w.eval('SAHTEN_ORDERS='+JSON.stringify([order]));
  const enqueue=vi.spyOn(w.SAHTEN.receipts,'enqueue').mockReturnValue(true);
  w.orderSetStatus('local-test','en_preparacion');
  expect(enqueue).not.toHaveBeenCalled();
  w.orderSetStatus('local-test','cancelado');
  expect(enqueue).not.toHaveBeenCalled();
 }finally{w.close();}
});
