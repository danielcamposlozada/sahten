// Cola persistente SOLO de estados. Una entrada fallida no bloquea a los demás productos.
export function createAvailabilityPublisher({ publish, context, enabled, store, namespace = 'listing', accepts = value => typeof value === 'boolean', timer = { set: (f, ms) => setTimeout(f, ms), clear: id => clearTimeout(id) } }) {
  let generation=0,handle=null,busy=false,state='sin cambios',error=null,attempts=0,sequence=0,states={};
  const listeners=new Set(),key=()=> 'catalog-state:'+namespace+':'+context();
  const pending=()=>store.get(key(),{})||{};
  const emit=()=>listeners.forEach(fn=>{try{fn(api.info());}catch{/* una vista cerrada no pierde la cola */}});
  const later=ms=>{timer.clear(handle);handle=timer.set(()=>api.flush().catch(()=>{}),ms);};
  const api={
    info:()=>({state,error,pending:Object.keys(pending()).length,states:{...states},changes:{...pending()}}),
    onChange(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    set(id,available,resumeAt=null){
      if(!context()||typeof id!=='string'||!id||!accepts(available))return;
      store.set(key(),{...pending(),[id]:{available,resumeAt,token:String(Date.now())+':'+(++sequence)}});
      states[id]='pendiente';state='pendiente';error=null;later(500);emit();
    },
    discard(id){const rest={...pending()};delete rest[id];store.set(key(),rest);delete states[id];state=Object.keys(rest).length?'pendiente':'sin cambios';error=null;emit();},
    resume(){timer.clear(handle);states={};error=null;state=Object.keys(pending()).length?'pendiente':'sin cambios';if(Object.keys(pending()).length)later(0);emit();},
    cancel(){generation++;timer.clear(handle);states={};state='sin cambios';error=null;emit();},
    async flush(){
      if(busy||!Object.keys(pending()).length)return;
      if(!enabled()){state='pendiente';error='Iniciá sesión con permisos de administración para publicar estos estados.';emit();return;}
      busy=true;const ctx=context(),gen=generation,blocked=new Set();const same=()=>ctx===context()&&gen===generation;
      try{
        while(same()&&enabled()){
          const entry=Object.entries(pending()).find(([id])=>!blocked.has(id));if(!entry)break;
          const [id,change]=entry;
          if(namespace==='sales'&&!change.available&&change.resumeAt&&Date.parse(change.resumeAt)<=Date.now()){const rest={...pending()};delete rest[id];store.set(key(),rest);states[id]='publicado';continue;}
          state='publicando';states[id]='publicando';emit();
          try{
            await publish(id,change.available,change.resumeAt);if(!same())return;
            const rest={...pending()};
            if(rest[id]?.token===change.token){delete rest[id];states[id]='publicado';}else states[id]='pendiente';
            store.set(key(),rest);attempts=0;
          }catch(e){
            if(!same())return;
            error=e.message;states[id]=e.offline?'sin conexión':'error';
            if(e.offline||e.status>=500||e.code==='menu_busy')throw e;
            blocked.add(id);
          }
        }
        if(same()){state=blocked.size?'error':Object.keys(pending()).length?'pendiente':'publicado';if(state==='publicado')error=null;}
      }catch(e){if(!same())return;state=e.offline?'sin conexión':'error';error=e.message;later([3000,10000,30000,60000][Math.min(attempts++,3)]);throw e;}
      finally{busy=false;if(same()){if(state==='pendiente')later(500);emit();}else if(Object.keys(pending()).length)api.resume();}
    },
  };return api;
}
