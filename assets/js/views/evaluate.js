(function (global) {
  'use strict';

  async function render(root) {
    const tpl = document.getElementById('tpl-evaluate');
    root.appendChild(tpl.content.cloneNode(true));

    await refreshLeagueList();

    const form = document.getElementById('evalForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const input = {
        league: (fd.get('league') || '').trim(),
        homeTeam: (fd.get('homeTeam') || '').trim(),
        awayTeam: (fd.get('awayTeam') || '').trim(),
        iy05Percent: Number(fd.get('iy05Percent')) || 0,
        karmaPercent: Number(fd.get('karmaPercent')) || 0
      };
      const matches = await DB.getAll();
      const result = Confidence.score(input, matches);
      drawResult(input, result);
    });
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

  function drawResult(input, result) {
    const wrap = document.getElementById('evalResult');
    Util.clearChildren(wrap);
    const grid = document.createElement('div');
    grid.className = 'eval-result';
    grid.appendChild(card('İY 0.5 üst', input.iy05Percent, result.iy05));
    grid.appendChild(card('MS 1.5 üst', input.karmaPercent, result.ms15));
    wrap.appendChild(grid);
  }

  function card(title, percent, m) {
    const el = document.createElement('div');
    el.className = 'eval-card';
    const pct = Util.fmtPct(m.score);
    el.innerHTML = `
      <h4>${title} — girdi %${percent} → kova ${m.bucket}</h4>
      <div class="score ${m.category.key}">${pct}</div>
      <div class="meta"><strong>Güven: ${m.category.label}</strong> · ${escapeHtml(m.note)}</div>
      <details>
        <summary>Detaylar</summary>
        <div class="pool-line">A (lig+aralık):  n=${m.pools.A.n}, isabet=${m.pools.A.hits}, oran=${Util.fmtPct(m.pools.A.rate)}, wilson=${Util.fmtPct(m.pools.A.wilson)} · ağırlık=${m.weights.A}</div>
        <div class="pool-line">B (lig):         n=${m.pools.B.n}, isabet=${m.pools.B.hits}, oran=${Util.fmtPct(m.pools.B.rate)}, wilson=${Util.fmtPct(m.pools.B.wilson)} · ağırlık=${m.weights.B}</div>
        <div class="pool-line">C (aralık):      n=${m.pools.C.n}, isabet=${m.pools.C.hits}, oran=${Util.fmtPct(m.pools.C.rate)}, wilson=${Util.fmtPct(m.pools.C.wilson)} · ağırlık=${m.weights.C}</div>
        ${similarTable(m.similar)}
      </details>
    `;
    return el;
  }

  function similarTable(list) {
    if (!list.length) return '<div class="meta" style="margin-top:8px;">Lig+aralıkta benzer maç yok.</div>';
    let html = '<table class="similar-table"><thead><tr><th>Tarih</th><th>Maç</th><th>İY%</th><th>Karma%</th><th>İY</th><th>MS</th><th>İY 0.5</th><th>MS 1.5</th></tr></thead><tbody>';
    for (const m of list) {
      html += `<tr>
        <td>${Util.fmtDate(m.matchDate)}</td>
        <td>${escapeHtml(m.homeTeam)} - ${escapeHtml(m.awayTeam)}</td>
        <td>${m.iy05Percent}</td><td>${m.karmaPercent}</td>
        <td>${m.htHome}-${m.htAway}</td><td>${m.ftHome}-${m.ftAway}</td>
        <td class="${m.iy05Hit ? 'hit' : 'miss'}">${m.iy05Hit ? '✓' : '✗'}</td>
        <td class="${m.ms15Hit ? 'hit' : 'miss'}">${m.ms15Hit ? '✓' : '✗'}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    return html;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  global.ViewEvaluate = { render };
})(window);
