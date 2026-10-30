/* ============================================================
   Інтерфейс: жива симуляція, можливі майбутні, метод
   ============================================================ */
(function (H) {
  'use strict';
  const $ = id => document.getElementById(id);
  const t = (k, p) => H.t(k, p);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bn = id => t('b.' + id);
  const pct = v => Math.round(v * 100);
  const catHtml = (c, label) => `<span class="catlab" style="--cc:var(--c-${c === 'democracy' ? 'libdem' : c})"><i class="dot"></i>${esc(label || t('cat.' + c))}</span>`;
  const store = {
    get(k) { try { return localStorage.getItem('hs.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('hs.' + k, v); } catch (e) { /* без сховища */ } },
  };

  const S = {
    view: 'live', mode: 'history', sim: null, people: null, playing: true, speed: 3, sel: 'UA', filter: 'all', chronSig: '',
    scen: { ai: 0.5, conc: 0.55, policy: 0.5, climate: 0.4, tension: 0.5 }, conds: [], futSig: '', fut: null, futBusy: 0, futView: 'chart', bt: null, btBusy: false,
    spark: {},
  };
  const SPEEDS = [1, 3, 8, 20];
  const KNOBS = ['ai', 'conc', 'policy', 'tension'];
  const W = (str, extra) => [{ id: 'warming', str }].concat(extra || []);
  const PRESETS = {
    base: { scen: { ai: 0.5, conc: 0.55, policy: 0.5, tension: 0.5 }, conds: W(0.4) },
    tf: { scen: { ai: 0.8, conc: 0.85, policy: 0.2, tension: 0.5 }, conds: W(0.4, [{ id: 'ads', str: 0.7 }, { id: 'market', str: 0.6 }]) },
    reg: { scen: { ai: 0.5, conc: 0.4, policy: 0.85, tension: 0.4 }, conds: W(0.4, [{ id: 'openai', str: 0.6 }, { id: 'unions', str: 0.4 }]) },
    storm: { scen: { ai: 0.5, conc: 0.55, policy: 0.5, tension: 0.85 }, conds: W(0.85, [{ id: 'migration', str: 0.6 }, { id: 'pandemics', str: 0.5 }]) },
  };


  /* ---------- підказка ---------- */
  const tip = $('tip');
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    let left = x + 14, top = y + 14;
    if (left + w > vw - 8) left = x - w - 14;
    if (left < 8) left = 8;
    if (top + h > vh - 8) top = y - h - 14;
    tip.style.left = left + 'px'; tip.style.top = Math.max(8, top) + 'px';
  }
  function hideTip() { tip.hidden = true; }

  /* ---------- статичні тексти ---------- */
  function applyStatic() {
    document.documentElement.lang = H.lang;
    document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.querySelectorAll('.lang').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === H.lang));
    $('speeds').innerHTML = SPEEDS.map(n => `<button class="seg" data-s="${n}" aria-pressed="${n === S.speed}">${esc(t('ctl.yps', { n }))}</button>`).join('');
    const leg = H.CATS.map(c => `<li>${catHtml(c)}</li>`).join('');
    $('legendLive').innerHTML = leg; $('legendFut').innerHTML = leg;
    $('sources').innerHTML = H.SOURCES.map(([lab, url], i) => `<li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(H.hasText('src.' + i) ? t('src.' + i) : lab)}</a></li>`).join('');
    buildTiles(); buildSliders();
  }

  /* ==================== ЖИВА СИМУЛЯЦІЯ ==================== */
  function newSim() {
    S.sim = new H.Sim(S.mode === 'future' ? { mode: 'future', scen: S.scen, conds: S.conds } : { mode: S.mode });
    if (S.mode === 'future') S.sim.scen = S.scen;   // зміни повзунків діють одразу
    S.people = new H.People(S.sim);
    S.chronSig = '';
    buildTimeline();
    renderLive();
  }
  function stepOnce() {
    const s = S.sim;
    if (s.year >= s.endYear) { S.playing = false; return false; }
    s.step(); S.people.update();
    return true;
  }

  // плитки блоків будуються один раз — щоб оновлення не «з'їдали» натискання
  const tileRefs = {};
  function buildTiles() {
    const box = $('tiles');
    box.innerHTML = H.BLOCS.map(id => `<button class="tile" data-b="${id}" aria-pressed="false">
      <div class="tname"><span>${esc(bn(id))}</span><span class="tgdp"></span></div>
      <span class="catlab tcat"><i class="dot"></i><span></span></span>
      <div class="tsub"></div>
      <div class="meters">
        <span>${esc(t('ms.psi'))}</span><span class="meter mpsi"><i></i></span><span class="num vpsi"></span>
        <span>${esc(t('ms.anger'))}</span><span class="meter mang"><i></i></span><span class="num vang"></span>
        <span>${esc(t('ms.legit'))}</span><span class="meter mleg"><i></i></span><span class="num vleg"></span>
      </div>
      <span class="wartag" hidden>⚔ <span>${esc(t('war'))}</span></span>
    </button>`).join('');
    for (const el of box.querySelectorAll('.tile')) {
      const q = s => el.querySelector(s);
      tileRefs[el.dataset.b] = { el, gdp: q('.tgdp'), cat: q('.tcat span'), sub: q('.tsub'), war: q('.wartag'),
        mpsi: q('.mpsi'), mang: q('.mang'), mleg: q('.mleg'), vpsi: q('.vpsi'), vang: q('.vang'), vleg: q('.vleg') };
    }
    if (S.sim) updateTiles();
  }
  function setMeter(m, v, hotAt) { m.firstChild.style.width = Math.round(Math.max(0, Math.min(1, v)) * 100) + '%'; m.classList.toggle('hot', hotAt != null && v >= hotAt); }
  function updateTiles() {
    for (const id of H.BLOCS) {
      const b = S.sim.blocs[id], r = tileRefs[id], x = b.rec[b.rec.length - 1];
      r.el.style.setProperty('--cc', `var(--c-${x.cat})`);
      r.el.classList.toggle('sel', id === S.sel); r.el.setAttribute('aria-pressed', id === S.sel);
      r.gdp.textContent = (x.gdp >= 10 ? Math.round(x.gdp) : x.gdp.toFixed(1)) + ' ' + t('kusd');
      r.cat.textContent = t('cat.' + x.cat);
      r.sub.textContent = t('reg.' + x.regime) + ' · ' + t('ord.' + x.order);
      r.war.hidden = !x.war;
      setMeter(r.mpsi, x.psi, 0.5); setMeter(r.mang, x.anger, 0.55); setMeter(r.mleg, x.legit);
      r.vpsi.textContent = pct(x.psi); r.vang.textContent = pct(x.anger); r.vleg.textContent = pct(x.legit);
    }
  }

  /* ---------- часова стрічка ---------- */
  function yearsRange() { return S.mode === 'history' ? [1900, 2025] : [2025, 2100]; }
  function buildTimeline() {
    const [y0, y1] = yearsRange(), hist = S.mode === 'history';
    const ticks = [];
    for (let y = Math.ceil(y0 / 25) * 25; y <= y1; y += 25) ticks.push(y);
    $('timeline').innerHTML = `<div class="tl">${H.BLOCS.map(id => `<div class="tlr"><span class="tll">${esc(bn(id))}</span><div class="tlb" data-b="${id}"><svg viewBox="0 0 ${y1 - y0 + 1} ${hist ? 22 : 14}" preserveAspectRatio="none" aria-hidden="true" style="height:${hist ? 22 : 14}px"></svg></div></div>`).join('')}
      <div class="tlr"><span class="tll"></span><div class="tlaxis">${ticks.map(y => `<span style="left:${(y - y0) / (y1 - y0 + 1) * 100}%">${y}</span>`).join('')}</div></div>
      ${hist ? `<p class="tlnote">${esc(t('live.model'))} ▬ / ${esc(t('live.real'))} ▁</p>` : ''}</div>`;
  }
  function runs(arr, key) {
    const out = [];
    for (const x of arr) { const c = key(x); const l = out[out.length - 1]; if (l && l.c === c) l.n++; else out.push({ y: x.y, c, n: 1 }); }
    return out;
  }
  function updateTimeline() {
    const [y0, y1] = yearsRange(), hist = S.mode === 'history';
    for (const el of $('timeline').querySelectorAll('.tlb')) {
      const id = el.dataset.b, rec = S.sim.blocs[id].rec;
      let s = `<rect x="0" y="0" width="${y1 - y0 + 1}" height="14" style="fill:var(--surface-2)"/>`;
      for (const r of runs(rec, x => x.cat)) s += `<rect x="${r.y - y0}" y="0" width="${r.n}" height="14" style="fill:var(--c-${r.c});stroke:var(--surface);stroke-width:1.5" vector-effect="non-scaling-stroke"/>`;
      if (hist) {
        const real = []; for (let y = y0; y <= y1; y++) real.push({ y, cat: H.historyAt(id, y) });
        for (const r of runs(real, x => x.cat)) s += `<rect x="${r.y - y0}" y="16" width="${r.n}" height="6" style="fill:var(--c-${r.c});stroke:var(--surface);stroke-width:1.5" vector-effect="non-scaling-stroke"/>`;
      }
      el.firstChild.innerHTML = s;
      el.classList.toggle('sel', id === S.sel);
    }
  }
  $('timeline').addEventListener('mousemove', e => {
    const el = e.target.closest('.tlb'); if (!el) { hideTip(); return; }
    const [y0, y1] = yearsRange(), rc = el.getBoundingClientRect();
    const y = Math.round(y0 + (e.clientX - rc.left) / rc.width * (y1 - y0 + 1) - 0.5), id = el.dataset.b;
    const x = S.sim.blocs[id].rec.find(r => r.y === y);
    let h = `<b>${esc(bn(id))}, ${y}</b>`;
    h += x ? `<div class="tr">${catHtml(x.cat)}<span>${esc(t('live.model'))}</span></div>` : '';
    if (S.mode === 'history') h += `<div class="tr">${catHtml(H.historyAt(id, Math.max(y0, Math.min(y1, y))))}<span>${esc(t('live.real'))}</span></div>`;
    showTip(h, e.clientX, e.clientY);
  });
  $('timeline').addEventListener('mouseleave', hideTip);
  $('timeline').addEventListener('click', e => { const el = e.target.closest('.tlb'); if (el) select(el.dataset.b); });

  /* ---------- хроніка ---------- */
  function evText(e) {
    const p = e.p || {}, q = { bloc: e.bloc ? bn(e.bloc) : '' };
    const isBloc = v => H.BLOCS.includes(v) || v === 'JP';
    for (const k of ['a', 'b', 'win', 'lose']) if (p[k]) q[k] = bn(p[k]);
    if (p.by) q.by = isBloc(p.by) ? bn(p.by) : t('ideo.' + p.by);
    if ('name' in p) q.name = personaName(p.name);
    if (p.from && !e.key.startsWith('tr.')) {
      const pre = e.key === 'ev.order' ? 'ord.' : 'ideo.';
      q.from = t(pre + p.from); q.to = t(pre + p.to);
    }
    return t(e.key, q);
  }
  function personaName(n) { const s = Array.isArray(n) ? n[H.lang === 'de' ? 1 : 0] : n; return s ? '«' + s + '»' : t('persona.anon'); }
  function causesText(p) {
    if (!p || !p.causes || !p.causes.length) return '';
    return t('live.why') + ': ' + p.causes.map(([c, v]) => `${t('c.' + c)} (${v})`).join(', ');
  }
  const FILT = { all: () => true, transition: e => e.kind === 'transition', war: e => e.kind === 'war', shock: e => e.kind === 'shock', politics: e => ['election', 'order', 'crisis', 'media'].includes(e.kind) };
  function updateChron() {
    const log = S.sim.log, sig = log.length + '|' + S.filter + '|' + H.lang + '|' + S.sim.seed;
    if (sig === S.chronSig) return;
    S.chronSig = sig;
    const list = log.filter(FILT[S.filter]).slice(-250).reverse();
    document.querySelectorAll('#chronFilter .chip').forEach(c => c.classList.toggle('on', c.dataset.f === S.filter));
    if (!list.length) { $('chron').innerHTML = `<li class="empty">${esc(t('live.empty'))}</li>`; return; }
    $('chron').innerHTML = list.map(e => {
      const p = e.p || {};
      const shift = e.kind === 'transition' && p.from && p.from !== p.to ? `<div class="shift">${catHtml(p.from)} → ${catHtml(p.to)}</div>` : '';
      const why = causesText(p);
      return `<li class="k-${e.kind}"><span class="cy">${e.year}</span><div><div class="ct">${esc(evText(e))}</div>${shift}${why ? `<div class="why">${esc(why)}</div>` : ''}</div></li>`;
    }).join('');
  }
  $('chronFilter').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; S.filter = c.dataset.f; updateChron(); });

  /* ---------- обраний блок ---------- */
  const SPARKS = [
    ['gdp', 'ms.gdp', null], ['omega', 'm.omega', [0, 1]], ['legit', 'm.legit', [0, 1]],
    ['inc', 'm.inc', [0, 1]], ['psi', 'm.psi', [0, 1]], ['plat', 'm.plat', [0, 1]],
  ];
  function fmtVal(k, v) { return k === 'gdp' ? (v >= 10 ? Math.round(v) : v.toFixed(1)) + ' ' + t('kusd') : pct(v) + (k === 'omega' ? '%' : ''); }
  function sparkSvg(k, rec, range) {
    const vals = rec.map(x => x[k]);
    const [y0, y1] = yearsRange();
    const lo = range ? range[0] : 0, hi = range ? range[1] : Math.max(1, ...vals) * 1.05;
    const X = y => (y - y0) / (y1 - y0) * 100, Y = v => 40 - (v - lo) / (hi - lo) * 40;
    const pts = rec.map(x => `${X(x.y).toFixed(2)},${Y(x[k]).toFixed(2)}`).join(' ');
    S.spark[k] = { rec, lo, hi };
    return `<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2="100" y1="40" y2="40" style="stroke:var(--axis)" vector-effect="non-scaling-stroke"/>
      ${range ? `<line x1="0" x2="100" y1="20" y2="20" style="stroke:var(--grid)" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>` : ''}
      <polyline points="${pts}" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <line class="xh" x1="0" x2="0" y1="0" y2="40" style="stroke:var(--ink-2)" vector-effect="non-scaling-stroke" visibility="hidden"/>
    </svg>`;
  }
  function meterRow(label, v, hotAt) {
    return `<span>${esc(label)}</span><span class="meter${hotAt != null && v >= hotAt ? ' hot' : ''}"><i style="width:${pct(Math.max(0, Math.min(1, v)))}%"></i></span><span class="v">${pct(v)}</span>`;
  }
  function cell(v) { v = Math.max(0, Math.min(1, v)); return `<div class="cell"><span class="meter"><i style="width:${pct(Math.max(0, Math.min(1, v)))}%"></i></span><span>${pct(v)}</span></div>`; }
  function diaryText(d, lang) {
    const p = Object.assign({ job: t('job.' + (d.p.era || 'ind')) }, d.p);
    if (d.key === 'd.inherit' && d.p.parent) p.parent = d.p.parent[lang === 'de' ? 1 : 0];
    if ('name' in d.p) p.name = personaName(d.p.name);
    return t(d.key, p);
  }
  function updateSelected() {
    const id = S.sel, b = S.sim.blocs[id], x = b.rec[b.rec.length - 1], year = S.sim.year;
    let h = `<div class="selhead"><h2>${esc(bn(id))}</h2>${catHtml(x.cat)}<p class="desc">${esc(t('catd.' + x.cat))}</p>`;
    if (S.mode === 'history') h += `<span class="real">${t('sel.real', { cat: catHtml(H.historyAt(id, year)) })}</span>`;
    h += `<dl class="kv"><dt>${esc(t('sel.regime'))}</dt><dd>${esc(t('reg.' + x.regime))}</dd><dt>${esc(t('sel.order'))}</dt><dd>${esc(t('ord.' + x.order))}</dd><dt>${esc(t('sel.gov'))}</dt><dd>${esc(t('ideo.' + x.gov))}</dd>`;
    if (b.war) { const foes = b.war.sides.find(sd => !sd.includes(id)) || []; h += `<dt>${esc(t('atWar'))}</dt><dd>⚔ ${esc(foes.map(bn).join(', '))}</dd>`; }
    h += `</dl></div>`;
    h += `<div class="sec"><h3>${esc(t('sel.pressure'))}</h3><div class="bars">${meterRow(t('m.mmp'), x.mmp, 0.5)}${meterRow(t('m.emp'), x.emp, 0.5)}${meterRow(t('m.sfd'), x.sfd, 0.5)}${meterRow(t('m.psi'), x.psi, 0.5)}</div></div>`;
    h += `<div class="sec"><h3>${esc(t('sel.trends'))}</h3><div class="sparks" id="sparks">${SPARKS.map(([k, lab, range]) => `<div class="spark" data-k="${k}"><div class="sl"><span>${esc(t(lab))}</span><b>${esc(fmtVal(k, x[k]))}</b></div>${sparkSvg(k, b.rec, range)}</div>`).join('')}</div></div>`;
    // групи
    const G = ['C', 'A', 'E'];
    h += `<div class="sec"><h3>${esc(t('sel.groups'))}</h3><table class="gtable"><thead><tr><th></th>${G.map(g => `<th>${esc(t('g.' + g))}</th>`).join('')}</tr></thead><tbody>`;
    for (const n of ['mat', 'sec', 'status', 'voice', 'belong', 'meaning']) h += `<tr><td>${esc(t('n.' + n))}</td>${G.map(g => `<td>${cell(b[g].needs[n])}</td>`).join('')}</tr>`;
    ['anger', 'fear', 'hope', 'trust'].forEach((e, i) => { h += `<tr${i === 0 ? ' class="sep"' : ''}><td>${esc(t('e.' + e))}</td>${G.map(g => `<td>${cell(b[g].emo[e])}</td>`).join('')}</tr>`; });
    h += `</tbody></table><p class="muted small" style="margin-top:4px">${esc(t('needsLegend'))}</p></div>`;
    // ідеї
    h += `<div class="sec"><h3>${esc(t('sel.ideas'))}</h3><div class="ideas">${G.map(g => {
      const io = b[g].ideo, sum = Object.values(io).reduce((s, v) => s + v, 0) || 1;
      const top = Object.entries(io).filter(([, v]) => v > 0.005).sort((a, c) => c[1] - a[1]).slice(0, 5);
      return `<div><h4>${esc(t('g.' + g))}</h4><div class="bars">${top.map(([k, v]) => `<span class="lab"><span>${esc(t('ideo.' + k))}</span><span class="v">${pct(v / sum)}%</span></span><span class="meter"><i style="width:${pct(v / sum)}%"></i></span>`).join('')}</div></div>`;
    }).join('')}</div></div>`;
    // люди
    if (S.mode === 'future') {
      const ps = S.sim.personas(b);
      h += `<div class="sec"><h3>${esc(t('sel.media'))}</h3>${ps.length ? `<ul class="plist">${ps.map(p => `<li><b>${esc(personaName(p.name))}</b> — ${esc(t('ideo.' + p.ideo))} · ${esc(t('sel.mediaReach', { n: pct(p.str) }))}${p.user ? ` · <span class="muted">${esc(t('sel.mediaUser'))}</span>` : ''}</li>`).join('')}</ul>` : `<p class="muted small">${esc(t('sel.mediaNone'))}</p>`}</div>`;
    }
    h += `<div class="sec"><h3>${esc(t('sel.people'))}</h3><div class="people">${S.people.ofBloc(id).map(p => {
      const age = year - p.born;
      const role = t('role.' + p.role, { f: p.female });
      return `<div class="person"><div class="pn"><b>${esc(H.personName(p, H.lang))}</b><span class="pr">${esc(t('p.age', { n: age }))}${p.gen > 1 ? ' · ' + esc(t('p.gen', { n: p.gen })) : ''}</span></div>
        <div class="pr">${esc(role)}</div>
        <div class="mood">${['anger', 'fear', 'hope', 'trust'].map(k => `<div>${esc(t('e.' + k))}<span class="meter${k === 'anger' && p.mood[k] > 0.55 ? ' hot' : ''}"><i style="width:${pct(p.mood[k])}%"></i></span></div>`).join('')}</div>
        <ol class="diary">${p.diary.slice(-6).reverse().map(d => `<li><span>${d.year}</span>${esc(diaryText(d, H.lang))}</li>`).join('')}</ol></div>`;
    }).join('')}</div></div>`;
    $('selected').innerHTML = h;
  }
  $('selected').addEventListener('mousemove', e => {
    const sp = e.target.closest('.spark');
    document.querySelectorAll('#selected .xh').forEach(l => l.setAttribute('visibility', 'hidden'));
    if (!sp) { hideTip(); return; }
    const k = sp.dataset.k, d = S.spark[k], svg = sp.querySelector('svg'), rc = svg.getBoundingClientRect();
    if (!d) return;
    const [y0, y1] = yearsRange();
    const y = Math.round(y0 + (e.clientX - rc.left) / rc.width * (y1 - y0));
    const x = d.rec.find(r => r.y === y) || d.rec[d.rec.length - 1];
    const l = svg.querySelector('.xh'); const xx = (x.y - y0) / (y1 - y0) * 100;
    l.setAttribute('x1', xx); l.setAttribute('x2', xx); l.setAttribute('visibility', 'visible');
    showTip(`<b>${x.y}</b><div class="tr"><span>${esc(t(SPARKS.find(s => s[0] === k)[1]))}</span><span>${esc(fmtVal(k, x[k]))}</span></div>`, e.clientX, e.clientY);
  });
  $('selected').addEventListener('mouseleave', () => { hideTip(); document.querySelectorAll('#selected .xh').forEach(l => l.setAttribute('visibility', 'hidden')); });

  function select(id) { S.sel = id; store.set('sel', id); updateTiles(); updateTimeline(); updateSelected(); }
  $('tiles').addEventListener('click', e => { const el = e.target.closest('.tile'); if (el) select(el.dataset.b); });

  function renderLive() {
    const s = S.sim;
    $('year').textContent = s.year;
    $('play').textContent = S.playing ? t('ctl.pause') : t('ctl.play');
    document.querySelectorAll('.mode').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === S.mode));
    $('endnote').hidden = s.year < s.endYear;
    updateTiles(); updateTimeline(); updateChron(); updateSelected();
  }

  $('play').addEventListener('click', () => {
    if (S.sim.year >= S.sim.endYear) newSim();
    S.playing = !S.playing; renderLive();
  });
  $('step').addEventListener('click', () => { S.playing = false; stepOnce(); renderLive(); });
  $('reset').addEventListener('click', () => { newSim(); S.playing = true; renderLive(); });
  $('speeds').addEventListener('click', e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    S.speed = +b.dataset.s; store.set('speed', S.speed);
    $('speeds').querySelectorAll('[data-s]').forEach(x => x.setAttribute('aria-pressed', +x.dataset.s === S.speed));
  });
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => {
    if (S.mode === b.dataset.mode) return;
    S.mode = b.dataset.mode; store.set('mode', S.mode); newSim(); S.playing = true; placeScenario(); renderLive();
  }));

  let acc = 0, last = 0;
  function frame(ts) {
    const dt = last ? Math.min(0.25, (ts - last) / 1000) : 0; last = ts;
    if (S.playing && S.view === 'live' && S.sim) {
      acc += dt * S.speed;
      if (acc >= 1) {
        const n = Math.min(4, Math.floor(acc)); acc -= n;
        let any = false; for (let i = 0; i < n; i++) any = stepOnce() || any;
        if (acc > 4) acc = 0;
        renderLive();
      }
    }
    requestAnimationFrame(frame);
  }

  /* ==================== МОЖЛИВІ МАЙБУТНІ ==================== */
  /* ---------- сценарій: базові припущення й додаткові умови ---------- */
  const defConds = () => [{ id: 'warming', str: 0.4, from: 2025, on: true, blocs: [] }];
  function condFrom(def) {
    const live = S.view === 'live' && S.mode === 'future' && S.sim;
    const y = live ? Math.max(2025, S.sim.year + 1) : 2025;
    return Math.max(y, def.from || 2025);
  }
  function makeCond(id) {
    const d = H.CONDS.find(c => c.id === id);
    const c = { id, str: d.str, from: condFrom(d), on: true, blocs: [] };
    if (d.scope === 'one') Object.assign(c, { blocs: [S.sel || d.bloc], ideo: d.ideo, len: d.len, name: '' });
    return c;
  }
  function saveScen() { store.set('scen', JSON.stringify({ scen: S.scen, conds: S.conds })); markStale(); }
  function markStale() {
    const stale = S.fut && S.futSig !== scenSig();
    $('futStale').hidden = !stale;
  }
  const scenSig = () => JSON.stringify([S.scen, S.conds]);
  function buildSliders() {
    $('presets').innerHTML = Object.keys(PRESETS).map(k => `<button class="chip" data-p="${k}">${esc(t('pr.' + k))}</button>`).join('');
    $('sliders').innerHTML = KNOBS.map(k => `<div class="slider"><label for="k-${k}"><span>${esc(t('k.' + k))}</span><output id="o-${k}">${pct(S.scen[k])}</output></label>
      <input type="range" id="k-${k}" data-k="${k}" min="0" max="100" step="5" value="${pct(S.scen[k])}">
      <div class="ends"><span>${esc(t('k.' + k + '.lo'))}</span><span>${esc(t('k.' + k + '.hi'))}</span></div></div>`).join('');
    buildConds();
    markPreset();
    $('futToggle').textContent = S.futView === 'chart' ? t('table.view') : t('chart.view');
  }
  function buildConds() {
    const used = new Set(S.conds.map(c => c.id));
    $('addCond').innerHTML = `<option value="">${esc(t('sc.add'))}</option>` + H.CONDS.filter(d => d.multi || !used.has(d.id)).map(d => `<option value="${d.id}">${esc(t('cond.' + d.id))}</option>`).join('');
    if (!S.conds.length) { $('conds').innerHTML = `<p class="muted small">${esc(t('sc.none'))}</p>`; return; }
    $('conds').innerHTML = S.conds.map((c, i) => {
      const d = H.CONDS.find(x => x.id === c.id); if (!d) return '';
      let h = `<div class="cond${c.on === false ? ' off' : ''}" data-i="${i}">
        <div class="ch"><label class="sw"><input type="checkbox" data-f="on"${c.on === false ? '' : ' checked'} aria-label="${esc(t('sc.on'))}"><b>${esc(t('cond.' + c.id))}</b></label>
        <button class="x" data-act="del" aria-label="${esc(t('sc.del'))}" title="${esc(t('sc.del'))}">✕</button></div>
        <p class="cd">${esc(t('cond.' + c.id + '.d'))}</p>`;
      if (d.scope === 'one') {
        h += `<div class="cgrid">
          <label>${esc(t('sc.name'))}<input type="text" data-f="name" maxlength="40" value="${esc(c.name || '')}" placeholder="${esc(t('sc.namePh'))}"></label>
          <label>${esc(t('sc.bloc'))}<select data-f="bloc">${H.BLOCS.map(id => `<option value="${id}"${c.blocs[0] === id ? ' selected' : ''}>${esc(bn(id))}</option>`).join('')}</select></label>
          <label class="wide">${esc(t('sc.ideo'))}<select data-f="ideo">${H.IDEOS.map(k => `<option value="${k}"${c.ideo === k ? ' selected' : ''}>${esc(t('ideo.' + k))}</option>`).join('')}</select></label>
        </div>`;
      }
      h += `<div class="slider small"><label><span>${esc(t(d.scope === 'one' ? 'sc.reach' : 'sc.str'))}</span><output>${pct(c.str)}</output></label>
        <input type="range" data-f="str" min="5" max="100" step="5" value="${pct(c.str)}"></div>
        <div class="cgrid">
          <label>${esc(t('sc.from'))}<input type="number" data-f="from" min="2025" max="2099" step="1" value="${c.from}"></label>`;
      if (d.scope === 'one') h += `<label>${esc(t('sc.len'))}<select data-f="len">${[4, 8, 12, 20, 40].map(n => `<option value="${n}"${c.len === n ? ' selected' : ''}>${esc(t('sc.years', { n }))}</option>`).join('')}</select></label>`;
      h += `</div>`;
      if (d.scope === 'blocs') {
        const all = !c.blocs || !c.blocs.length;
        h += `<div class="where"><span class="muted small">${esc(t('sc.where'))}:</span><div class="chips"><button class="chip${all ? ' on' : ''}" data-act="all">${esc(t('sc.everywhere'))}</button>${H.BLOCS.map(id => `<button class="chip${!all && c.blocs.includes(id) ? ' on' : ''}" data-act="bloc" data-b="${id}">${esc(bn(id))}</button>`).join('')}</div></div>`;
      } else if (d.scope === 'global') h += `<p class="muted small">${esc(t('sc.global'))}</p>`;
      return h + `</div>`;
    }).join('');
  }
  function markPreset() {
    const sig = JSON.stringify(S.conds.map(c => [c.id, c.str, c.from, c.on !== false, (c.blocs || []).join()]));
    $('presets').querySelectorAll('.chip').forEach(c => {
      const p = PRESETS[c.dataset.p];
      const pc = JSON.stringify(p.conds.map(x => [x.id, x.str, x.from || 2025, true, (x.blocs || []).join()]));
      c.classList.toggle('on', KNOBS.every(k => Math.abs(p.scen[k] - S.scen[k]) < 0.001) && pc === sig);
    });
  }
  $('sliders').addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return;
    S.scen[k] = +e.target.value / 100; $('o-' + k).textContent = e.target.value; markPreset(); saveScen();
  });
  $('presets').addEventListener('click', e => {
    const c = e.target.closest('[data-p]'); if (!c) return;
    const p = PRESETS[c.dataset.p];
    Object.assign(S.scen, p.scen);
    S.conds.splice(0, S.conds.length, ...p.conds.map(x => Object.assign({ on: true, blocs: [], from: 2025 }, x)));
    buildSliders(); saveScen();
    if (S.view === 'futures') runFutures();
  });
  const condAt = el => { const box = el.closest('.cond'); return box ? S.conds[+box.dataset.i] : null; };
  $('conds').addEventListener('input', e => {
    const c = condAt(e.target), f = e.target.dataset.f; if (!c || !f) return;
    if (f === 'str') { c.str = +e.target.value / 100; e.target.parentNode.querySelector('output').textContent = e.target.value; }
    else if (f === 'name') c.name = e.target.value.trim();
    else if (f === 'from') { const v = Math.round(+e.target.value); if (v >= 2025 && v <= 2099) c.from = v; }
    else return;
    markPreset(); saveScen();
  });
  $('conds').addEventListener('change', e => {
    const c = condAt(e.target), f = e.target.dataset.f; if (!c || !f) return;
    if (f === 'on') { c.on = e.target.checked; e.target.closest('.cond').classList.toggle('off', !c.on); }
    else if (f === 'bloc') c.blocs = [e.target.value];
    else if (f === 'ideo') c.ideo = e.target.value;
    else if (f === 'len') c.len = +e.target.value;
    else if (f === 'from') { e.target.value = c.from; }
    markPreset(); saveScen();
  });
  $('conds').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const i = +btn.closest('.cond').dataset.i, c = S.conds[i];
    if (btn.dataset.act === 'del') S.conds.splice(i, 1);
    else if (btn.dataset.act === 'all') c.blocs = [];
    else if (btn.dataset.act === 'bloc') {
      const id = btn.dataset.b; c.blocs = c.blocs || [];
      c.blocs = c.blocs.includes(id) ? c.blocs.filter(x => x !== id) : c.blocs.concat(id);
      if (c.blocs.length === H.BLOCS.length) c.blocs = [];
    }
    buildConds(); markPreset(); saveScen();
  });
  $('addCond').addEventListener('change', e => {
    const id = e.target.value; if (!id) return;
    S.conds.push(makeCond(id)); buildConds(); markPreset(); saveScen();
    const last = $('conds').lastElementChild; if (last && last.scrollIntoView) last.scrollIntoView({ block: 'nearest' });
  });
  $('goFut').addEventListener('click', () => runFutures());
  $('futToggle').addEventListener('click', () => {
    S.futView = S.futView === 'chart' ? 'table' : 'chart';
    $('futToggle').textContent = S.futView === 'chart' ? t('table.view') : t('chart.view');
    renderFut();
  });

  function runFutures() {
    const n = +$('nRuns').value, token = ++S.futBusy;
    const res = H.newEnsemble({ mode: 'future', scen: Object.assign({}, S.scen), conds: JSON.parse(JSON.stringify(S.conds)), seed: 5 });
    S.fut = res; S.futSig = scenSig(); markStale(); let k = 0, lastDraw = 0;
    const prog = $('futProg'); prog.hidden = false; $('goFut').disabled = true;
    function chunk() {
      if (token !== S.futBusy) return;
      const t0 = performance.now();
      while (k < n && performance.now() - t0 < 35) H.addRun(res, k++);
      prog.firstChild.style.width = (k / n * 100) + '%';
      prog.lastChild.textContent = t('fu.running', { n: k, m: n });
      if (k >= n) { prog.hidden = true; $('goFut').disabled = false; renderFut(); return; }
      if (k - lastDraw >= 25) { lastDraw = k; renderFut(); }
      setTimeout(chunk, 0);
    }
    chunk();
  }
  const shareAt = (res, id, y) => { const i = res.years.indexOf(y); const sh = res.share[id][i] || {}; return Object.entries(sh).map(([c, v]) => [c, v / res.n]).sort((a, b) => b[1] - a[1]); };
  function renderFut() {
    const res = S.fut; if (!res || !res.n) return;
    // головне
    let h = `<table class="hl"><thead><tr><th></th><th>2050</th><th>2100</th><th>${esc(t('fu.tfEver'))}</th></tr></thead><tbody>`;
    for (const id of H.BLOCS) {
      const cellFor = y => shareAt(res, id, y).slice(0, 2).filter((x, i) => i === 0 || x[1] >= 0.15).map(([c, v]) => `${catHtml(c)} <span class="pct">${pct(v)}%</span>`).join('<br>');
      const tf = res.firstTF[id].filter(x => x).length / res.n;
      h += `<tr><td><b>${esc(bn(id))}</b></td><td>${cellFor(2050)}</td><td>${cellFor(2100)}</td><td class="pct">${pct(tf)}%</td></tr>`;
    }
    $('headline').innerHTML = h + '</tbody></table>';
    // графіки або таблиця
    $('multiples').hidden = S.futView !== 'chart'; $('futTable').hidden = S.futView === 'chart';
    if (S.futView === 'chart') $('multiples').innerHTML = H.BLOCS.map(id => `<div class="mult" data-b="${id}"><h3>${esc(bn(id))}</h3>${stackSvg(res, id)}</div>`).join('');
    else $('futTable').innerHTML = `<div class="scroll">${H.BLOCS.map(id => {
      const ys = [2030, 2050, 2075, 2100], used = H.CATS.filter(c => ys.some(y => (res.share[id][res.years.indexOf(y)] || {})[c]));
      return `<table class="ftable"><caption>${esc(bn(id))} — ${esc(t('fu.share'))}</caption><thead><tr><th></th>${ys.map(y => `<th>${y}</th>`).join('')}</tr></thead><tbody>${used.map(c => `<tr><td>${catHtml(c)}</td>${ys.map(y => `<td>${pct(((res.share[id][res.years.indexOf(y)] || {})[c] || 0) / res.n)}%</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }).join('')}</div>`;
    // шляхи
    $('paths').innerHTML = H.BLOCS.map(id => {
      const top = Object.entries(res.paths[id]).sort((a, b) => b[1] - a[1]).slice(0, 4);
      return `<div><h3>${esc(bn(id))}</h3><ol>${top.map(([k, v]) => `<li><b>${pct(v / res.n)}%</b><span class="pathseq">${k.split('>').map(c => catHtml(c)).join(' › ')}</span></li>`).join('')}</ol></div>`;
    }).join('');
  }
  const MW = 320, MH = 168, ML = 34, MR = 8, MT = 6, MB = 22;
  function stackSvg(res, id) {
    const ys = res.years, n = res.n, y0 = ys[0], y1 = ys[ys.length - 1];
    const X = y => ML + (y - y0) / (y1 - y0) * (MW - ML - MR), Y = v => MT + (1 - v) * (MH - MT - MB);
    const base = ys.map(() => 0);
    let paths = '';
    for (const c of H.CATS) {
      const top = ys.map((y, i) => base[i] + ((res.share[id][i] || {})[c] || 0) / n);
      if (top.every((v, i) => v - base[i] < 1e-9)) continue;
      const up = ys.map((y, i) => `${X(y).toFixed(1)},${Y(top[i]).toFixed(1)}`);
      const dn = ys.map((y, i) => `${X(y).toFixed(1)},${Y(base[i]).toFixed(1)}`).reverse();
      paths += `<path d="M${up.join('L')}L${dn.join('L')}Z" style="fill:var(--c-${c});stroke:var(--surface);stroke-width:1.2;stroke-linejoin:round"/>`;
      for (let i = 0; i < ys.length; i++) base[i] = top[i];
    }
    let axis = '';
    for (const v of [0, 0.5, 1]) axis += `<line x1="${ML}" x2="${MW - MR}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--grid)"/><text x="${ML - 5}" y="${Y(v) + 3.5}" text-anchor="end" style="fill:var(--muted);font-size:10px">${pct(v)}%</text>`;
    for (const y of [2025, 2050, 2075, 2100]) axis += `<text x="${X(y)}" y="${MH - 6}" text-anchor="${y === 2025 ? 'start' : y === 2100 ? 'end' : 'middle'}" style="fill:var(--muted);font-size:10px">${y}</text>`;
    return `<svg viewBox="0 0 ${MW} ${MH}" role="img" aria-label="${esc(bn(id))}">${axis}${paths}
      <line x1="${ML}" x2="${MW - MR}" y1="${Y(0)}" y2="${Y(0)}" style="stroke:var(--axis)"/>
      <line class="xh" x1="0" x2="0" y1="${MT}" y2="${Y(0)}" style="stroke:var(--ink);stroke-width:1" visibility="hidden"/>
      <rect class="hit" x="${ML}" y="0" width="${MW - ML - MR}" height="${MH - MB + 4}" fill="transparent"/></svg>`;
  }
  $('multiples').addEventListener('mousemove', e => {
    const m = e.target.closest('.mult'); const res = S.fut;
    document.querySelectorAll('#multiples .xh').forEach(l => l.setAttribute('visibility', 'hidden'));
    if (!m || !res) { hideTip(); return; }
    const svg = m.querySelector('svg'), rc = svg.getBoundingClientRect();
    const vx = (e.clientX - rc.left) / rc.width * MW;
    const ys = res.years, y0 = ys[0], y1 = ys[ys.length - 1];
    const y = Math.max(y0, Math.min(y1, Math.round(y0 + (vx - ML) / (MW - ML - MR) * (y1 - y0))));
    const xx = ML + (y - y0) / (y1 - y0) * (MW - ML - MR), l = svg.querySelector('.xh');
    l.setAttribute('x1', xx); l.setAttribute('x2', xx); l.setAttribute('visibility', 'visible');
    const id = m.dataset.b, rows = shareAt(res, id, y);
    showTip(`<b>${esc(bn(id))}, ${y}</b>${rows.map(([c, v]) => `<div class="tr">${catHtml(c)}<span>${pct(v)}%</span></div>`).join('')}`, e.clientX, e.clientY);
  });
  $('multiples').addEventListener('mouseleave', () => { hideTip(); document.querySelectorAll('#multiples .xh').forEach(l => l.setAttribute('visibility', 'hidden')); });

  /* ==================== ПЕРЕВІРКА НА ІСТОРІЇ ==================== */
  const BT_N = 60;
  function runBacktest() {
    if (S.btBusy) return;
    S.btBusy = true;
    const T = H.TURNS, hit = T.map(() => 0), elig = T.map(() => 0);
    let acc = 0, accF = 0, cnt = 0, k = 0;
    const base = { a: 0, f: 0, c: 0 };
    for (const id of H.BLOCS) { const st = H.historyAt(id, 1900); for (let y = 1900; y <= 2025; y++) { const a = H.historyAt(id, y); base.a += st === a ? 1 : 0; base.f += H.polFam(st) === H.polFam(a) ? 1 : 0; base.c++; } }
    function chunk() {
      const t0 = performance.now();
      while (k < BT_N && performance.now() - t0 < 35) {
        const s = new H.Sim({ mode: 'history', seed: k * 977 + 13 }); s.run(); k++;
        T.forEach((tt, i) => { const r = H.checkTurn(tt, s); if (r != null) { elig[i]++; if (r) hit[i]++; } });
        for (const id of H.BLOCS) for (const x of s.blocs[id].rec) { const a = H.historyAt(id, x.y); acc += x.cat === a ? 1 : 0; accF += H.polFam(x.cat) === H.polFam(a) ? 1 : 0; cnt++; }
      }
      S.bt = { k, T, hit, elig, acc: acc / cnt, accF: accF / cnt, base: base.a / base.c, baseF: base.f / base.c };
      renderBacktest();
      if (k < BT_N) setTimeout(chunk, 0); else S.btBusy = false;
    }
    chunk();
  }
  function renderBacktest() {
    const b = S.bt; if (!b) return;
    let h = b.k < BT_N ? `<p class="muted">${esc(t('me.bt.running', { n: b.k, m: BT_N }))}</p>` : '';
    h += `<div class="scroll"><table class="bt"><thead><tr><th>${esc(t('me.bt.event'))}</th><th>${esc(t('me.bt.window'))}</th><th>${esc(t('me.bt.share'))}</th></tr></thead><tbody>`;
    b.T.forEach((tt, i) => {
      const v = b.elig[i] ? b.hit[i] / b.elig[i] : 0;
      h += `<tr><td>${esc(t('turn.' + tt.id))} <span class="muted small">· ${esc(bn(tt.bloc))}</span></td><td class="n">${tt.from}–${tt.to}</td><td class="n"><span class="meter"><i style="width:${pct(v)}%"></i></span>${pct(v)}%</td></tr>`;
    });
    h += `</tbody></table></div><p>${t('me.bt.acc', { a: pct(b.acc), b: pct(b.base), c: pct(b.accF), d: pct(b.baseF) })}</p><p class="muted">${esc(t('me.bt.read'))}</p>`;
    $('backtest').innerHTML = h;
  }

  /* ==================== НАВІГАЦІЯ ==================== */
  function placeScenario() {
    const slot = S.view === 'live' ? $('scenSlotLive') : $('scenSlotFut');
    if ($('scenario').parentNode !== slot) slot.appendChild($('scenario'));
    $('liveScen').hidden = S.mode !== 'future';
  }
  function route() {
    const v = (location.hash || '#live').slice(1);
    S.view = ['live', 'futures', 'method'].includes(v) ? v : 'live';
    for (const x of ['live', 'futures', 'method']) $('view-' + x).hidden = x !== S.view;
    document.querySelectorAll('.navl').forEach(a => { a.classList.toggle('on', a.dataset.view === S.view); a.setAttribute('aria-current', a.dataset.view === S.view ? 'page' : 'false'); });
    hideTip(); placeScenario();
    if (S.view === 'futures' && !S.fut) runFutures();
    if (S.view === 'method' && !S.bt) runBacktest();
  }
  window.addEventListener('hashchange', route);

  document.querySelectorAll('.lang').forEach(b => b.addEventListener('click', () => {
    H.lang = b.dataset.lang; store.set('lang', H.lang);
    applyStatic(); buildTimeline(); S.chronSig = ''; renderLive(); renderFut(); renderBacktest();
  }));

  /* ---------- старт ---------- */
  const sl = store.get('lang'); if (sl === 'uk' || sl === 'de') H.lang = sl;
  else if ((navigator.language || '').toLowerCase().startsWith('de')) H.lang = 'de';
  const sm = store.get('mode'); if (sm === 'history' || sm === 'future') S.mode = sm;
  const ss = +store.get('speed'); if (SPEEDS.includes(ss)) S.speed = ss;
  const sb = store.get('sel'); if (H.BLOCS.includes(sb)) S.sel = sb;
  try {
    const sc = JSON.parse(store.get('scen') || 'null');
    if (sc && sc.scen && Array.isArray(sc.conds)) { for (const k of KNOBS) if (typeof sc.scen[k] === 'number') S.scen[k] = sc.scen[k]; S.conds = sc.conds.filter(c => H.CONDS.some(d => d.id === c.id)); }
    else S.conds = defConds();
  } catch (e) { S.conds = defConds(); }
  applyStatic();
  newSim();
  route();
  requestAnimationFrame(frame);
})(window.H);
