(function (global) {
  'use strict';

  const MARKETS = {
    iy05: { label: 'İY 0.5 üst', hitField: 'iy05Hit', percentField: 'iy05Percent', bucketField: 'iy05Bucket' },
    ms15: { label: 'MS 1.5 üst', hitField: 'ms15Hit', percentField: 'karmaPercent', bucketField: 'karmaBucket' }
  };

  function rate(hits, n) {
    if (!n) return 0;
    return hits / n;
  }

  function aggregate(matches, market) {
    const def = MARKETS[market];
    let n = 0, hits = 0;
    for (const m of matches) {
      n++;
      if (m[def.hitField]) hits++;
    }
    return { n, hits, rate: rate(hits, n) };
  }

  function groupBy(matches, keyFn) {
    const out = {};
    for (const m of matches) {
      const k = keyFn(m);
      if (!out[k]) out[k] = [];
      out[k].push(m);
    }
    return out;
  }

  function byLeague(matches, market) {
    const groups = groupBy(matches, (m) => m.league || '(belirsiz)');
    const result = {};
    for (const k in groups) result[k] = aggregate(groups[k], market);
    return result;
  }

  function byBucket(matches, market) {
    const def = MARKETS[market];
    const groups = groupBy(matches, (m) => m[def.bucketField]);
    const result = {};
    for (const k in groups) result[k] = aggregate(groups[k], market);
    return result;
  }

  function byLeagueAndBucket(matches, market) {
    const def = MARKETS[market];
    const out = {};
    for (const m of matches) {
      const lg = m.league || '(belirsiz)';
      const bk = m[def.bucketField];
      if (!out[lg]) out[lg] = {};
      if (!out[lg][bk]) out[lg][bk] = { n: 0, hits: 0, rate: 0 };
      out[lg][bk].n++;
      if (m[def.hitField]) out[lg][bk].hits++;
    }
    for (const lg in out) {
      for (const bk in out[lg]) {
        out[lg][bk].rate = rate(out[lg][bk].hits, out[lg][bk].n);
      }
    }
    return out;
  }

  function leagues(matches) {
    const set = new Set();
    for (const m of matches) if (m.league) set.add(m.league);
    return Array.from(set).sort();
  }

  function overall(matches) {
    return {
      total: matches.length,
      iy05: aggregate(matches, 'iy05'),
      ms15: aggregate(matches, 'ms15')
    };
  }

  global.Stats = { MARKETS, aggregate, byLeague, byBucket, byLeagueAndBucket, leagues, overall };
})(window);
