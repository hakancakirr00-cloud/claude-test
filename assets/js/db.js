(function (global) {
  'use strict';

  const DB_NAME = 'bahis-analiz';
  const DB_VERSION = 1;
  const STORE_MATCHES = 'matches';
  const STORE_META = 'meta';

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_MATCHES)) {
          const store = db.createObjectStore(STORE_MATCHES, { keyPath: 'id' });
          store.createIndex('league', 'league', { unique: false });
          store.createIndex('iy05Bucket', 'iy05Bucket', { unique: false });
          store.createIndex('karmaBucket', 'karmaBucket', { unique: false });
          store.createIndex('matchDate', 'matchDate', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return open().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  function reqAsPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll() {
    const store = await tx(STORE_MATCHES, 'readonly');
    return reqAsPromise(store.getAll());
  }

  async function get(id) {
    const store = await tx(STORE_MATCHES, 'readonly');
    return reqAsPromise(store.get(id));
  }

  function normalize(input) {
    const m = Object.assign({}, input);
    if (!m.id) m.id = Util.uuid();
    if (!m.createdAt) m.createdAt = new Date().toISOString();
    if (!m.matchDate) m.matchDate = Util.todayIso();
    m.iy05Percent = Number(m.iy05Percent) || 0;
    m.karmaPercent = Number(m.karmaPercent) || 0;
    m.htHome = Number(m.htHome) || 0;
    m.htAway = Number(m.htAway) || 0;
    m.ftHome = Number(m.ftHome) || 0;
    m.ftAway = Number(m.ftAway) || 0;
    m.league = (m.league || '').trim();
    m.homeTeam = (m.homeTeam || '').trim();
    m.awayTeam = (m.awayTeam || '').trim();
    m.rawOcrText = m.rawOcrText || '';
    Object.assign(m, Util.deriveFields(m));
    return m;
  }

  async function put(match) {
    const m = normalize(match);
    const store = await tx(STORE_MATCHES, 'readwrite');
    await reqAsPromise(store.put(m));
    return m;
  }

  async function remove(id) {
    const store = await tx(STORE_MATCHES, 'readwrite');
    return reqAsPromise(store.delete(id));
  }

  async function clearAll() {
    const store = await tx(STORE_MATCHES, 'readwrite');
    return reqAsPromise(store.clear());
  }

  async function metaGet(key) {
    const store = await tx(STORE_META, 'readonly');
    const r = await reqAsPromise(store.get(key));
    return r ? r.value : null;
  }

  async function metaPut(key, value) {
    const store = await tx(STORE_META, 'readwrite');
    return reqAsPromise(store.put({ key, value }));
  }

  async function exportJson() {
    const matches = await getAll();
    return JSON.stringify({
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      matches
    }, null, 2);
  }

  async function importJson(jsonText, opts) {
    const replace = opts && opts.replace;
    let parsed;
    try { parsed = JSON.parse(jsonText); }
    catch (e) { throw new Error('Geçersiz JSON: ' + e.message); }
    const list = Array.isArray(parsed) ? parsed : parsed.matches;
    if (!Array.isArray(list)) throw new Error('Beklenen alan: matches[]');
    const db = await open();
    const t = db.transaction(STORE_MATCHES, 'readwrite');
    const store = t.objectStore(STORE_MATCHES);
    if (replace) await reqAsPromise(store.clear());
    let count = 0;
    for (const raw of list) {
      const m = normalize(raw);
      await reqAsPromise(store.put(m));
      count++;
    }
    await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
    return count;
  }

  global.DB = { open, getAll, get, put, remove, clearAll, metaGet, metaPut, exportJson, importJson, normalize };
})(window);
