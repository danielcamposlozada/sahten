import { beforeAll, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildTestBundle, openApp, loadRawDemo } from './app-harness.js';
beforeAll(()=>buildTestBundle(),120000);
const trackedOpen = async () => { const a=await openApp(); a.errors=[];a.window.addEventListener('error',e=>a.errors.push(e.message));return a; };
const until = async fn => { for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));} throw Error('No terminó la operación'); };
it('edita por canal, muestra etiquetas internas, registra ventas nuevas y conserva el archivo al abrirlo',async()=>{
  const {window:w,errors}=await trackedOpen(); loadRawDemo(w); w.showPanel('productos');
  const p=w.SAHTEN.state.products[0]; w.SAHTEN.pricing.open(p.id);
  const d=w.document;
  for(const [key,value] of [['price','12000'],['variableCost','3200'],['fixedCost','1500']]){
    d.querySelector(`[data-lock="${key}"]`).click();const input=d.querySelector(`[data-value="${key}"]`);input.value=value;input.dispatchEvent(new w.Event('input'));
  }
  d.getElementById('pricing-reason').value='Carta de prueba'; d.getElementById('pricing-reason').dispatchEvent(new w.Event('input'));
  d.querySelector('[data-save]').click(); await until(()=>!d.querySelector('.pricing-dialog'));
  expect(p.pricingPolicies.mostrador.price).toBe(12000); expect(p.pricingHistory[0].reason).toBe('Carta de prueba');
  w.showPanel('mostrador');expect(d.querySelector('.price-fixed-badge')).not.toBeNull();
  d.querySelector('.price-fixed-badge').click();expect(w.eval('mostradorCart.length')).toBe(0);
  d.querySelector('.pricing-dialog [data-close]').click();
  w.mostradorAddToCart(p.id);w.mostradorCheckout();const o=w.sahtenOrders()[0];
  expect(w.SAHTEN.state.saleCosts[o.id].items[0]).toMatchObject({unitVariable:3200,unitFixed:1500,unitPrice:12000});
  w.openOrderDetail(o.id); expect(d.getElementById('order-detail-overlay').textContent).toContain('Costos guardados de esta orden');d.getElementById('order-detail-overlay').remove();
  const f=w.SAHTEN.project.collect(); await w.SAHTEN.project.apply(f);
  expect(w.SAHTEN.state.products[0].pricingPolicies.mostrador.price).toBe(12000);
  expect(w.SAHTEN.state.saleCosts[o.id].items[0].unitFixed).toBe(1500);
  expect(w.SAHTEN.online.publish.currentMenu().products.find(x=>x.id===p.id)).not.toHaveProperty('priceFixedChannels');
  expect(errors).toEqual([]);w.close();
});
it('prueba perfil IT01 y escala como preferencias locales independientes del negocio',async()=>{
  const {window:w}=await trackedOpen();loadRawDemo(w);w.renderCustPanel();const d=w.document;
  d.getElementById('cust-receipt-printer').value='it01';w.custUpdateReceiptPrinter();
  expect(w.SAHTEN.receiptPaper.current().contentMm).toBe(35.2);
  let html;w.SAHTEN.printDocument=async h=>{html=h;};w.previewComandaFromSettings();
  const initialPrintStyle=html.match(/<style>([\s\S]*?)<\/style>/)[1];
  await w.SAHTEN.interfaceScale.set(90);w.previewComandaFromSettings();
  expect(html).toContain('width: 35.2mm');expect(html.match(/<style>([\s\S]*?)<\/style>/)[1]).toBe(initialPrintStyle);expect(html).not.toMatch(/transform:\s*scale/);
  const file=JSON.stringify(w.SAHTEN.project.collect());expect(file).not.toContain('sahten-interface-scale');expect(file).not.toContain('sahten-receipt-calibration');w.close();
});
it('importa Excel con direcciones, muestra vista previa y no guarda hasta confirmar; reimportar no duplica',async()=>{
  const {window:w,errors}=await trackedOpen();loadRawDemo(w);w.showPanel('mostrador');w.mostSetTab('clientes');
  w.SAHTEN.libs.xlsx=async()=>XLSX;
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Id','Nombre','Teléfono','Cant_compras'],['1','Ana','+5491112345678',3],['2','Luis','+5491112345678',2]]),'Clientes');
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Id Cliente','Calle','Número','Piso/Depto','Ciudad','Es principal'],['1','Roca','10','1','Olivos','Sí'],['1','Laprida','20','','','No']]),'Direcciones');
  const bytes=XLSX.write(book,{type:'array',bookType:'xlsx'});
  async function preview(){
    w.SAHTEN.customersImport.open();const input=w.document.getElementById('customer-import-file');
    Object.defineProperty(input,'files',{value:[{name:'clientes.xlsx',size:bytes.byteLength,arrayBuffer:async()=>bytes}]});
    input.dispatchEvent(new w.Event('change'));await until(()=>w.document.querySelector('[data-import-save]')?.textContent==='Importar 2 clientes'||w.document.querySelector('.pricing-error')?.textContent);return w.document;
  }
  const d=await preview();expect(d.querySelector('.pricing-error').textContent).toBe('');expect(w.sahtenCustomers()).toHaveLength(0);
  expect(d.querySelector('[data-import-preview]').textContent).toContain('2 direcciones');d.querySelector('[data-import-save]').click();
  expect(w.sahtenCustomers()).toHaveLength(2);expect(w.sahtenCustomers()[0].addresses).toHaveLength(2);expect(w.sahtenCustomers()[0].phone).toBe('+5491112345678');
  expect(w.sahtenOrders()).toHaveLength(0);
  const f=w.SAHTEN.project.collect();await w.SAHTEN.project.apply(f);expect(w.sahtenCustomers()[0].addresses[0].street).toBe('Roca');
  w.SAHTEN.customersImport.open();const input=d.getElementById('customer-import-file');Object.defineProperty(input,'files',{value:[{name:'clientes.xlsx',size:bytes.byteLength,arrayBuffer:async()=>bytes}]});input.dispatchEvent(new w.Event('change'));
  await until(()=>d.querySelector('[data-import-save]')?.textContent==='Importar 0 clientes');expect(w.sahtenCustomers()).toHaveLength(2);expect(d.querySelector('[data-import-save]').disabled).toBe(true);expect(errors).toEqual([]);w.close();
});
it('lee CSV UTF-8 y conserva el signo más y los ceros del teléfono',async()=>{
  const {window:w}=await trackedOpen();loadRawDemo(w);w.SAHTEN.libs.xlsx=async()=>XLSX;w.SAHTEN.customersImport.open();
  w.TextDecoder=TextDecoder;
  const bytes=new TextEncoder().encode('\uFEFFNombre;Teléfono;Email\nMaría;0011223344;\nJosé;+5491112345678;\n');
  const input=w.document.getElementById('customer-import-file');Object.defineProperty(input,'files',{value:[{name:'lista.csv',size:bytes.length,arrayBuffer:async()=>bytes.buffer}]});input.dispatchEvent(new w.Event('change'));
  await until(()=>w.document.querySelector('[data-import-save]')?.textContent==='Importar 2 clientes');w.document.querySelector('[data-import-save]').click();
  expect(w.sahtenCustomers().map(c=>c.name)).toEqual(['María','José']);expect(w.sahtenCustomers()[0].phone).toBe('0011223344');w.close();
});
it('actualiza los controles y resultado al mover sliders: costo con precio automático y costo con precio fijado', async()=>{
  const {window:w}=await trackedOpen();loadRawDemo(w);
  const p=w.SAHTEN.state.products[0];w.SAHTEN.pricing.open(p.id);const d=w.document;
  const set=(key,value)=>{const el=d.querySelector(`[data-range="${key}"]`);if(Number(el.max)<value)el.max=value;el.value=value;el.dispatchEvent(new w.Event('input'));};
  const value=key=>Number(d.querySelector(`[data-value="${key}"]`).value);
  expect(d.querySelector('[data-field="price"]').classList.contains('pricing-primary')).toBe(true);
  expect(d.querySelector('[data-lock="price"]').textContent).toContain('Fijar precio');
  expect(d.querySelector('[data-value="variableCost"]').disabled).toBe(true);
  d.querySelector('[data-lock="variableCost"]').click();
  const before=value('price');set('variableCost',500);
  expect(value('price')).not.toBe(before);
  expect(d.querySelector('[data-result="price"]').textContent).toBe(w.fmt(value('price')));
  // Fijar captura el precio automático con el costo ya cambiado, no el original.
  const calculated=value('price');d.querySelector('[data-lock="price"]').click();
  expect(value('price')).toBe(calculated);
  set('price',12000);set('variableCost',1000);
  const rest=d.querySelector('[data-result="remaining"]').textContent;
  set('variableCost',1500);
  expect(value('price')).toBe(12000);expect(d.querySelector('[data-result="remaining"]').textContent).not.toBe(rest);
  expect(d.querySelector('[data-formula-note]').textContent).toContain('sin cambiar el precio');
  expect(d.querySelector('[data-field="price"]').dataset.mode).toBe('fixed');
  expect(d.querySelector('[data-lock="price"] svg')).not.toBeNull();
  expect(d.querySelector('[data-live-result]').textContent).toContain('Precio fijado');
  d.querySelector('[data-lock="price"]').click();
  expect(value('price')).not.toBe(12000);
  expect(d.querySelector('[data-field="price"]').dataset.mode).toBe('auto');w.close();
});
