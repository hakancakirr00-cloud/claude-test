(function (global) {
  'use strict';

  let state = { matches: [], filter: {} };

  async function render(root) {
    const tpl = document.getElementById('tpl-list');
    root.appendChild(tpl.content.cloneNode(true));

    state.matches = await DB.getAll();
    fillLeagueFilter();
    bindEvents();
    redraw();
  }

  function fillLeagueFilter() {
    const sel = document.getElementById('filterLeague');
    Util.clearChildren(sel);
    sel.appendChild(option('', '(hepsi)'));
    for (const lg of Stats.leagues(state.matches)) sel.appendChild(option(lg, lg));
  }

  function option(value, label) {
    const o = document.createElement('option');
    o.value = value; o.textContent = label;
    return o;
  }

  function bindEvents() {
    const ids = ['filterLeague', 'filterIy05', 'filterKarma', 'filterMarket', 'filterText'];
    ids.forEach((id) => document.getElementById(id).addEventListener('input', redraw));

    document.getElementById('exportBtn').addEventListener('click', async () => {
      const json = await DB.exportJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bahis-analiz-${Util.todayIso()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('importInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const replace = confirm('Mevcut tüm verileri silip içeri aktarayım mı?\n\nİPTAL: birleştir (eklenir/günceller)\nTAMAM: değiştir (önce tümünü siler)');
        const n = await DB.importJson(text, { replace });
        Util.toast(n + ' kayıt içeri alındı', 'success');
        state.matches = await DB.getAll();
        fillLeagueFilter();
        redraw();
        global.App && global.App.notifyDataChange && global.App.notifyDataChange();
      } catch (err) {
        Util.toast('Import hata: ' + err.message, 'error');
      }
      e.target.value = '';
    });

    document.getElementById('clearAllBtn').addEventListener('click', async () => {
      if (!confirm('TÜM kayıtlar silinecek. Emin misin?')) return;
      await DB.clearAll();
      state.matches = [];
      redraw();
      global.App && global.App.notifyDataChange && global.App.notifyDataChange();
    });
  }

  function applyFilters() {
    const f = {
      league: document.getElementById('filterLeague').value,
      iy: document.getElementById('filterIy05').value,
      karma: document.getElementById('filterKarma').value,
      market: document.getElementById('filterMarket').value,
      text: document.getElementById('filterText').value.trim().toLowerCase()
    };
    return state.matches.filter((m) => {
      if (f.league && m.league !== f.league) return false;
      if (f.iy && m.iy05Bucket !== f.iy) return false;
      if (f.karma && m.karmaBucket !== f.karma) return false;
      if (f.market === 'iy05Hit' && !m.iy05Hit) return false;
      if (f.market === 'iy05Miss' && m.iy05Hit) return false;
      if (f.market === 'ms15Hit' && !m.ms15Hit) return false;
      if (f.market === 'ms15Miss' && m.ms15Hit) return false;
      if (f.text) {
        const hay = (m.league + ' ' + m.homeTeam + ' ' + m.awayTeam).toLowerCase();
        if (!hay.includes(f.text)) return false;
      }
      return true;
    });
  }

  function redraw() {
    const filtered = applyFilters().sort((a, b) => (b.matchDate || '').localeCompare(a.matchDate || ''));
    const tbody = document.getElementById('matchRows');
    Util.clearChildren(tbody);
    document.getElementById('listCount').textContent = `${filtered.length} / ${state.matches.length} maç`;
    for (const m of filtered) tbody.appendChild(rowFor(m));
  }

  function rowFor(m) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${Util.fmtDate(m.matchDate)}</td>
      <td>${esc(m.league)}</td>
      <td>${esc(m.homeTeam)} - ${esc(m.awayTeam)}</td>
      <td>${m.iy05Percent}</td>
      <td>${m.karmaPercent}</td>
      <td>${fmtScore(m.htHome, m.htAway)}</td>
      <td>${fmtScore(m.ftHome, m.ftAway, m.finalScore)}</td>
      <td class="${m.iy05Hit ? 'hit' : 'miss'}">${m.iy05Hit ? '✓' : '✗'}</td>
      <td class="${m.ms15Hit ? 'hit' : 'miss'}">${m.ms15Hit ? '✓' : '✗'}</td>
      <td>
        <button data-action="edit">Düzenle</button>
        <button data-action="del" class="danger">Sil</button>
      </td>
    `;
    tr.querySelector('[data-action="del"]').addEventListener('click', async () => {
      if (!confirm('Bu maç silinsin mi?')) return;
      await DB.remove(m.id);
      state.matches = state.matches.filter((x) => x.id !== m.id);
      redraw();
      global.App && global.App.notifyDataChange && global.App.notifyDataChange();
    });
    tr.querySelector('[data-action="edit"]').addEventListener('click', () => beginEdit(tr, m));
    return tr;
  }

  function beginEdit(tr, m) {
    const tpl = document.getElementById('tpl-edit-row');
    const editTr = tpl.content.cloneNode(true).querySelector('tr');
    editTr.querySelector('[name=matchDate]').value = Util.fmtDate(m.matchDate);
    editTr.querySelector('[name=league]').value = m.league;
    editTr.querySelector('[name=homeTeam]').value = m.homeTeam;
    editTr.querySelector('[name=awayTeam]').value = m.awayTeam;
    editTr.querySelector('[name=iy05Percent]').value = m.iy05Percent;
    editTr.querySelector('[name=karmaPercent]').value = m.karmaPercent;
    editTr.querySelector('[name=htHome]').value = m.htHome;
    editTr.querySelector('[name=htAway]').value = m.htAway;
    editTr.querySelector('[name=ftHome]').value = m.ftHome;
    editTr.querySelector('[name=ftAway]').value = m.ftAway;

    editTr.querySelector('[data-action=cancel]').addEventListener('click', () => tr.replaceWith(rowFor(m)));
    editTr.querySelector('[data-action=save]').addEventListener('click', async () => {
      const data = { id: m.id, createdAt: m.createdAt };
      editTr.querySelectorAll('input').forEach((i) => { data[i.name] = i.value; });
      try {
        const saved = await DB.put(data);
        const idx = state.matches.findIndex((x) => x.id === m.id);
        if (idx >= 0) state.matches[idx] = saved;
        redraw();
        global.App && global.App.notifyDataChange && global.App.notifyDataChange();
        Util.toast('Güncellendi', 'success');
      } catch (err) {
        Util.toast('Hata: ' + err.message, 'error');
      }
    });
    tr.replaceWith(editTr);
  }

  function fmtScore(h, a, fallback) {
    if (h === '' || h == null || a === '' || a == null) {
      return fallback ? esc(fallback) : '<span class="muted">—</span>';
    }
    return `${h}-${a}`;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  global.ViewList = { render };
})(window);
