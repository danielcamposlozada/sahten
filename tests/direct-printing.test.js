import { it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { createDirectPrinting, installDirectPrinting } from '../src/desktop/receipt-printing.js';
import { receiptOptions, saveReceiptOptions, installReceipts } from '../src/ui/receipt-settings.js';
const memory=()=>{const v=new Map();return {getItem:k=>v.get(k)||null,setItem:(k,s)=>v.set(k,s)};};
it('opciones independientes por origen y opt-in, conserva opciones anteriores al cambiar una sola',()=>{
 const storage=memory();expect(receiptOptions(storage)).toEqual({autoLocal:false,autoOnline:false,directLocal:false,directOnline:false});
 saveReceiptOptions({autoLocal:true},storage);saveReceiptOptions({autoOnline:true,directOnline:true},storage);
 expect(receiptOptions(storage)).toEqual({autoLocal:true,autoOnline:true,directLocal:false,directOnline:true});
});
it('usa solo la impresora elegida y propaga fallo nativo sin abrir diálogo ni usar otra impresora',async()=>{
 const storage=memory(),call=vi.fn(async command=>command==='receipt_printers'?{supported:true,printers:['IT01','Otra']} : undefined);
 const api=createDirectPrinting({storage,native:true,call});await api.refresh();
 await expect(api.print('ticket',{paperWidthMm:48})).rejects.toThrow('Elegí la impresora');expect(call).toHaveBeenCalledTimes(1);
 api.select('IT01');await expect(api.print('ticket',{paperWidthMm:48})).resolves.toEqual({status:'sent',printer:'IT01'});
 expect(call).toHaveBeenLastCalledWith('receipt_print',{html:'ticket',printer:'IT01',paperWidthMm:48});
 call.mockRejectedValueOnce(Error('Sin papel'));await expect(api.print('ticket',{paperWidthMm:48})).rejects.toThrow('Sin papel');
 expect(api.info().selected).toBe('IT01');
});
it('navegador no invoca Tauri y no ofrece una impresión silenciosa falsa',async()=>{
 const call=vi.fn(),api=createDirectPrinting({storage:memory(),call});await api.refresh();await expect(api.print('ticket',{paperWidthMm:58})).rejects.toThrow('app de escritorio');expect(call).not.toHaveBeenCalled();
 const w=new JSDOM('<div id="receipt-direct-settings"><select></select><p role="status"></p></div><input id="receipt-direct-local"><input id="receipt-auto-local" checked>',{url:'http://localhost'}).window;
 w.SAHTEN={receipts:{options:()=>({})}};const ui=installDirectPrinting(w);ui.render();expect(w.document.querySelector('select').disabled).toBe(true);expect(w.document.getElementById('receipt-direct-local').disabled).toBe(true);w.close();
});
it('cola enruta local/web por separado, espera el envío nativo y no repite historial/realtime',async()=>{
 const w=new JSDOM('<body></body>',{url:'http://localhost'}).window;
 const local={id:'local',num:1},online={id:'online',num:2};w.SAHTEN={project:{session:{id:'p'}}};w.sahtenOrders=()=>[local,online];w.printComanda=vi.fn(async()=>true);w.pushNotification=vi.fn();
 const receipts=installReceipts(w);receipts.save({autoLocal:true,autoOnline:true,directLocal:false,directOnline:true});
 expect(receipts.enqueue(online,{origin:'online',initial:true})).toBe(false);
 receipts.enqueue(local);receipts.enqueue(online,{origin:'online'});await new Promise(r=>setTimeout(r,0));
 expect(w.printComanda.mock.calls).toEqual([['local',{automatic:true,direct:false}],['online',{automatic:true,direct:true}]]);
 expect(receipts.enqueue(online,{origin:'online'})).toBe(false);expect(w.pushNotification).not.toHaveBeenCalled();w.close();
});
it('render aislado conserva ticket/estilos, elimina código y fuentes externas, informa tamaño una sola vez',async()=>{
 const html=readFileSync(new URL('../public/receipt-print.html',import.meta.url),'utf8');
 const w=new JSDOM(html,{runScripts:'dangerously'}).window,invoke=vi.fn(async()=>{});
 w.__TAURI_INTERNALS__={invoke};Object.defineProperty(w.document,'fonts',{value:{ready:Promise.resolve()}});w.HTMLElement.prototype.getBoundingClientRect=()=>({height:500});
 await w.renderReceipt('<html><head><style>body{width:35.2mm}</style></head><body><div>ORDEN #42</div><svg><path d="M0 0"/></svg><script>window.bad=true</script><iframe src="https://example.com"></iframe><p onclick="alert(1)">Dirección</p><img src="https://example.com/logo.png"></body></html>');
 // External/broken images fail the receipt instead of silently omitting a logo/QR.
 expect(invoke.mock.calls[0][1].error).toContain('imagen');
 expect(w.bad).toBeUndefined();expect(w.document.querySelector('iframe')).toBeNull();expect(w.document.querySelector('[onclick]')).toBeNull();expect(w.document.querySelector('img').hasAttribute('src')).toBe(false);expect(w.document.body.textContent).toContain('ORDEN #42');
 invoke.mockClear();await w.renderReceipt('<html><head><style>body{width:35.2mm}</style></head><body><p>ORDEN #43</p></body></html>');
 expect(invoke).toHaveBeenCalledExactlyOnceWith('receipt_ready',{heightPx:500,error:null});w.close();
});
