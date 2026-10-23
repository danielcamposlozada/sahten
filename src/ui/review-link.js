export function reviewUrl(value) {
  try {
    const url = new URL(String(value).trim());
    const host = url.hostname.toLowerCase();
    const google = ['share.google', 'g.page', 'g.co', 'maps.app.goo.gl', 'google.com', 'www.google.com', 'maps.google.com', 'search.google.com', 'google.com.ar', 'www.google.com.ar'].includes(host);
    return url.protocol === 'https:' && google && !url.username && !url.password && !url.port && url.href.length <= 400 ? url.href : null;
  } catch { return null; }
}
