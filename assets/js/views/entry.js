(function (global) {
  'use strict';

  function render(root) {
    const tpl = document.getElementById('tpl-entry');
    root.appendChild(tpl.content.cloneNode(true));

    refreshLeagueList();

    const dz = document.getElementById('dropzone');
    const fi = document.getElementById('fileInput');

    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault(); dz.classList.remove('drag');
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      handleFiles(files);
    });
    fi.addEventListener('change', () => handleFiles(Array.from(fi.files)));

    document.getElementById('manualForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      try {
        await DB.put(data);
        Util.toast('Kaydedildi', 'success');
        e.target.reset();
        refreshLeagueList();
        global.App && global.App.notifyDataChange && global.App.notifyDataChange();
      } catch (err) {
        Util.toast('Hata: ' + err.message, 'error');
      }
    });
  }

  async function refreshLeagueList() {
    const dl = document.getElementById('leagueList');
    if (!dl) return;
    Util.clearChildren(dl);
    const matches = await DB.getAll();
    const set = new Set(Parser.KNOWN_LEAGUES);
    for (const m of matches) if (m.league) set.add(m.league);
    for (const lg of Array.from(set).sort()) {
      const o = document.createElement('option');
      o.value = lg;
      dl.appendChild(o);
    }
  }

  function handleFiles(files) {
    if (!files || !files.length) return;
    const queue = document.getElementById('ocrQueue');
    files.forEach((f) => processOne(f, queue));
  }

  async function processOne(file, queue) {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.innerHTML = `
      <header>
        <strong>${file.name}</strong>
        <span class="status">OCR çalışıyor…</span>
      </header>
      <div class="progress"><div></div></div>
      <div class="raw" hidden></div>
      <form class="form-grid"></form>
    `;
    queue.prepend(item);

    const bar = item.querySelector('.progress > div');
    const status = item.querySelector('.status');
    const raw = item.querySelector('.raw');

    let text = '';
    try {
      text = await OCR.recognize(file, (p) => { bar.style.width = (p * 100).toFixed(0) + '%'; });
      bar.style.width = '100%';
      status.textContent = 'OCR tamam';
    } catch (err) {
      status.textContent = 'OCR hata: ' + err.message;
      status.style.color = 'var(--bad)';
    }

    if (text) {
      raw.textContent = text;
      raw.hidden = false;
    }

    const matches = await DB.getAll();
    const userLeagues = Array.from(new Set(matches.map((m) => m.league).filter(Boolean)));
    const parsed = Parser.parseOcr(text || '', { leagues: userLeagues });

    const form = item.querySelector('form');
    form.innerHTML = formMarkup(parsed);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      data.rawOcrText = parsed.rawOcrText;
      try {
        await DB.put(data);
        Util.toast('Kaydedildi: ' + (data.homeTeam || '') + ' - ' + (data.awayTeam || ''), 'success');
        item.remove();
        refreshLeagueList();
        global.App && global.App.notifyDataChange && global.App.notifyDataChange();
      } catch (err) {
        Util.toast('Hata: ' + err.message, 'error');
      }
    });

    item.querySelector('button[data-action="discard"]').addEventListener('click', () => item.remove());
  }

  function formMarkup(p) {
    return `
      <label>Tarih<input type="date" name="matchDate" value="${p.matchDate || ''}" required /></label>
      <label>Lig<input type="text" name="league" list="leagueList" value="${p.league || ''}" required /></label>
      <label>Ev<input type="text" name="homeTeam" value="${p.homeTeam || ''}" /></label>
      <label>Deplasman<input type="text" name="awayTeam" value="${p.awayTeam || ''}" /></label>
      <label>İY 0.5 %<input type="number" name="iy05Percent" min="0" max="100" step="0.1" value="${p.iy05Percent}" required /></label>
      <label>Karma %<input type="number" name="karmaPercent" min="0" max="100" step="0.1" value="${p.karmaPercent}" required /></label>
      <label>İY ev<input type="number" name="htHome" min="0" value="${p.htHome}" required /></label>
      <label>İY dep<input type="number" name="htAway" min="0" value="${p.htAway}" required /></label>
      <label>MS ev<input type="number" name="ftHome" min="0" value="${p.ftHome}" required /></label>
      <label>MS dep<input type="number" name="ftAway" min="0" value="${p.ftAway}" required /></label>
      <div style="grid-column:1/-1; display:flex; gap:8px;">
        <button type="submit">Kaydet</button>
        <button type="button" data-action="discard" style="background:var(--bg-elev-2); border-color:var(--border); color:var(--text);">İptal</button>
      </div>
    `;
  }

  global.ViewEntry = { render };
})(window);
