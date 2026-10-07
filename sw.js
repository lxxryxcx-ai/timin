// Service worker сайта: повторный заход открывается мгновенно из кэша и работает без интернета.
// Страница: сразу из кэша, если она там есть, а свежая версия тихо подтягивается в фоне на следующий раз.
// Фото и шрифты: из кэша, иначе из сети с сохранением. Новая сборка меняет VERSION — старый кэш удаляется.
const VERSION = 'timin-f5b57f7633';
const CORE = ["./", "img/favicon.svg", "fonts/Jost-400.woff2", "fonts/Jost-500.woff2", "fonts/Playfair-400.woff2", "fonts/Playfair-italic-400.woff2"];
const PAGE = new URL('./', self.registration.scope).href;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// страница сообщает, что уже загрузила до появления service worker (фото первого экрана): кладём это в кэш
self.addEventListener('message', e => {
  const urls = (e.data && e.data.cache || []).filter(u => u.startsWith(self.registration.scope));
  if (urls.length) e.waitUntil(caches.open(VERSION).then(c => Promise.all(urls.map(u =>
    c.match(u).then(hit => hit || fetch(u).then(r => r.ok && c.put(u, r)).catch(() => {}))))));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== location.origin) return;
  // главная страница — из кэша; другие страницы на том же адресе (разбор, предложение) идут в сеть как обычно:
  // раньше на любой переход отдавалась главная, а чужая страница ещё и записывалась в кэш вместо неё
  if (r.mode === 'navigate' && (url.href.split(/[?#]/)[0] === PAGE || url.pathname === new URL('index.html', PAGE).pathname)) {
    const fresh = fetch(r).then(res => {
      if (res.ok) caches.open(VERSION).then(c => c.put(PAGE, res.clone()));
      return res;
    });
    e.waitUntil(fresh.catch(() => {}));
    e.respondWith(caches.match(PAGE).then(hit => hit || fresh));
    return;
  }
  if (/\/(img|fonts)\//.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(c => c.match(r).then(hit => hit || fetch(r).then(res => {
      if (res.ok) c.put(r, res.clone());
      return res;
    }))));
  }
});
