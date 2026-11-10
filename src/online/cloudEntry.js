// Inicio de sesión nativo Sahten: usuario + contraseña/código, sin pedir URL o anon key.
// El token se persiste SOLO después de comprobar permisos en project_members.
// No reemplaza un proyecto local sin aprobación del usuario.
import { createClient, SupabaseError } from './supabase.js';
import { SAHTEN_AUTH_URL, SAHTEN_AUTH_PUBLISHABLE_KEY } from './cloudConfig.js';
import { showLoginCode, showPasswordRecovery } from './authDialogs.js';
import { receivesFullProject, applyPublicToFile, ROLES } from './roles.js';
import { createImageStore } from './images.js';
import { sahtenDialog } from '../ui/dialog.js';
import { emptyFile, serialize } from '../project/schema.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const emailOk = s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || '').trim());

export async function accessibleProjects(client) {
  const user=client.auth.user;
  if(!user?.id)throw new SupabaseError('Iniciá sesión para ver tus negocios.',{code:'no_session'});
  const token=await client.auth.token();
  // Comprobamos membresía explícita. Nunca asignamos owner por defecto.
  const members=await client.raw('/rest/v1/project_members?select=project_id,role&user_id=eq.'+encodeURIComponent(user.id),{token});
  const roles=new Map((Array.isArray(members)?members:[])
    .filter(m=>ROLES.includes(m.role)).map(m=>[m.project_id,m.role]));
  if(!roles.size)return [];
  const rows=await client.raw('/rest/v1/projects?select=id,name,version&order=updated_at.desc',{token});
  return (Array.isArray(rows)?rows:[]).filter(p=>roles.has(p.id))
    .map(p=>({id:p.id,name:p.name||'Negocio sin nombre',role:roles.get(p.id)}));
}

