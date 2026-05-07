(function (global) {
  'use strict';

  // localStorage anahtarı: izleme listesi (fixture ID dizisi).
  const LS_WATCH = 'liveWatchList';
  // localStorage anahtarı: kullanıcı oran aralığı override'ı.
  const LS_RANGE = 'liveOddsRange';
  // sessionStorage anahtarı: bu sekme oturumunda tetik düşmüş ID'ler.
  const SS_FIRED = 'liveFiredIds';

  // Polling parametreleri.
  const BASE_INTERVAL_MS = 30000;
  const MAX_BACKOFF_MS = 5 * 60 * 1000;

  // Modül seviyesi state — render() arasında korunur, hashchange ile temizlenir.
  let pollTimer = null;
  let backoffMs = BASE_INTERVAL_MS;
  let connState = 'idle';

  // ---- Storage helpers ----

  function loadWatchList() {
    try {
      const raw = localStorage.getItem(LS_WATCH);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x) => Number.isInteger(x)) : [];
    } catch (e) {
      return [];
    }
  }

  function saveWatchList(ids) {
    localStorage.setItem(LS_WATCH, JSON.stringify(ids));
  }

  function loadRange() {
    try {
      const raw = localStorage.getItem(LS_RANGE);
      if (!raw) return { min: 1.45, max: 1.60 };
      const v = JSON.parse(raw);
      return {
        min: Number(v.min) || 1.45,
        max: Number(v.max) || 1.60
      };
    } catch (e) {
      return { min: 1.45, max: 1.60 };
    }
  }

  function saveRange(min, max) {
    localStorage.setItem(LS_RANGE, JSON.stringify({ min, max }));
  }

  function loadFiredSet() {
    try {
      const raw = sessionStorage.getItem(SS_FIRED);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveFiredSet(set) {
    sessionStorage.setItem(SS_FIRED, JSON.stringify(Array.from(set)));
  }

  // ---- Render helpers ----

  function setConn(state, message) {
    connState = state;
    const pill = document.getElementById('liveConn');
    if (!pill) return;
    pill.classList.remove('conn-idle', 'conn-ok', 'conn-bad', 'conn-err');
    if (state === 'connected') {
      pill.textContent = '● Bağlı';
      pill.classList.add('conn-ok');
    } else if (state === 'disconnected') {
      pill.textContent = '● Sunucu kapalı';
      pill.classList.add('conn-bad');
      pill.title = message || '';
    } else if (state === 'error') {
      pill.textContent = '● Hata';
      pill.classList.add('conn-err');
      pill.title = message || '';
    } else {
      pill.textContent = '○ Bekleniyor';
      pill.classList.add('conn-idle');
    }
  }

  function renderWatchList(ids) {
    const container = document.getElementById('liveWatchList');
    if (!container) return;
    container.innerHTML = '';
    if (!ids.length) {
      container.innerHTML = '<span class="hint">Henüz izlenen maç yok.</span>';
      return;
    }
    ids.forEach((id) => {
      const chip = document.createElement('span');
      chip.className = 'watch-chip';
      chip.innerHTML = `<span>${id}</span><button type="button" data-id="${id}" title="Sil">×</button>`;
      container.appendChild(chip);
    });
    container.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const removeId = Number(btn.dataset.id);
        const next = loadWatchList().filter((x) => x !== removeId);
        saveWatchList(next);
        renderWatchList(next);
        fetchAndRender();
      });
    });
  }

  function statusLabel(short) {
    const map = {
      '1H': '1. Yarı', 'HT': 'Devre',
      '2H': '2. Yarı', 'ET': 'Uzatma',
      'P': 'Penaltılar', 'FT': 'Bitti',
      'AET': 'Bitti (uzatma)', 'PEN': 'Bitti (penaltı)',
      'BT': 'Devre', 'PST': 'Ertelendi',
      'CANC': 'İptal', 'ABD': 'Tatil',
      'SUSP': 'Askıda', 'INT': 'Yarıda',
      'NS': 'Başlamadı'
    };
    return map[short] || short || '?';
  }

  function renderRows(fixtures) {
    const tbody = document.getElementById('liveRows');
    const empty = document.getElementById('liveEmpty');
    if (!tbody) return;

    tbody.innerHTML = '';
    const watch = loadWatchList();
    const fired = loadFiredSet();

    if (!watch.length) {
      empty.textContent = 'Üst formdan en az bir fixture ID ekleyin.';
      return;
    }

    if (!fixtures.length) {
      empty.textContent = 'İzlenen maçlar arasında şu an canlı oynayan yok.';
      return;
    }

    empty.textContent = '';

    fixtures.forEach((fx) => {
      const tr = document.createElement('tr');
      const triggered = !!fx.trigger;
      if (triggered) {
        tr.classList.add('trigger-row');
        fired.add(fx.id);
      } else if (fired.has(fx.id)) {
        // Tetik bir kez düşmüş, bu turda oran/skor değişmiş olabilir;
        // yine de kullanıcıyı uyarmak için soluk bir vurgu bırakıyoruz.
        tr.classList.add('trigger-row-faded');
      }

      const elapsed = fx.elapsed != null ? fx.elapsed + "'" : '—';
      const score = `${fx.score.home ?? 0}-${fx.score.away ?? 0}`;
      const triggerCell = triggered
        ? `⚠️ <strong>${fx.trigger.market}</strong> @ ${fx.trigger.odd.toFixed(2)} <span class="hint">(${fx.trigger.bookmaker})</span>`
        : '<span class="hint">—</span>';

      tr.innerHTML = `
        <td>${fx.home} <span class="hint">vs</span> ${fx.away}</td>
        <td>${fx.league || ''}</td>
        <td>${elapsed}</td>
        <td>${score}</td>
        <td><span class="status-pill status-${(fx.status || '').toLowerCase()}">${statusLabel(fx.status)}</span></td>
        <td>${triggerCell}</td>
        <td><button type="button" class="ghost" data-remove="${fx.id}">Sil</button></td>
      `;
      tbody.appendChild(tr);
    });

    saveFiredSet(fired);

    tbody.querySelectorAll('button[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const removeId = Number(btn.dataset.remove);
        const next = loadWatchList().filter((x) => x !== removeId);
        saveWatchList(next);
        renderWatchList(next);
        fetchAndRender();
      });
    });
  }

  // ---- Polling ----

  async function fetchAndRender() {
    const ids = loadWatchList();
    if (!ids.length) {
      renderRows([]);
      setConn('idle');
      return;
    }

    const range = loadRange();
    const url = `/api/live?ids=${ids.join(',')}&withOdds=true`
      + `&oddsMin=${range.min}&oddsMax=${range.max}&minElapsed=10`;

    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        setConn('error', `HTTP ${res.status}: ${body.slice(0, 200)}`);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setConn('error', data.error);
        return;
      }
      backoffMs = BASE_INTERVAL_MS;
      setConn('connected');
      renderRows(data.fixtures || []);
    } catch (e) {
      // Network hatası — sunucu büyük ihtimalle kapalı.
      setConn('disconnected', e.message);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    }
  }

  function scheduleNext() {
    if (pollTimer) clearTimeout(pollTimer);
    const delay = connState === 'disconnected' || connState === 'error'
      ? backoffMs
      : BASE_INTERVAL_MS;
    pollTimer = setTimeout(async () => {
      await fetchAndRender();
      scheduleNext();
    }, delay);
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  // Sekme değişince timer'ı temizle (modül-seviyesi tek kez bağlanır).
  let hashListenerBound = false;
  function bindHashListener() {
    if (hashListenerBound) return;
    hashListenerBound = true;
    window.addEventListener('hashchange', () => {
      if (!location.hash.startsWith('#/live')) {
        stopPolling();
      }
    });
  }

  // ---- Render entry point ----

  async function render(root) {
    bindHashListener();
    stopPolling(); // Önceki render'dan kalan timer varsa öldür.

    const tpl = document.getElementById('tpl-live');
    root.appendChild(tpl.content.cloneNode(true));

    // Aralık input'larını mevcut değerlerle doldur.
    const range = loadRange();
    document.getElementById('liveOddsMin').value = range.min;
    document.getElementById('liveOddsMax').value = range.max;

    // Watch list ekleme formu.
    document.getElementById('liveAddForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('liveFixtureId');
      const id = Number(input.value);
      if (!Number.isInteger(id) || id <= 0) return;
      const current = loadWatchList();
      if (current.includes(id)) {
        input.value = '';
        return;
      }
      current.push(id);
      saveWatchList(current);
      renderWatchList(current);
      input.value = '';
      fetchAndRender();
    });

    // Manuel yenile butonu.
    document.getElementById('liveRefreshBtn').addEventListener('click', () => {
      backoffMs = BASE_INTERVAL_MS;
      fetchAndRender();
    });

    // Oran aralığı değişimi.
    const onRangeChange = () => {
      const min = Number(document.getElementById('liveOddsMin').value) || 1.45;
      const max = Number(document.getElementById('liveOddsMax').value) || 1.60;
      saveRange(min, max);
    };
    document.getElementById('liveOddsMin').addEventListener('change', onRangeChange);
    document.getElementById('liveOddsMax').addEventListener('change', onRangeChange);

    renderWatchList(loadWatchList());
    setConn('idle');
    await fetchAndRender();
    scheduleNext();
  }

  global.ViewLive = { render };
})(window);
