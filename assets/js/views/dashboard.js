(function (global) {
  'use strict';

  let charts = [];

  async function render(root) {
    destroyCharts();
    const tpl = document.getElementById('tpl-stats');
    root.appendChild(tpl.content.cloneNode(true));

    const matches = await DB.getAll();
    if (!matches.length) {
      document.getElementById('kpiRow').innerHTML = `<div class="kpi-card"><div class="label">Veri yok</div><div class="value">–</div><div class="sub">Önce maç ekle</div></div>`;
      return;
    }

    renderKpis(matches);
    renderLeagueChart(matches);
    renderBucketChart(matches, 'iy05', 'chartBucketIy');
    renderBucketChart(matches, 'ms15', 'chartBucketKarma');
    renderCrossTable(matches, 'iy05', 'crossTableIy');
    renderCrossTable(matches, 'ms15', 'crossTableMs');
  }

  function destroyCharts() {
    charts.forEach((c) => { try { c.destroy(); } catch (_) {} });
    charts = [];
  }

  function renderKpis(matches) {
    const ov = Stats.overall(matches);
    const row = document.getElementById('kpiRow');
    row.innerHTML = `
      ${kpi('Toplam maç', ov.total, '')}
      ${kpi('İY 0.5 üst', Util.fmtPct(ov.iy05.rate), `${ov.iy05.hits}/${ov.iy05.n}`)}
      ${kpi('MS 1.5 üst', Util.fmtPct(ov.ms15.rate), `${ov.ms15.hits}/${ov.ms15.n}`)}
      ${kpi('Lig sayısı', Stats.leagues(matches).length, '')}
    `;
  }

  function kpi(label, value, sub) {
    return `<div class="kpi-card"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;
  }

  function renderLeagueChart(matches) {
    const iy = Stats.byLeague(matches, 'iy05');
    const ms = Stats.byLeague(matches, 'ms15');
    const labels = Object.keys(iy).sort((a, b) => iy[b].n - iy[a].n);
    const ctx = document.getElementById('chartLeague').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'İY 0.5 üst %',
            data: labels.map((l) => +(iy[l].rate * 100).toFixed(1)),
            backgroundColor: '#4f8cff'
          },
          {
            label: 'MS 1.5 üst %',
            data: labels.map((l) => +((ms[l] || { rate: 0 }).rate * 100).toFixed(1)),
            backgroundColor: '#3fb950'
          }
        ]
      },
      options: chartOpts((idx) => `n=${iy[labels[idx]].n}`)
    });
    charts.push(chart);
  }

  function renderBucketChart(matches, market, canvasId) {
    const data = Stats.byBucket(matches, market);
    const labels = Util.BUCKETS.filter((b) => data[b]);
    const def = Stats.MARKETS[market];
    const ctx = document.getElementById(canvasId).getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: def.label + ' isabet %',
          data: labels.map((b) => +(data[b].rate * 100).toFixed(1)),
          backgroundColor: labels.map((b) => data[b].n < 5 ? '#586069' : '#4f8cff')
        }]
      },
      options: chartOpts((idx) => `n=${data[labels[idx]].n}` + (data[labels[idx]].n < 5 ? ' (düşük örneklem)' : ''))
    });
    charts.push(chart);
  }

  function chartOpts(footerFn) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { color: '#9aa6b2' }, grid: { color: '#2a323d' } },
        x: { ticks: { color: '#9aa6b2' }, grid: { color: '#2a323d' } }
      },
      plugins: {
        legend: { labels: { color: '#e6edf3' } },
        tooltip: {
          callbacks: { footer: (items) => footerFn(items[0].dataIndex) }
        }
      }
    };
  }

  function renderCrossTable(matches, market, tableId) {
    const cross = Stats.byLeagueAndBucket(matches, market);
    const buckets = Util.BUCKETS;
    const leagues = Object.keys(cross).sort();
    const tbl = document.getElementById(tableId);
    let html = '<thead><tr><th>Lig</th>' + buckets.map((b) => `<th>${b}</th>`).join('') + '</tr></thead><tbody>';
    for (const lg of leagues) {
      html += `<tr><td>${escapeHtml(lg)}</td>`;
      for (const b of buckets) {
        const c = cross[lg][b];
        if (!c) {
          html += '<td>–</td>';
        } else {
          const cls = c.n < 5 ? 'cell-low' : '';
          html += `<td class="${cls}">${Util.fmtPct(c.rate, 0)} <small style="color:var(--text-dim)">(${c.hits}/${c.n})</small></td>`;
        }
      }
      html += '</tr>';
    }
    html += '</tbody>';
    tbl.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  global.ViewDashboard = { render };
})(window);
