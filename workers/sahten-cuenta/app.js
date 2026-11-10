(() => {
  'use strict';
  const AUTH = 'https://dtnbokdrxojdcvguuidk.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_LxMRld0m1DZKH2uOiBGZAQ_zsGiBQmR';
  const CALLBACK = 'https://sahten.online/cuenta/';
  const $ = id => document.getElementById(id);
  let mode = 'recovery';
  let accessToken = null;
  let busy = false;

  function message(text, kind = '') {
    $('status').textContent = text || '';
    $('status').dataset.kind = kind;
  }
  function toggleBusy(value, button) {
    busy = value;
    if (button) button.disabled = value;
  }
  function normalizedEmail() {
    const email = $('email').value.trim().toLowerCase();
    if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error('Ingresá un correo electrónico válido.');
    }
    return email;
  }
  function errorMessage(error) {
    const msg = String(error && error.message || '');
    if (/rate limit|too many|429|after \d+ seconds|security purposes/i.test(msg)) return 'Se solicitaron demasiados correos. Volvé a intentarlo más tarde.';
    if (/expired|invalid|otp|token|link|422|403|401/i.test(msg)) return 'El código o enlace venció o no es válido. Solicitá uno nuevo y no abras el enlace antes de utilizarlo.';
    if (/password|weak|short/i.test(msg)) return 'La contraseña no cumple los requisitos de seguridad. Elegí una más larga y diferente.';
    if (/fetch|network|Failed to fetch/i.test(msg)) return 'No se pudo conectar con el servidor. Revisá tu conexión.';
    return 'No se pudo completar la operación. Revisá los datos e intentá nuevamente.';
  }
  async function auth(path, body, token = null, method = 'POST') {
    const headers = {'apikey': PUBLIC_KEY, 'Content-Type':'application/json',
      'Authorization':'Bearer ' + (token || PUBLIC_KEY)};
    const res = await fetch(AUTH + path, {
      method, mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',
      headers, ...(body === undefined ? {} : {body: JSON.stringify(body)})
    });
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw new Error(data.msg || data.message || data.error_description || data.error || 'Error ' + res.status);
    return data;
  }
  function complete(title, description) {
    $('step-request').classList.add('hidden');
    $('step-verify').classList.add('hidden');
    $('password-form').classList.add('hidden');
    $('complete-title').textContent = title;
    $('complete-message').textContent = description;
    $('complete').classList.remove('hidden');
  }
  function setMode(next) {
    if (busy) return;
    mode = next;
    accessToken = null;
    $('password').value = $('confirm-password').value = $('otp').value = $('original-link').value = '';
    $('step-request').classList.remove('hidden');
    $('step-verify').classList.remove('hidden');
    $('password-form').classList.add('hidden');
    $('complete').classList.add('hidden');
    $('tab-recovery').setAttribute('aria-selected', String(mode === 'recovery'));
    $('tab-login').setAttribute('aria-selected', String(mode === 'login'));
    $('request-title').textContent = mode === 'recovery' ? '1. Pedí un correo de recuperación' : '1. Pedí un correo para entrar';
    $('request-description').textContent = mode === 'recovery'
      ? 'Te enviaremos un enlace o código al correo de tu cuenta de Sahten.'
      : 'Te enviaremos un correo de acceso rápido. Este acceso web no abre automáticamente la aplicación de escritorio.';
    $('verify-title').textContent = mode === 'recovery' ? '2. Verificá el correo' : '2. Confirmá tu correo';
    message('');
  }
  function linkToken(text, purpose) {
    let url;
    try { url = new URL(String(text || '').trim()); }
    catch { throw new Error('El enlace no tiene una dirección válida.'); }
    if (url.origin !== AUTH || url.pathname !== '/auth/v1/verify' || url.username || url.password) {
      throw new Error('Copiá únicamente el enlace original del correo de Supabase de Sahten.');
    }
    const type = url.searchParams.get('type');
    const permitted = purpose === 'recovery' ? ['recovery'] : ['email','magiclink'];
    if (!permitted.includes(type)) throw new Error('El enlace pertenece a otra operación. Solicitá uno nuevo.');
    const token = url.searchParams.get('token'), token_hash = url.searchParams.get('token_hash');
    if ((!token && !token_hash) || (token && token_hash) || String(token || token_hash).length > 2048) {
      throw new Error('El enlace no contiene un token válido.');
    }
    return token ? {type,token} : {type,token_hash};
  }
  async function acceptSession(data, purpose) {
    if (!data || !data.access_token || !data.user || !data.refresh_token) throw new Error('La validación del correo no devolvió una sesión válida.');
    if (purpose === 'recovery') {
      accessToken = data.access_token; // Solo memoria: nunca LocalStorage ni cookies.
      $('step-request').classList.add('hidden');
      $('step-verify').classList.add('hidden');
      $('password-form').classList.remove('hidden');
      $('password').focus();
      message('Correo verificado. Elegí una contraseña nueva.', 'success');
    } else {
      accessToken = null;
      complete('Correo verificado', 'El enlace confirmó el acceso en este navegador. Para trabajar en la aplicación Sahten, abrila e iniciá sesión allí con tu correo y contraseña o solicitá un código desde la propia app. La sesión de esta web no se copia a la aplicación.');
      message('');
    }
  }
  async function verifyOriginalLink(value, purpose) {
    const payload = linkToken(value, purpose);
    const data = await auth('/auth/v1/verify', payload);
    await acceptSession(data, purpose);
  }
  function tokenFromLocation() {
    // Borra cualquier token de la barra de direcciones antes de hacer peticiones.
    const query = new URLSearchParams(location.search);
    const fragment = new URLSearchParams(location.hash.replace(/^#/,''));
    const type = fragment.get('type') || query.get('type') || '';
    const callback = {
      type,
      access_token: fragment.get('access_token'),
      refresh_token: fragment.get('refresh_token'),
      token_hash: query.get('token_hash'),
      error: fragment.get('error_description') || query.get('error_description') || fragment.get('error') || query.get('error')
    };
    if (location.hash || location.search) history.replaceState(null,'',location.pathname);
    return callback;
  }
  async function loadCallback() {
    const callback = tokenFromLocation();
    if (callback.error) {
      message('El enlace fue rechazado o venció. Solicitá uno nuevo.', 'error');
      return;
    }
    if (callback.access_token) {
      const purpose = callback.type === 'recovery' ? 'recovery' : 'login';
      setMode(purpose);
      try {
        // Verificamos el token con Supabase, no confiamos en el hash recibido.
        const user = await auth('/auth/v1/user', undefined, callback.access_token, 'GET');
        await acceptSession({...callback,user},purpose);
      } catch(e) { accessToken=null; message(errorMessage(e),'error'); }
    } else if (callback.token_hash && ['recovery','magiclink','email'].includes(callback.type)) {
      const purpose = callback.type === 'recovery' ? 'recovery' : 'login';
      setMode(purpose);
      try { await acceptSession(await auth('/auth/v1/verify',{type:callback.type,token_hash:callback.token_hash}),purpose); }
      catch(e) { accessToken=null; message(errorMessage(e),'error'); }
    }
  }

  $('tab-recovery').addEventListener('click',()=>setMode('recovery'));
  $('tab-login').addEventListener('click',()=>setMode('login'));

  $('request-form').addEventListener('submit',async e=>{
    e.preventDefault(); if (busy) return;
    let email;
    try { email = normalizedEmail(); } catch(err) {message(err.message,'error');return;}
    const button=$('request-button');toggleBusy(true,button);message('Enviando correo…');
    try {
      if (mode === 'recovery') {
        await auth('/auth/v1/recover?redirect_to='+encodeURIComponent(CALLBACK),{email});
      } else {
        await auth('/auth/v1/otp?redirect_to='+encodeURIComponent(CALLBACK),{email,create_user:false});
      }
      message('Si el correo corresponde a una cuenta existente, recibirás un mensaje. Revisá también spam. Si el botón todavía abre localhost, copiá su enlace original y pegalo acá.', 'success');
    } catch(err){message(errorMessage(err),'error');}
    finally {toggleBusy(false,button);}
  });

  $('verify-form').addEventListener('submit',async e=>{
    e.preventDefault(); if (busy) return;
    const link=$('original-link').value.trim(),code=$('otp').value.trim();
    if(!link && !/^\d{6,10}$/.test(code)){message('Ingresá el código numérico o pegá el enlace original del correo.','error');return;}
    const button=$('verify-button');toggleBusy(true,button);message('Verificando…');
    try {
      if(link) await verifyOriginalLink(link,mode);
      else {
        const email=normalizedEmail();
        const data=await auth('/auth/v1/verify',{email,token:code,type:mode==='recovery'?'recovery':'email'});
        await acceptSession(data,mode);
      }
      $('original-link').value='';$('otp').value='';
    } catch(err){message(errorMessage(err),'error');}
    finally {toggleBusy(false,button);}
  });

  $('password-form').addEventListener('submit',async e=>{
    e.preventDefault(); if(busy)return;
    const password=$('password').value,confirmation=$('confirm-password').value;
    if(!accessToken){message('Primero verificá el correo para cambiar tu contraseña.','error');return;}
    if(password.length<8){message('La contraseña debe tener al menos 8 caracteres.','error');return;}
    if(password!==confirmation){message('Las contraseñas no coinciden.','error');return;}
    const button=$('password-button');toggleBusy(true,button);message('Actualizando contraseña…');
    try {
      await auth('/auth/v1/user',{password},accessToken,'PUT');
      accessToken=null;
      $('password').value=$('confirm-password').value='';
      complete('Contraseña actualizada', 'Ya podés abrir la aplicación Sahten e iniciar sesión con tu correo y la contraseña nueva. No necesitás configurar Supabase.');
      message('La contraseña se cambió correctamente.','success');
    } catch(err){message(errorMessage(err),'error');}
    finally{toggleBusy(false,button);}
  });

  loadCallback().catch(()=>message('No se pudo procesar el enlace. Solicitá un correo nuevo.','error'));
})();
