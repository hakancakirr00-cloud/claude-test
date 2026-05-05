(function (global) {
  'use strict';

  // Bilinen ligler — kullanıcı veri eklerken sözlük büyür.
  // İlk yüklemede sık kullanılan birkaç ligi içerir.
  const KNOWN_LEAGUES = [
    'Süper Lig', 'TFF 1. Lig', 'Premier League', 'La Liga', 'Serie A',
    'Bundesliga', 'Ligue 1', 'Eredivisie', 'Primeira Liga', 'Championship',
    'Süper Lig (Türkiye)', 'Champions League', 'Europa League', 'MLS',
    'Brasileirao', 'Argentina Primera', 'Saudi Pro League'
  ];

  function levenshtein(a, b) {
    a = (a || '').toLowerCase();
    b = (b || '').toLowerCase();
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const v = new Array(n + 1);
    for (let j = 0; j <= n; j++) v[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = i - 1, cur = i;
      for (let j = 1; j <= n; j++) {
        const tmp = v[j];
        v[j] = Math.min(
          v[j] + 1,
          cur + 1,
          prev + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1)
        );
        prev = tmp;
        cur = v[j];
      }
    }
    return v[n];
  }

  function fuzzyLeague(text, dict) {
    if (!text) return null;
    const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
    let best = null;
    for (const line of lines) {
      for (const lg of dict) {
        const dist = levenshtein(line, lg);
        const norm = dist / Math.max(line.length, lg.length, 1);
        if (norm < 0.35) {
          if (!best || norm < best.norm) best = { league: lg, norm };
        }
      }
      // İçeriyor mu kontrolü
      for (const lg of dict) {
        if (line.toLowerCase().includes(lg.toLowerCase())) {
          if (!best || best.norm > 0.05) best = { league: lg, norm: 0.05 };
        }
      }
    }
    return best ? best.league : null;
  }

  function extractPercents(text) {
    const matches = [];
    const re = /(\d{2,3})\s*[%٪]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const v = Number(m[1]);
      if (v >= 0 && v <= 100) matches.push(v);
    }
    return matches;
  }

  function extractScores(text) {
    // İY/MS ayrımlı kalıp: "1-0 / 2-1" veya "1:0 - 2:1"
    const dual = /(\d{1,2})\s*[-:]\s*(\d{1,2})\s*[\/|]\s*(\d{1,2})\s*[-:]\s*(\d{1,2})/;
    const dm = text.match(dual);
    if (dm) {
      return {
        htHome: +dm[1], htAway: +dm[2],
        ftHome: +dm[3], ftAway: +dm[4]
      };
    }
    // Tek skor varsa MS olarak kabul edilir.
    const single = /(\d{1,2})\s*[-:]\s*(\d{1,2})/;
    const sm = text.match(single);
    if (sm) {
      return { htHome: 0, htAway: 0, ftHome: +sm[1], ftAway: +sm[2] };
    }
    return null;
  }

  function extractTeams(text) {
    const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
    for (const line of lines) {
      const m = line.match(/^([A-Za-zÇĞİÖŞÜçğıöşü0-9 .'-]{3,30})\s+(?:vs\.?|-|—|x)\s+([A-Za-zÇĞİÖŞÜçğıöşü0-9 .'-]{3,30})$/i);
      if (m) return { homeTeam: m[1].trim(), awayTeam: m[2].trim() };
    }
    return null;
  }

  function extractDate(text) {
    const m = text.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    if (!m) return null;
    let y = +m[3]; if (y < 100) y += 2000;
    const mo = String(m[2]).padStart(2, '0');
    const d = String(m[1]).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }

  function parseOcr(text, opts) {
    opts = opts || {};
    const dict = (opts.leagues || []).concat(KNOWN_LEAGUES);
    const percents = extractPercents(text);
    const score = extractScores(text);
    const teams = extractTeams(text);
    const date = extractDate(text);
    const league = fuzzyLeague(text, dict);

    return {
      league: league || '',
      homeTeam: teams ? teams.homeTeam : '',
      awayTeam: teams ? teams.awayTeam : '',
      iy05Percent: percents[0] != null ? percents[0] : '',
      karmaPercent: percents[1] != null ? percents[1] : '',
      htHome: score ? score.htHome : '',
      htAway: score ? score.htAway : '',
      ftHome: score ? score.ftHome : '',
      ftAway: score ? score.ftAway : '',
      matchDate: date || Util.todayIso(),
      rawOcrText: text
    };
  }

  global.Parser = { KNOWN_LEAGUES, parseOcr, levenshtein, fuzzyLeague, extractPercents, extractScores, extractTeams, extractDate };
})(window);
