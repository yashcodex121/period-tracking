// Chakra Service Worker — v4
// Handles: offline cache, scheduled background notifications (via periodicsync / SW alarm trick)

const CACHE = 'chakra-v4';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch (offline-first for app shell) ────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request))
  );
});

// ─── Message from page ──────────────────────────────────────────────────────
// Page sends: { type: 'SCHEDULE', reminders: [...], predictions: {...} }
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE') {
    storeSchedule(e.data);
  }
  if (e.data && e.data.type === 'TEST_NOTIF') {
    showNotif('Chakra Test 🔔', 'Notifications sahi kaam kar rahi hain!', 'test');
  }
});

// ─── Periodic Background Sync ────────────────────────────────────────────────
// Fires when browser allows background sync (Android Chrome / Edge)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'chakra-check') {
    e.waitUntil(checkAndNotify());
  }
});

// ─── Push (if server-side push is ever added) ────────────────────────────────
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : { title: 'Chakra', body: 'Reminder' };
  e.waitUntil(showNotif(d.title, d.body, d.tag || 'push'));
});

// ─── Notification click ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const c = clients.find(c => c.url.includes('index.html') || c.url.endsWith('/'));
      if (c) return c.focus();
      return self.clients.openWindow('./index.html');
    })
  );
});

// ─── Core helpers ────────────────────────────────────────────────────────────
async function showNotif(title, body, tag) {
  const opts = {
    body,
    tag,
    icon: './icon-192.png',
    badge: './icon-192.png',
    renotify: true,
    requireInteraction: false,
    vibrate: [300, 150, 300],
    data: { url: './index.html' }
  };
  return self.registration.showNotification(title, opts);
}

async function storeSchedule(data) {
  // Persist schedule in Cache Storage as a JSON "file"
  const cache = await caches.open(CACHE);
  const blob = new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  await cache.put('/chakra-schedule', blob);
}

async function loadSchedule() {
  try {
    const cache = await caches.open(CACHE);
    const r = await cache.match('/chakra-schedule');
    if (!r) return null;
    return r.json();
  } catch { return null; }
}

async function checkAndNotify() {
  const data = await loadSchedule();
  if (!data) return;

  const { reminders = [], predictions = {} } = data;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  // Load fired map from cache
  const cache = await caches.open(CACHE);
  let fired = {};
  try {
    const fr = await cache.match('/chakra-fired');
    if (fr) fired = await fr.json();
  } catch { /* ignore */ }

  let changed = false;

  for (const r of reminders) {
    if (!r.on) continue;
    // Only fire within ±2 min window
    if (hm < r.time) continue;
    const [rh, rm] = r.time.split(':').map(Number);
    const diffMin = (now.getHours() * 60 + now.getMinutes()) - (rh * 60 + rm);
    if (diffMin > 2) continue;

    if (r.type === 'daily') {
      const key = r.id + '_' + todayStr;
      if (!fired[key]) {
        fired[key] = true; changed = true;
        await showNotif(r.label, 'Yaad dilane ke liye 🔔', r.id);
      }
    } else if (r.type === 'period' && predictions.nextPeriod) {
      const daysLeft = dayDiff(predictions.nextPeriod, todayStr);
      if (daysLeft === +r.lead) {
        const key = r.id + '_' + predictions.nextPeriod;
        if (!fired[key]) {
          fired[key] = true; changed = true;
          await showNotif(r.label, `Period ${r.lead} din mein expected hai (${predictions.nextPeriod})`, r.id);
        }
      }
    } else if (r.type === 'fert' && predictions.fertileStart) {
      const daysLeft = dayDiff(predictions.fertileStart, todayStr);
      if (daysLeft === +r.lead) {
        const key = r.id + '_' + predictions.fertileStart;
        if (!fired[key]) {
          fired[key] = true; changed = true;
          await showNotif(r.label, 'Fertile window shuru hone wali hai 🌿', r.id);
        }
      }
    }
  }

  if (changed) {
    const blob = new Response(JSON.stringify(fired), { headers: { 'Content-Type': 'application/json' } });
    await cache.put('/chakra-fired', blob);
  }
}

function dayDiff(a, b) {
  // Returns a - b in days
  return Math.round((new Date(a) - new Date(b)) / 86400000);
}
