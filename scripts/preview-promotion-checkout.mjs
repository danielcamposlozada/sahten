// Isolated visual QA. No credentials, customer data or real order submissions.
import {createServer as createVite} from 'vite';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const vite=await createVite({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
const {buildIndexHtml}=await vite.ssrLoadModule('/src/online/publish.js');
const {quoteOrder}=await vite.ssrLoadModule('/src/payments/core.js');
const {quotePromotions}=await vite.ssrLoadModule('/src/core/promotions.js');
const {sahtenDeliveryPolicy}=await vite.ssrLoadModule('/src/delivery/preset.js');
const menu={version:1,store:{name:'Sahten · demostración local',currency:{symbol:'$',locale:'es-AR'}},config:{enabled:true,showPrices:true,showImages:true,categories:['Platos','Dulces']},
 products:[{id:'plato',name:'Plato de demostración',description:'Vista de prueba; no crea pedidos reales.',price:30000,category:'Platos',image:'/media/sahten-editorial/compartir.jpg'},{id:'dulce',name:'Postre de demostración',price:7000,category:'Dulces',image:'/media/sahten-editorial/banner-tortas.webp'}],
 payments:{methods:{efectivo:true,transferencia:true},benefit:{enabled:true,percent:10,channels:{online:true}}},
 delivery:{enabled:false,deliveryV2:{...sahtenDeliveryPolicy(),active:true}},
 promotions:{enabled:true,version:1,paymentPercent:10,commercialPolicy:{minMarginPct:35,maxTotalPercent:25},campaigns:[{id:'demo',kind:'public',name:'Prueba de 15%',enabled:true,extraPercent:5,productIds:['dulce'],schedule:{type:'always'}}]},
 cartRecommendations:{enabled:true,beverageContexts:[],complements:[{id:'demo',name:'Algo rico para después',triggerProductIds:['plato'],productId:'dulce'}]},
 supabase:{url:'http://127.0.0.1:8798',anonKey:'public-demo-key',storeId:'00000000-0000-4000-8000-000000000001'}};
const costs={plato:9000,dulce:2000};
const html=buildIndexHtml(menu);
createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  let result;
  if(path==='/'){res.setHeader('content-type','text/html;charset=utf-8');res.end(html);return;}
  if(path.startsWith('/media/')){res.setHeader('content-type',path.endsWith('.webp')?'image/webp':'image/jpeg');res.end(await readFile(new URL('..'+path,import.meta.url)));return;}
  if(path==='/menu.json')result=menu;
  else if(path.includes('/rest/v1/menus'))result=[{json:menu}];
  else if(path.endsWith('/catalog-offers'))result=quotePromotions({lines:menu.products.map(p=>({productId:p.id,qty:1,unitPrice:p.price})),method:'efectivo',config:menu.promotions,trustedCosts:costs});
  else if(path.endsWith('/quote')){let raw='';for await(const chunk of req)raw+=chunk;const b=JSON.parse(raw);result={order:quoteOrder(menu,b.order,{allowOtherPayments:true,validateCustomer:false,trustedCosts:costs})};}
  else if(path.endsWith('/loyalty'))result={benefit:null};
  else if(path.includes('/functions/')){res.statusCode=403;result={error:'preview_only',message:'Demostración local: no se crean pedidos ni cobros.'};}
  else result=[];
  res.setHeader('content-type','application/json');res.end(JSON.stringify(result));
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:'preview_error',message:e.message}));}
}).listen(8798,'127.0.0.1',()=>console.log('Vista aislada: http://127.0.0.1:8798'));
