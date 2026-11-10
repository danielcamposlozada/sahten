// Acceso por código y recuperación de contraseña sin exponer credenciales de Supabase.
// Los códigos se validan exclusivamente en GoTrue; nunca se guardan ni se registran.
import { sahtenDialog } from '../ui/dialog.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const emailOk = s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s||'').trim());
const codeOk = s => /^\d{6,10}$/.test(String(s||'').trim());
const field = (id,label,opts={}) =>
  '<div class="sd-field"><label for="'+id+'">'+esc(label)+'</label><input class="sd-input" id="'+id+'" type="'+(opts.type||'text')+'" autocomplete="'+(opts.ac||'off')+'" value="'+esc(opts.value||'')+'" '+(opts.extra||'')+'></div>';
const read = (api,id) => api.box.querySelector('#'+id)?.value || '';

function installSender(api,{button,email,status,send,remember}) {
  const btn=api.box.querySelector('[data-sd="'+button+'"]'),msg=api.box.querySelector('[data-sd="'+status+'"]');
  btn.onclick=async()=>{
    const mail=read(api,email).trim();
    if(!emailOk(mail)){api.setError('Ingresá un correo electrónico válido.');return;}
    if(btn.disabled)return;
    btn.disabled=true;api.setError('');msg.textContent='Solicitando código…';
    try {
      await send(mail);
      remember(mail);
      msg.textContent='Si tu cuenta existe, recibirás un correo. Revisá también la carpeta de spam.';
    } catch(e) {
      msg.textContent='';
      api.setError(e.message || 'No se pudo enviar el mensaje. Probá nuevamente.');
    } finally { btn.disabled=false; }
  };
}

export async function showLoginCode({online,w,email='',remember=()=>{},name='Sahten',notify=true}) {
  const body='<p class="sd-text">Ingresá sin contraseña con un código temporal enviado al correo de tu cuenta.</p>'+
    field('auth-otp-email','Correo electrónico',{type:'email',ac:'username',value:email,extra:'autofocus'})+
    '<div class="sd-row"><button type="button" class="sd-linkbtn" data-sd="auth-send-login">Enviar código al correo</button></div>'+
    '<p class="sd-text sd-mute" role="status" aria-live="polite" data-sd="auth-login-status"></p>'+
    field('auth-otp-code','Código recibido',{ac:'one-time-code',extra:'inputmode="numeric" maxlength="10" placeholder="Código de 6 dígitos"'})+
    '<p class="sd-mute sd-small">El código vence y solo sirve una vez. Si no llega, revisá la carpeta de spam.</p>';
  return sahtenDialog({
    title:'Ingresar con código',body,w,width:430,
    actions:[{label:'Cancelar',value:false},{label:'Verificar e ingresar',value:true,primary:true}],
    onOpen:api=>installSender(api,{button:'auth-send-login',email:'auth-otp-email',status:'auth-login-status',
      send:mail=>online.sendLoginCode(mail),remember}),
    validate:async(_v,api)=>{
      const mail=read(api,'auth-otp-email').trim(),code=read(api,'auth-otp-code').trim();
      if(!emailOk(mail)){api.setError('Ingresá un correo electrónico válido.');return false;}
      if(!codeOk(code)){api.setError('Ingresá el código numérico recibido por correo.');return false;}
      api.setError('');api.busy(true,'Verificando…');
      try{
        await online.signInWithCode(mail,code);
        remember(mail);
        if(notify)w.sahtenToast('Sesión iniciada en '+name);
        return true;
      }catch(e){api.busy(false);api.setError(e.message||'El código es incorrecto o venció.');return false;}
    }
  });
}

export async function showPasswordRecovery({online,w,email='',remember=()=>{}}) {
  const body='<p class="sd-text">Recuperá tu acceso con un código enviado al correo de tu cuenta. No necesitás la contraseña anterior.</p>'+
    field('auth-reset-email','Correo electrónico',{type:'email',ac:'username',value:email,extra:'autofocus'})+
    '<div class="sd-row"><button type="button" class="sd-linkbtn" data-sd="auth-send-reset">Enviar código de recuperación</button></div>'+
    '<p class="sd-text sd-mute" role="status" aria-live="polite" data-sd="auth-reset-status"></p>'+
    field('auth-reset-code','Código recibido',{ac:'one-time-code',extra:'inputmode="numeric" maxlength="10" placeholder="Código de 6 dígitos"'})+
    field('auth-reset-password','Nueva contraseña',{type:'password',ac:'new-password',extra:'minlength="8"'})+
    field('auth-reset-confirm','Repetir contraseña',{type:'password',ac:'new-password',extra:'minlength="8"'})+
    '<p class="sd-mute sd-small">La nueva contraseña debe tener al menos 8 caracteres.</p>';
  return sahtenDialog({
    title:'Recuperar contraseña',body,w,width:430,
    actions:[{label:'Cancelar',value:false},{label:'Cambiar contraseña',value:true,primary:true}],
    onOpen:api=>installSender(api,{button:'auth-send-reset',email:'auth-reset-email',status:'auth-reset-status',
      send:mail=>online.requestPasswordReset(mail),remember}),
    validate:async(_v,api)=>{
      const mail=read(api,'auth-reset-email').trim(),code=read(api,'auth-reset-code').trim(),
        password=read(api,'auth-reset-password'),confirm=read(api,'auth-reset-confirm');
      if(!emailOk(mail)){api.setError('Ingresá un correo electrónico válido.');return false;}
      if(!codeOk(code)){api.setError('Ingresá el código numérico recibido por correo.');return false;}
      if(password.length<8){api.setError('Elegí una contraseña de al menos 8 caracteres.');return false;}
      if(password!==confirm){api.setError('Las contraseñas no coinciden.');return false;}
      api.setError('');api.busy(true,'Actualizando…');
      try {
        await online.resetPassword(mail,code,password);
        remember(mail);
        w.sahtenToast('Contraseña actualizada. Iniciá sesión con la nueva contraseña.');
        return true;
      } catch(e) {api.busy(false);api.setError(e.message||'No se pudo recuperar la contraseña.');return false;}
    }
  });
}
