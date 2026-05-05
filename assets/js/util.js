(function (global) {
  'use strict';

  const BUCKETS = ['<70', '70-75', '76-81', '81+'];

  const KNOWN_LEAGUES = [
    'Süper Lig', 'TFF 1. Lig', 'Premier League', 'La Liga', 'Serie A',
    'Bundesliga', 'Ligue 1', 'Eredivisie', 'Primeira Liga', 'Championship',
    'Champions League', 'Europa League', 'MLS',
    'Brasileirao', 'Argentina Primera', 'Saudi Pro League'
  ];

  function bucketOf(percent) {
    const p = Number(percent);
    if (!isFinite(p)) return '<70';
    if (p >= 81) return '81+';
    if (p >= 76) return '76-81';
    if (p >= 70) return '70-75';
    return '<70';
  }

  function marketHit(match, market) {
    if (market === 'iy05') return !!match.iy05Hit;
    if (market === 'ms15') return !!match.ms15Hit;
    return false;
  }

  function hasHt(m) {
    return m.htHome !== '' && m.htHome != null && m.htAway !== '' && m.htAway != null;
  }
  function hasFt(m) {
    return m.ftHome !== '' && m.ftHome != null && m.ftAway !== '' && m.ftAway != null;
  }

  function deriveFields(m) {
    const ht = (Number(m.htHome) || 0) + (Number(m.htAway) || 0);
    const ft = (Number(m.ftHome) || 0) + (Number(m.ftAway) || 0);
    const iy05 = hasHt(m) ? (ht >= 1) : (typeof m.iy05Hit === 'boolean' ? m.iy05Hit : false);
    const ms15 = hasFt(m) ? (ft >= 2) : (typeof m.ms15Hit === 'boolean' ? m.ms15Hit : false);
    return {
      iy05Hit: iy05,
      ms15Hit: ms15,
      iy05Bucket: bucketOf(m.iy05Percent),
      karmaBucket: bucketOf(m.karmaPercent)
    };
  }

  function fmtPct(x, digits) {
    if (x == null || !isFinite(x)) return '–';
    return (x * 100).toFixed(digits == null ? 1 : digits) + '%';
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 10);
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function uuid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  global.Util = {
    BUCKETS,
    KNOWN_LEAGUES,
    bucketOf,
    marketHit,
    deriveFields,
    fmtPct,
    fmtDate,
    todayIso,
    uuid,
    toast,
    clearChildren
  };
})(window);
