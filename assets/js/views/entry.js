(function (global) {
  'use strict';

  function render(root) {
    const tpl = document.getElementById('tpl-entry');
    root.appendChild(tpl.content.cloneNode(true));

    refreshLeagueList();

    const today = Util.todayIso();
    const dateInput = document.querySelector('#manualForm input[name="matchDate"]');
    if (dateInput && !dateInput.value) dateInput.value = today;

    document.getElementById('manualForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      try {
        await DB.put(data);
        Util.toast('Kaydedildi', 'success');
        e.target.reset();
        const di = document.querySelector('#manualForm input[name="matchDate"]');
        if (di) di.value = Util.todayIso();
        refreshLeagueList();
        global.App && global.App.notifyDataChange && global.App.notifyDataChange();
      } catch (err) {
        Util.toast('Hata: ' + err.message, 'error');
      }
    });

    document.getElementById('jsonAddBtn').addEventListener('click', onJsonAdd);
    document.getElementById('jsonClearBtn').addEventListener('click', () => {
      document.getElementById('jsonPaste').value = '';
      document.getElementById('jsonHint').textContent = '';
    });
  }

  async function onJsonAdd() {
    const ta = document.getElementById('jsonPaste');
    const hint = document.getElementById('jsonHint');
    const text = (ta.value || '').trim();
    if (!text) {
      hint.textContent = 'Önce JSON yapıştır.';
      return;
    }
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (err) {
      hint.textContent = 'Geçersiz JSON: ' + err.message;
      hint.style.color = 'var(--bad)';
      return;
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    let ok = 0, fail = 0;
    const errs = [];
    for (const raw of list) {
      try {
        await DB.put(raw);
        ok++;
      } catch (err) {
        fail++;
        errs.push(err.message);
      }
    }
    hint.style.color = fail ? 'var(--bad)' : 'var(--ok)';
    hint.textContent = ok + ' eklendi' + (fail ? ', ' + fail + ' hata: ' + errs[0] : '');
    if (ok) {
      Util.toast(ok + ' maç eklendi', 'success');
      ta.value = '';
      refreshLeagueList();
      global.App && global.App.notifyDataChange && global.App.notifyDataChange();
    }
  }

  async function refreshLeagueList() {
    const dl = document.getElementById('leagueList');
    if (!dl) return;
    Util.clearChildren(dl);
    const matches = await DB.getAll();
    const set = new Set(Util.KNOWN_LEAGUES);
    for (const m of matches) if (m.league) set.add(m.league);
    for (const lg of Array.from(set).sort()) {
      const o = document.createElement('option');
      o.value = lg;
      dl.appendChild(o);
    }
  }

  global.ViewEntry = { render };
})(window);