export function createCloudEntry({w,project,online}) {
  const config=project.config;
  const accountKey='sahten:email-login';
  const remember=email=>config.set(accountKey,String(email).trim());
  const remembered=()=>config.get(accountKey,'')||'';
  const newClient=()=>createClient({url:SAHTEN_AUTH_URL,anonKey:SAHTEN_AUTH_PUBLISHABLE_KEY,fetchImpl:w.fetch?.bind(w),WebSocketImpl:w.WebSocket});
  let pending=null,active=false;

  async function openAccount(client) {
    const choices=await accessibleProjects(client);
    if(!choices.length)throw new SupabaseError('Este correo no tiene todavía un negocio asignado. Pedile al administrador que te invite desde Nube y usuarios.',{code:'no_project'});
    let selected=choices[0];
    if(choices.length>1){
      const body='<p class="sd-text">Elegí el negocio al que querés entrar:</p>';
      const result=await sahtenDialog({
        title:'Tus negocios',body,w,
        actions:[{label:'Cancelar',value:null},...choices.map(p=>({label:p.name,value:p.id,primary:false}))],
      });
      selected=choices.find(p=>p.id===result);
      if(!selected)return false;
    }
    // Consultas autenticadas con RLS/RPC; no se confía en IDs o roles del cliente.
    const token=await client.auth.token();
    const storeRows=await client.raw('/rest/v1/stores?select=id,slug,project_id&project_id=eq.'+encodeURIComponent(selected.id),{token});
    let rawFile;
    if(receivesFullProject(selected.role)){
      const result=await client.rpc('get_project_data',{pid:selected.id});
      rawFile=result?.data;
    }else{
      const result=await client.rpc('get_project_public',{pid:selected.id});
      if(result?.public){
        rawFile=applyPublicToFile(emptyFile(result.name||selected.name),result.public);
      }
    }
    if(!rawFile?.project||!rawFile?.online)throw new SupabaseError('La nube no devolvió los datos de este negocio. No se cambió el proyecto local.');
    // El UUID de la nube (projects.id) NO es el ID local del archivo .sahten.
    // Ambos se conservan para evitar duplicados y errores de sincronización.
    const localId=rawFile.project.id;
    if(typeof localId!=='string'||!localId.trim())throw new SupabaseError('El negocio no tiene un identificador local válido.');
    const cloudConn=rawFile.online.supabase||{};
    const store=(Array.isArray(storeRows)?storeRows:[]).find(x=>x.id===cloudConn.storeId)||(Array.isArray(storeRows)?storeRows:[])[0];
    if(!store?.id)throw new SupabaseError('Este negocio todavía no tiene una tienda conectada. Consultá al administrador.');
    const conn={url:SAHTEN_AUTH_URL,anonKey:SAHTEN_AUTH_PUBLISHABLE_KEY,storeId:store.id,slug:store.slug||'',projectId:selected.id};
    const session=project.session;
    const alreadyOpen=session.isOpen&&session.id===localId;
    if(session.isOpen&&!alreadyOpen){
      if(!session.info().hasFile)throw new SupabaseError('El proyecto actual todavía no tiene archivo guardado. Guardalo o exportá una copia antes de cambiar de negocio.');
      const ok=await w.sahtenConfirm('Se abrirá «'+selected.name+'» desde la nube. El archivo local actual se guardará antes de cambiar. ¿Querés continuar?',
        {title:'Cambiar de negocio',okLabel:'Abrir desde la nube',w});
      if(!ok)return false;
      await session.backupBeforeSync().catch(()=>{});
      if(session.info().hasFile&&!session.readOnly)await session.saveNow({force:true});
    }
    const authSession=client.auth.session;
    if(!authSession?.access_token||!authSession?.refresh_token)throw new SupabaseError('La sesión de correo venció. Volvé a ingresar.');
    // Preparar sesión y rol antes de abrir el proyecto: onProjectOpened hace resume().
    config.set('online-session:'+localId,authSession);
    config.set('online-role:'+localId,selected.role);
    if(alreadyOpen){
      Object.assign(w.SAHTEN_SUPABASE,conn);
      project.markDirty();
      session.setReadOnly(selected.role==='lectura');
      await online.onProjectOpened();
    }else{
      const file=await createImageStore(client).restore(rawFile,{});
      file.project.id=localId;
      file.online={...file.online,supabase:conn};
      await session.openText(serialize(file),null,(file.project.name||selected.name)+'.sahten');
      session.setReadOnly(selected.role==='lectura');
    }
    w.document.getElementById('proj-welcome')?.remove();
    online.userMenu?.render();
    w.sahtenToast('Ingresaste a '+selected.name+'.');
    return true;
  }

  const resetApi={
    requestPasswordReset:async email=>newClient().auth.recover(email),
    resetPasswordWithLink:async(link,password)=>{
      if(password.length<8)throw new SupabaseError('La contraseña debe tener al menos 8 caracteres.');
      const temp=newClient();
      try{await temp.auth.verifyEmailActionLink(link,'recovery');await temp.auth.updatePassword(password);}
      finally{temp.auth.signOut();}
    },
    resetPassword:async(email,code,password)=>{
      if(password.length<8)throw new SupabaseError('La contraseña debe tener al menos 8 caracteres.');
      const temp=newClient();
      try{await temp.auth.verifyRecoveryCode(email,code);await temp.auth.updatePassword(password);}
      finally{temp.auth.signOut();}
    }
  };

  async function start() {
    if(active)return false;
    active=true;
    try{
      pending=null;
      let flow='';
      const body='<p class="sd-text">Entrá a tu negocio con tu cuenta de Sahten. No necesitás configurar servidores ni claves.</p>'+
        '<div class="sd-field"><label for="cloud-mail">Correo electrónico</label><input id="cloud-mail" type="email" class="sd-input" autocomplete="username" value="'+esc(remembered())+'" autofocus></div>'+
        '<div class="sd-field"><label for="cloud-pass">Contraseña</label><input id="cloud-pass" type="password" class="sd-input" autocomplete="current-password"></div>'+
        '<div class="sd-row"><button type="button" class="sd-linkbtn" data-cloud="otp">Ingresar con código por correo</button><button type="button" class="sd-linkbtn" data-cloud="reset">Recuperar contraseña</button></div>';
      const accepted=await sahtenDialog({
        title:'Ingresar a Sahten',body,w,width:450,
        actions:[{label:'Cancelar',value:false},{label:'Iniciar sesión',value:true,primary:true}],
        onOpen:api=>{
          const go=which=>{const email=api.box.querySelector('#cloud-mail').value.trim();if(emailOk(email))remember(email);flow=which;api.close(false);};
          api.box.querySelector('[data-cloud="otp"]').onclick=()=>go('otp');
          api.box.querySelector('[data-cloud="reset"]').onclick=()=>go('reset');
        },
        validate:async(_v,api)=>{
          const email=api.box.querySelector('#cloud-mail').value.trim(),pw=api.box.querySelector('#cloud-pass').value;
          if(!emailOk(email)||!pw){api.setError('Ingresá tu correo y contraseña.');return false;}
          api.setError('');api.busy(true,'Verificando…');
          try{pending=newClient();await pending.auth.signIn(email,pw);remember(email);return true;}
          catch(e){api.busy(false);pending=null;api.setError(e.message||'No se pudo ingresar.');return false;}
        }
      });
      if(flow==='reset'){
        const reset=await showPasswordRecovery({online:resetApi,w,email:remembered(),remember});
        if(reset===true)return await startAgain();
        return false;
      }
      if(flow==='otp'){
        const otpClient=newClient();
        const otpApi={
          sendLoginCode:email=>otpClient.auth.sendLoginCode(email),
          signInWithCode:async(email,code)=>{await otpClient.auth.verifyLoginCode(email,code);pending=otpClient;},
          signInWithLink:async link=>{await otpClient.auth.verifyEmailActionLink(link,'login');pending=otpClient;}
        };
        const result=await showLoginCode({online:otpApi,w,email:remembered(),remember,name:'Sahten',notify:false});
        if(result!==true)return false;
      } else if(accepted!==true) return false;
      return await openAccount(pending);
    }catch(e){
      await w.sahtenAlert(e.message||'No se pudo abrir tu negocio.',{title:'Acceso a Sahten',w});
      return false;
    }finally{active=false;pending=null;}
  }
  // Recuperar contraseña vuelve a la pantalla de login sin recursión activa.
  async function startAgain(){w.setTimeout(()=>start().catch(()=>{}),0);return false;}
  return {start,accessibleProjects:()=>pending?accessibleProjects(pending):[]};
}
