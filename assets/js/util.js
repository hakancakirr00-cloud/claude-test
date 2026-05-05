(function (global) {
  'use strict';

  const BUCKETS = ['<70', '70-75', '76-81', '81+'];

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

  function deriveFields(m) {
    const ht = (Number(m.htHome) || 0) + (Number(m.htAway) || 0);
    const ft = (Number(m.ftHome) || 0) + (Number(m.ftAway) || 0);
    return {
      iy05Hit: ht >= 1,
      ms15Hit: ft >= 2,
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
