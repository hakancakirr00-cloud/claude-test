(function (global) {
  'use strict';

  async function render(root) {
    const tpl = document.getElementById('tpl-report');
    root.appendChild(tpl.content.cloneNode(true));

    const matches = await DB.getAll();

    const out = document.getElementById('reportOutput');
    const dateFilter = document.getElementById('reportDateFilter');
    const copyBtn = document.getElementById('reportCopyBtn');

    function refresh() {
      const filtered = applyDateFilter(matches, dateFilter.value.trim());
      out.textContent = buildReport(filtered);
    }

    dateFilter.addEventListener('input', refresh);

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(out.textContent);
        Util.toast('Rapor kopyalandı', 'success');
      } catch (e) {
        Util.toast('Kopyalanamadı: ' + e.message, 'error');
      }
    });

    refresh();
  }

  function applyDateFilter(matches, q) {
    if (!q) return matches;
    const norm = q.replace(/\s+/g, '');
    return matches.filter((m) => {
      const d = (m.matchDate || '').replace(/-/g, '');
      const display = Util.fmtDate(m.matchDate).replace(/\./g, '');
      return d.includes(norm.replace(/[.\-]/g, '')) || display.includes(norm.replace(/[.\-]/g, ''));
    });
  }

  function buildReport(matches) {
    if (!matches.length) return 'Veri yok. Önce Veri Girişi sekmesinden maç ekle.';

    const ov = Stats.overall(matches);
    const lines = [];

    lines.push('Veri Yükleme Özeti');
    lines.push('• İşlenen Toplam Maç: ' + ov.total);
    lines.push('');
    lines.push('📊 Genel Başarı Oranları');
    lines.push('• İY 0.5 ÜST BAŞARISI: ' + pct(ov.iy05.rate) + ' (' + ov.iy05.hits + '/' + ov.iy05.n + ' Maç)');
    lines.push('• MS 1.5 ÜST BAŞARISI: ' + pct(ov.ms15.rate) + ' (' + ov.ms15.hits + '/' + ov.ms15.n + ' Maç)');

    const bothMiss = matches.filter((m) => !m.iy05Hit && !m.ms15Hit);
    if (bothMiss.length) {
      const labels = bothMiss.map((m) => (m.homeTeam || '?') + '-' + (m.awayTeam || '?')).join(', ');
      lines.push('(Not: ' + bothMiss.length + ' maçta her iki şart da sağlanamadı: ' + labels + ')');
    }

    lines.push('');
    lines.push('🏆 Lig Bazlı Detaylı Analiz');
    const iyByLg = Stats.byLeague(matches, 'iy05');
    const msByLg = Stats.byLeague(matches, 'ms15');
    const ligs = Object.keys(iyByLg).sort((a, b) => iyByLg[b].n - iyByLg[a].n || a.localeCompare(b, 'tr'));
    for (const lg of ligs) {
      const iy = iyByLg[lg];
      const ms = msByLg[lg] || { n: iy.n, hits: 0, rate: 0 };
      lines.push(lg + ' (' + iy.n + ' Maç)');
      lines.push('  • Lig İY 0.5 Başarı: ' + pct(iy.rate) + ' (' + iy.hits + '/' + iy.n + ')');
      lines.push('  • Lig MS 1.5 Başarı: ' + pct(ms.rate) + ' (' + ms.hits + '/' + ms.n + ')');
    }

    lines.push('');
    lines.push('📈 Yüzde Aralığı Bazlı (İY 0.5)');
    appendBucketBlock(lines, Stats.byBucket(matches, 'iy05'));
    lines.push('');
    lines.push('📈 Yüzde Aralığı Bazlı (MS 1.5)');
    appendBucketBlock(lines, Stats.byBucket(matches, 'ms15'));

    return lines.join('\n');
  }

  function appendBucketBlock(lines, byBucket) {
    const order = ['81+', '76-81', '70-75', '<70'];
    for (const b of order) {
      const v = byBucket[b];
      if (!v || !v.n) continue;
      lines.push('  ' + b + ': ' + pct(v.rate) + ' (' + v.hits + '/' + v.n + ')');
    }
  }

  function pct(rate) {
    return '%' + (rate * 100).toFixed(1).replace('.0', '');
  }

  global.ViewReport = { render };
})(window);
