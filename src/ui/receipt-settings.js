import { buildReceipt } from './receipt-template.js';
const KEY='sahten-receipt-options';
export function receiptOptions(storage=globalThis.localStorage){try{const v=JSON.parse(storage.getItem(KEY)||'{}');return {autoLocal:v.autoLocal===true,autoOnline:v.autoOnline===true};}catch{return {autoLocal:false,autoOnline:false};}}
export function saveReceiptOptions(options,storage=globalThis.localStorage){const value={autoLocal:options.autoLocal===true,autoOnline:options.autoOnline===true};storage.setItem(KEY,JSON.stringify(value));return value;}
export function createAutoPrinter({storage,context,find,print,notify=()=>{}}){
 let queue=[],running=false;let seen;try{seen=JSON.parse(storage.getItem('sahten-receipt-attempts')||'[]');if(!Array.isArray(seen))seen=[];}catch{seen=[];}
 const remember=key=>{seen=[...seen.filter(k=>k!==key),key].slice(-1000);try{storage.setItem('sahten-receipt-attempts',JSON.stringify(seen));}catch{}};
 async function drain(){if(running)return;running=true;try{while(queue.length){const job=queue.shift();if(job.context!==context())continue;const order=find(job.id),options=receiptOptions(storage);if(!order||order.status==='cancelado'||!(job.origin==='online'?options.autoOnline:options.autoLocal))continue;try{const result=await print(job.id);if(result===false)throw Error('No se abrió la impresión.');}catch{notify('No se pudo iniciar la impresión de #'+String(order.num).padStart(4,'0')+'. Podés reimprimir desde Pedidos.');}}}finally{running=false;}}
 return {enqueue(order,{origin='local',initial=false}={}){const opts=receiptOptions(storage),ctx=context();if(initial||!ctx||order.id==='preview'||order.status==='cancelado'||!(origin==='online'?opts.autoOnline:opts.autoLocal))return false;const key=ctx+':'+order.id;if(seen.includes(key)||queue.length>=50)return false;remember(key);queue.push({id:order.id,context:ctx,origin});void drain();return true;},idle:()=>!running&&queue.length===0};
}
function waitForPrintDialog(w){const frame=w.document.getElementById('sahten-print-frame');if(!frame)return Promise.resolve();return new Promise((resolve,reject)=>{const target=frame.contentWindow;let timer;const done=()=>{w.clearTimeout(timer);target?.removeEventListener('afterprint',done);resolve();};target?.addEventListener('afterprint',done,{once:true});timer=w.setTimeout(()=>{target?.removeEventListener('afterprint',done);reject(new Error('La impresión anterior sigue abierta.'));},60000);});}
export function installReceipts(w){
 const context=()=>w.SAHTEN.project.session.id;
 const auto=createAutoPrinter({storage:w.localStorage,context,find:id=>w.sahtenOrders?.().find(o=>o.id===id),print:async id=>{const ctx=context();await waitForPrintDialog(w);if(ctx!==context())return false;const result=await w.printComanda(id,{automatic:true});await waitForPrintDialog(w);return result;},notify:body=>w.pushNotification?.({type:'system',title:'Revisar impresión',body})});
 return {html:buildReceipt,options:()=>receiptOptions(w.localStorage),save:options=>saveReceiptOptions(options,w.localStorage),enqueue:auto.enqueue};
}
