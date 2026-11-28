(() => {
  const id = document.currentScript?.dataset.measurementId;
  const page = document.body.dataset.editorialShell;
  if (!/^G-[A-Z0-9]+$/.test(id || '') || location.origin !== 'https://sahten.online' || !page) return;

  const storageKey = 'sahten.analytics.consent';
  const consent = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  let choice;
  try { choice = localStorage.getItem(storageKey); } catch {}
  let loaded = false;
  const tag = function () { (window.dataLayer ||= []).push(arguments); };
  const safeLocation = new URL(location.pathname, location.origin);
  const campaign = new URLSearchParams(location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const value = campaign.get(key);
    if (/^[a-zA-Z0-9_.-]{1,80}$/.test(value || '') && !/\d{7}/.test(value)) {
      safeLocation.searchParams.set(key, value);
    }
  }
  let referrer = '';
  if (document.referrer) {
    const url = new URL(document.referrer);
    referrer = url.origin === location.origin ? url.origin + url.pathname : url.origin;
  }

  function enable() {
    if (loaded) return;
    loaded = true;
    tag('consent', 'default', { ...consent, analytics_storage: 'denied' });
    tag('consent', 'update', { ...consent, analytics_storage: 'granted' });
    tag('js', new Date());
    tag('config', id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: safeLocation.href,
      page_referrer: referrer,
    });
    tag('event', 'page_view', { send_to: id });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.append(script);
  }

  function record(name, parameters) {
    if (choice === 'granted') tag('event', name, { send_to: id, ...parameters });
  }

  const placements = {
    checkout: 'order', checkout_retry: 'order', order_confirmation: 'order',
    catering: 'catering', footer: 'contact', floating: 'contact',
    header: 'contact', hero: 'contact', page: 'contact',
  };
  function whatsapp(placement) {
    if (Object.hasOwn(placements, placement)) {
      record('whatsapp_click', { placement, contact_intent: placements[placement] });
    }
  }
  function trackLink(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const destination = new URL(link.href, location.href);
    if (destination.protocol !== 'whatsapp:' &&
        !(destination.protocol === 'https:' && ['wa.me', 'api.whatsapp.com', 'web.whatsapp.com'].includes(destination.hostname))) return;
    const placement = link.dataset.whatsappPlacement ||
      (link.id === 'fab' ? 'floating' :
        link.closest('footer') ? 'footer' :
        page === 'catering' || link.closest('#s-catering') ? 'catering' :
        link.closest('header, nav') ? 'header' :
        link.closest('#s-hero') ? 'hero' : 'page');
    whatsapp(placement);
  }
  document.addEventListener('click', trackLink, true);
  document.addEventListener('auxclick', trackLink, true);
  window.sahtenAnalytics = {
    whatsapp,
    beginCheckout: () => record('begin_checkout'),
    orderReceived: () => record('order_received'),
  };

  const banner = document.createElement('section');
  banner.className = 'sahten-analytics-notice';
  banner.setAttribute('aria-label', 'Preferencias de analítica');
  banner.innerHTML = '<p>¿Nos ayudás a mejorar la web? Usamos Google Analytics para medir cómo se usa.</p>' +
    '<div><button type="button" data-choice="granted">Aceptar</button>' +
    '<button type="button" data-choice="denied">Rechazar</button></div>';
  banner.hidden = choice === 'granted' || choice === 'denied';
  const header = document.querySelector('#s-nav, header.sahten-shell');
  if (header) header.after(banner);
  else document.body.prepend(banner);
  const preferences = document.createElement('button');
  preferences.type = 'button';
  preferences.className = 'sahten-analytics-preferences';
  preferences.textContent = 'Preferencias de analítica';
  (document.querySelector('footer.sahten-footer') || document.body).append(preferences);
  let openedFromPreferences = false;
  preferences.addEventListener('click', () => {
    openedFromPreferences = true;
    banner.hidden = false;
    banner.querySelector('button').focus();
  });
  banner.addEventListener('click', event => {
    const next = event.target.dataset.choice;
    if (!next) return;
    choice = next;
    try { localStorage.setItem(storageKey, choice); } catch {}
    banner.hidden = true;
    if (openedFromPreferences) preferences.focus();
    openedFromPreferences = false;
    if (choice === 'granted') {
      window['ga-disable-' + id] = false;
      if (loaded) tag('consent', 'update', { ...consent, analytics_storage: 'granted' });
      else enable();
    } else if (loaded) {
      window['ga-disable-' + id] = true;
      tag('consent', 'update', { ...consent, analytics_storage: 'denied' });
    }
  });
  if (choice === 'granted') enable();
})();
