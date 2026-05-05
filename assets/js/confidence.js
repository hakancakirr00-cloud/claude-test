(function (global) {
  'use strict';

  // Wilson score interval lower bound (95% by default).
  // Bastırır: küçük örneklemde gözlem oranını aşağı çeker.
  function wilsonLower(hits, n, z) {
    if (!n) return 0;
    z = z || 1.96;
    const p = hits / n;
    const z2 = z * z;
    const denom = 1 + z2 / n;
    const center = p + z2 / (2 * n);
    const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
    return Math.max(0, (center - margin) / denom);
  }

  function aggregate(list, hitField) {
    let n = 0, hits = 0;
    for (const m of list) {
      n++;
      if (m[hitField]) hits++;
    }
    return { n, hits, rate: n ? hits / n : 0, wilson: wilsonLower(hits, n) };
  }

  // Determine confidence category from numeric score [0,1].
  function categorize(score, nA) {
    if (nA < 5 && score < 0.55) return { key: 'low', label: 'Düşük' };
    if (score >= 0.7) return { key: 'high', label: 'Yüksek' };
    if (score >= 0.5) return { key: 'mid', label: 'Orta' };
    return { key: 'low', label: 'Düşük' };
  }

  /**
   * Compute confidence score for a single market.
   * input: { league, percent } — percent is the relevant percentage for the market
   * matches: full list
   * market: 'iy05' | 'ms15'
   */
  function scoreMarket(input, matches, market) {
    const def = Stats.MARKETS[market];
    const bucket = Util.bucketOf(input.percent);

    const poolA = matches.filter((m) => m.league === input.league && m[def.bucketField] === bucket);
    const poolB = matches.filter((m) => m.league === input.league);
    const poolC = matches.filter((m) => m[def.bucketField] === bucket);

    const A = aggregate(poolA, def.hitField);
    const B = aggregate(poolB, def.hitField);
    const C = aggregate(poolC, def.hitField);

    let score, weights, note;
    if (A.n >= 10) {
      score = A.wilson;
      weights = { A: 1, B: 0, C: 0 };
      note = 'Lig + aralık eşleşmesi güçlü';
    } else if (A.n >= 5) {
      score = 0.6 * A.wilson + 0.3 * B.wilson + 0.1 * C.wilson;
      weights = { A: 0.6, B: 0.3, C: 0.1 };
      note = 'Lig+aralık örneklemi orta, lig ve genel aralık ile karıştırıldı';
    } else if (B.n + C.n > 0) {
      score = 0.5 * B.wilson + 0.5 * C.wilson;
      weights = { A: 0, B: 0.5, C: 0.5 };
      note = 'Lig+aralıkta yetersiz veri; lig ve aralık genelinden tahmin';
    } else {
      score = 0;
      weights = { A: 0, B: 0, C: 0 };
      note = 'Yetersiz veri';
    }

    const cat = categorize(score, A.n);

    const similar = poolA
      .slice()
      .sort((a, b) => (b.matchDate || '').localeCompare(a.matchDate || ''))
      .slice(0, 10);

    return {
      market,
      label: def.label,
      bucket,
      score,
      category: cat,
      note,
      pools: { A, B, C },
      weights,
      similar
    };
  }

  function score(input, matches) {
    return {
      iy05: scoreMarket({ league: input.league, percent: input.iy05Percent }, matches, 'iy05'),
      ms15: scoreMarket({ league: input.league, percent: input.karmaPercent }, matches, 'ms15')
    };
  }

  global.Confidence = { wilsonLower, aggregate, scoreMarket, score };
})(window);
