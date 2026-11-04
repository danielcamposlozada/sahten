import { pathToFileURL } from 'node:url';

export async function checkSupabaseConnectivity(env, fetchImpl = fetch) {
  const url = env.SUPABASE_URL?.trim(), key = env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error('Configuración incompleta: faltan SUPABASE_URL / SUPABASE_ANON_KEY. No se consultó Supabase.');
  let origin;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) throw new Error();
    origin = parsed.origin;
  } catch { throw new Error('SUPABASE_URL debe ser el origen HTTPS del proyecto.'); }
  let publicKey = key.startsWith('sb_publishable_');
  if (!publicKey) {
    try { publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch {}
  }
  if (!publicKey) throw new Error('El diagnóstico requiere una clave pública anon/publishable; no admite claves administrativas.');
  // limit=0 comprueba acceso a la API/tablas sin recuperar registros.
  let failure = 'No se pudo conectar con la API (red o tiempo de espera).';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchImpl(origin + '/rest/v1/stores?select=id&limit=0', {
        headers: { apikey: key, ...(key.startsWith('sb_publishable_') ? {} : { Authorization: 'Bearer ' + key }) },
        redirect: 'error', signal: AbortSignal.timeout(8000)
      });
      await response.body?.cancel();
      if (response.status === 200) return { ok: true, status: 200 };
      failure = [401, 403].includes(response.status)
        ? 'La API respondió HTTP ' + response.status + ': revisar clave pública y permisos de lectura.'
        : 'La API respondió HTTP ' + response.status + '.';
      if (response.status < 500 && response.status !== 429) break;
    } catch { /* Nunca imprimir errores de red con URL, cabeceras o respuesta. */ }
  }
  throw new Error(failure);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await checkSupabaseConnectivity(process.env);
    console.log('Supabase: HTTP 200. No se recuperaron datos operativos.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
