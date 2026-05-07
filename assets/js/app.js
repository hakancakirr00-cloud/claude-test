(function (global) {
  'use strict';

  const ROUTES = {
    entry: ViewEntry.render,
    list: ViewList.render,
    stats: ViewDashboard.render,
    report: ViewReport.render,
    evaluate: ViewEvaluate.render,
    live: ViewLive.render
  };

  function currentRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    return ROUTES[h] ? h : 'entry';
  }

  async function navigate() {
    const route = currentRoute();
    document.querySelectorAll('.tabs a').forEach((a) => {
      a.classList.toggle('active', a.dataset.route === route);
    });
    const view = document.getElementById('view');
    Util.clearChildren(view);
    try {
      await ROUTES[route](view);
    } catch (err) {
      view.innerHTML = `<div class="kpi-card"><div class="label">Hata</div><div class="value">!</div><div class="sub">${err.message}</div></div>`;
      console.error(err);
    }
  }

  async function refreshTopKpi() {
    try {
      const matches = await DB.getAll();
      const ov = Stats.overall(matches);
      document.getElementById('topKpi').textContent =
        `${ov.total} maç · İY 0.5: ${Util.fmtPct(ov.iy05.rate)} · MS 1.5: ${Util.fmtPct(ov.ms15.rate)}`;
    } catch (e) {
      document.getElementById('topKpi').textContent = '';
    }
  }

  function notifyDataChange() {
    refreshTopKpi();
  }

  // ---- Self-test (sanity checks for stats + confidence) ----
  function selfTest() {
    const sample = (n, hit) => Array.from({ length: n }, (_, i) => DB.normalize({
      id: 'st-' + i + '-' + Math.random(),
      league: 'TestLig',
      iy05Percent: 80, karmaPercent: 80,
      htHome: hit ? 1 : 0, htAway: 0,
      ftHome: hit ? 2 : 0, ftAway: 0
    }));

    const allHit = sample(20, true);
    const ov = Stats.overall(allHit);
    console.assert(ov.iy05.rate === 1, '20 hit → rate 1');
    const wilson = Confidence.wilsonLower(20, 20);
    console.assert(wilson > 0.8 && wilson < 1, 'wilson lower 20/20 should be < 1');

    const empty = Confidence.score({ league: 'X', iy05Percent: 80, karmaPercent: 80 }, []);
    console.assert(empty.iy05.score === 0, 'empty → 0');

    const mixed = sample(50, true).concat(sample(50, false));
    const r = Confidence.score({ league: 'TestLig', iy05Percent: 80, karmaPercent: 80 }, mixed);
    console.assert(r.iy05.pools.A.n === 100, 'A pool should be 100');
    console.assert(r.iy05.score < 0.55 && r.iy05.score > 0.4, 'wilson on 50/100 ~ 0.4-0.55');

    console.log('[selfTest] OK');
    return true;
  }

  // ---- Boot ----
  window.addEventListener('hashchange', navigate);
  window.addEventListener('DOMContentLoaded', () => {
    if (!location.hash) location.hash = '#/entry';
    navigate();
    refreshTopKpi();
  });

  global.App = { navigate, notifyDataChange, selfTest };
  global.__selfTest = selfTest;
})(window);
