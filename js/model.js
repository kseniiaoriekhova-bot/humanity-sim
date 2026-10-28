/* ============================================================
   Людство: рушій моделі (крок = 1 рік)
   Механізми:
   - Турчин (структурно-демографічна теорія): зубожіння мас × надлишок
     претендентів в еліту × фінансова криза держави = політичний стрес;
   - Ібн Хальдун: згуртованість (асабія) росте від загроз, слабне від нерівності;
   - Аджемоглу і Робінсон: інклюзивність інституцій, баланс держави й суспільства;
   - Вебер: легітимність із результатів, процедур і віри;
   - технологічні епохи визначають, хто володіє ключовим капіталом
     (земля → машини → дані й обчислення) і як вилучається дохід.
   Потреби → емоції → ідеології та організація → дії груп → кризи → переходи.
   ============================================================ */
(function (H) {
  'use strict';
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  H.clamp = clamp;

  H.rng = function (seed) {
    let a = seed >>> 0;
    const f = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.getState = () => a; f.setState = v => { a = v | 0; };
    return f;
  };

  const IDEOS = H.IDEOS;
  const LIBERAL = new Set(['lib', 'socdem', 'neolib', 'green', 'coop']);
  const IMPERIAL = new Set(['nat', 'soc', 'trad']);
  const MARKET = new Set(['laissez', 'welfare', 'neoliberal', 'rentier']);
  // «відстань» між ідеологіями правлячих груп (для напруги між блоками)
  function ideoDist(a, b) {
    if (a === b) return 0;
    const fam = x => LIBERAL.has(x) || x === 'tech' ? 'L' : x === 'soc' ? 'S' : x === 'nat' ? 'N' : 'T';
    const fa = fam(a), fb = fam(b);
    if (fa === fb) return 0.1;
    if ((fa === 'N' && fb === 'T') || (fa === 'T' && fb === 'N')) return 0.3;
    return 0.8;
  }

  function newGroup(src) {
    return {
      ideo: Object.assign({}, src.ideo), org: src.org || 0.2,
      needs: { mat: 0.6, sec: 0.6, status: 0.5, voice: 0.3, belong: 0.5, meaning: 0.5 },
      emo: { anger: 0.3, fear: 0.3, hope: 0.4, trust: 0.5, pride: 0.4 },
    };
  }

  /* ---------- Симуляція ---------- */
  function Sim(opts) {
    opts = opts || {};
    this.mode = opts.mode || 'history';
    this.seed = opts.seed == null ? Math.floor(Math.random() * 1e9) : opts.seed;
    this.rnd = H.rng(this.seed);
    this.useShocks = opts.shocks !== false;
    this.scen = Object.assign({ ai: 0.5, conc: 0.55, climate: 0.4, tension: 0.5, policy: 0.5 }, opts.scen || {});
    this.year = this.mode === 'history' ? 1900 : 2025;
    this.endYear = opts.endYear || (this.mode === 'history' ? 2025 : 2100);
    const start = this.mode === 'history' ? H.START_1900 : H.START_2025;
    this.blocs = {};
    for (const id of H.BLOCS) {
      const s = start[id];
      const b = Object.assign({}, s);
      b.id = id;
      b.C = newGroup(s.C); b.A = newGroup(s.A); b.E = newGroup(s.E);
      b.S = { loyal: 0.6, org: 0.5 };
      b.platPow = s.platPow || 0; b.humil = s.humil || 0; b.pride = 0.3; b.warDefeat = 0;
      b.gAvg = 0.015; b.g = 0.015; b.stagn = 0; b.cool = 0; b.yrsRegime = 10; b.demYears = b.regime === 'democracy' ? 30 : 0;
      b.expect = b.y * (1 - b.omega) / 0.55; b.elect = 1 + Math.floor(this.rnd() * 4);
      b.streak = { pref: null, n: 0 }; b.collapseYrs = 0; b.pending = null; b.war = null; b.events = [];
      b.reserve = id === 'US' && this.year >= 1945 ? 0.5 : 0;
      b.rec = [];
      this.blocs[id] = b;
    }
    this.climate = 0;
    // умовна конвергенція: стартовий розрив між потенціалом і реальним рівнем
    // (інституції, які заважають наздоганяти) скорочується лише за сильної держави й відкритості
    for (const id of H.BLOCS) { const b = this.blocs[id]; b.tfp = Math.log(b.y) - this.lnPot(b); }
    this.tension = {};
    this.wars = [];
    this.log = [];
    this.front = H.frontier(this.year, this.scen);
    this.climate = 0; this.crash = null; this.oil = 0; this.lastCats = {};
    if (this.mode === 'future') {
      // війна Росії проти України триває на старті сценарію
      const w0 = this.startWar(['RU'], ['UA'], null, 'ongoing', true);
      w0.start = 2022; w0.exh = { RU: 0.35, UA: 0.45 };   // війна триває вже понад три роки
      this.setTension('RU', 'UA', 0.95);
      this.setTension('US', 'CN', 0.55); this.setTension('EU', 'RU', 0.7); this.setTension('US', 'RU', 0.6);
    } else {
      this.setTension('EU', 'RU', 0.45); this.setTension('RU', 'UA', 0.2);
    }
    for (const id of H.BLOCS) this.lastCats[id] = H.classify(this.blocs[id]);
    this.record();
  }
  H.Sim = Sim;
  const P = Sim.prototype;

  const pk = (a, b) => [a, b].sort().join('-');
  P.getTension = function (a, b) { return this.tension[pk(a, b)] || 0; };
  P.setTension = function (a, b, v) { this.tension[pk(a, b)] = clamp(v); };
  P.emit = function (bloc, key, p, kind) {
    const e = { year: this.year, bloc, key, p: p || {}, kind: kind || 'event' };
    this.log.push(e);
    if (bloc && this.blocs[bloc]) { this.blocs[bloc].events.push(e); }
    if (this.log.length > 3000) this.log.shift();
    return e;
  };
  P.avail = function (id) { return H.ideoAvail(id, this.year); };
  P.power = function (b) {
    return Math.pow(b.pop, 0.55) * Math.pow(b.y, 0.8) * (0.3 + b.cap) * (b.regime === 'collapse' ? 0.3 : 1) * (b.war ? 1.4 : 1);
  };

  /* ---------- Один рік ---------- */
  P.step = function () {
    this.year++;
    const year = this.year;
    this.front = H.frontier(year, this.scen);
    for (const id of H.BLOCS) { const b = this.blocs[id]; b.shockG = 0; b.famine = 0; b.events = []; if (id === 'US' && year >= 1945) b.reserve = 0.5; }
    this.applyShocks();
    if (this.mode === 'future' || !this.useShocks) this.randomShocks();
    const wRef = Math.max(...H.BLOCS.map(id => { const b = this.blocs[id]; return b.y * (1 - b.omega) / 0.55; }));
    this.frontY = Math.max(...H.BLOCS.map(id => this.blocs[id].y));
    for (const id of H.BLOCS) this.economy(this.blocs[id], wRef);
    for (const id of H.BLOCS) this.society(this.blocs[id]);
    for (const id of H.BLOCS) this.politics(this.blocs[id]);
    this.interBloc();
    for (const id of H.BLOCS) this.crisis(this.blocs[id]);
    if (this.crash && ++this.crash.t > this.crash.len + 6) this.crash = null;
    if (this.oil > 0) this.oil--;
    this.record();
  };
  P.run = function (toYear) { while (this.year < (toYear || this.endYear)) this.step(); };

  /* ---------- Шоки ---------- */
  P.applyShocks = function () {
    if (!this.useShocks || this.mode !== 'history') return;
    const year = this.year;
    for (const s of H.SHOCKS) {
      if (s.year !== year) continue;
      if (s.type === 'war') this.startWar(s.sides[0], s.sides[1], s.until, s.key, true);
      else if (s.type === 'joinwar') { const w = this.wars.find(w => w.key && (w.key === 'ww1' || w.key === 'ww2') && !w.ended); if (w) { w.sides[s.side].push(s.bloc); this.blocs[s.bloc].war = w; this.emit(s.bloc, 'ev.joinWar', {}, 'war'); } }
      else if (s.type === 'pandemic') { for (const id of H.BLOCS) { const b = this.blocs[id]; b.pop *= 1 - s.sev; b.shockG -= s.gdp || 0.02; b.debt += s.key === 'covid' ? 0.12 * (b.cap) : 0; } this.emit(null, 'ev.pandemic', { sev: s.sev }, 'shock'); }
      else if (s.type === 'crash') { this.crash = { sev: s.sev, len: s.len, t: 1 }; this.emit(null, 'ev.crash', { key: s.key }, 'shock'); }
      else if (s.type === 'oil') { this.oil = 6; this.emit(null, 'ev.oil', {}, 'shock'); }
      else if (s.type === 'invasion') { const b = this.blocs[s.bloc]; this.startWar([s.bloc], ['JP'], s.until, s.key, true); this.emit(s.bloc, 'ev.invasion', {}, 'war'); }
      else if (s.type === 'tension') { this.setTension(s.a, s.b, s.val); this.emit(s.b, 'ev.crimea', {}, 'war'); }
    }
  };
  P.randomShocks = function () {
    const r = this.rnd, year = this.year;
    if (r() < 0.012) { const sev = 0.004 + r() * 0.02; for (const id of H.BLOCS) { const b = this.blocs[id]; b.pop *= 1 - sev; b.shockG -= 0.03; b.debt += 0.06 * b.cap; } this.emit(null, 'ev.pandemicR', {}, 'shock'); }
    const meanDebt = H.BLOCS.reduce((s, id) => s + this.blocs[id].debt, 0) / 6;
    if (!this.crash && r() < 0.018 + 0.03 * clamp(meanDebt - 0.8)) { this.crash = { sev: 0.05 + r() * 0.15, len: 2, t: 1 }; this.emit(null, 'ev.crashR', {}, 'shock'); }
    if (year > 2025) {
      this.climate = clamp(this.scen.climate * (year - 2025) / 60, 0, 1.2);
      if (r() < 0.02 + 0.08 * this.climate) {
        const id = H.BLOCS[Math.floor(r() * 6)], b = this.blocs[id];
        b.shockG -= 0.02 + 0.05 * this.climate * (id === 'GS' ? 1.5 : 1); b.famine = id === 'GS' ? 0.3 * this.climate : 0.1 * this.climate;
        this.emit(id, 'ev.climate', {}, 'shock');
        // кліматична міграція посилює націоналізм у багатих блоках
        for (const o of ['US', 'EU']) this.blocs[o].C.ideo.nat += 0.01 * this.climate;
      }
    }
  };

  /* ---------- Економіка ---------- */
  P.economy = function (b, wRef) {
    const O = H.ORDERS[b.order], R = H.REGIMES[b.regime], fr = this.front, year = this.year;
    const capF = 0.25 + b.cap, sovF = b.sov < 0.5 ? 0.65 : 1;
    const mI = { planned: 1.9, statecap: 1.4, agrarian: 0.45, subsistence: 0.1, laissez: 1.6, welfare: 1.6, neoliberal: 1.6, rentier: 1.5 }[b.order] || 1;
    const mD = { planned: 0.35, statecap: 1.0, agrarian: 0.4, subsistence: 0.1, rentier: 1.4, neoliberal: 1.2, laissez: 1.1 }[b.order] || 1;
    b.I += (fr.I - b.I) * clamp(0.075 * mI * Math.pow(0.15 + b.cap, 1.2) * sovF);
    b.D += (fr.D - b.D) * clamp(0.11 * mD * capF * sovF * (b.I > 0.4 ? 1 : 0.3));
    b.AI += (fr.A - b.AI) * clamp(0.1 * mD * capF * (b.D > 0.5 ? 1 : 0.2));
    b.urban += ((0.08 + 0.78 * b.I) - b.urban) * 0.03;
    const eduT = 0.12 + 0.78 * b.I + 0.1 * b.cap + (b.order === 'planned' ? 0.1 : 0);
    if (eduT > b.edu) b.edu += (eduT - b.edu) * 0.03;
    b.edu = clamp(b.edu, 0, 0.97);

    // потенційний рівень життя
    // планова економіка добре наздоганяє в індустріальну епоху, але не в цифрову
    const planF = clamp(0.6 * (1 - 3 * fr.D));
    const catchUp = 0.003 + 0.035 * b.cap * (MARKET.has(b.order) ? 1 : b.order === 'statecap' ? 0.7 : b.order === 'planned' ? planF : 0.25) * (b.sov < 0.5 ? 0.5 : 1);
    if (b.tfp < 0) b.tfp += -b.tfp * catchUp * (b.convF || 1);
    let lnPot = this.lnPot(b) + Math.min(0, b.tfp);
    // фінансова криза — тривалий провал попиту: знижує досяжний рівень на кілька років
    if (this.crash) {
      const c = this.crash, depth = c.t <= c.len ? c.sev * c.t / c.len : c.sev * Math.max(0, 1 - (c.t - c.len) / 6);
      lnPot -= depth * (MARKET.has(b.order) ? (b.id === 'GS' ? 0.7 : 1) : b.order === 'statecap' ? 0.5 : b.order === 'planned' ? 0 : 0.6);
    }
    let g = (lnPot - Math.log(b.y)) * 0.06 + b.shockG;
    if (this.oil > 0 && MARKET.has(b.order) && (b.id === 'US' || b.id === 'EU')) { g -= 0.012; b.defBias += 0.003; }
    if (b.war) g -= 0.03 * (b.war.intensity || 1);
    g = clamp(g, -0.3, 0.12);
    b.y *= Math.exp(g); b.g = g; b.gAvg += (g - b.gAvg) * 0.15;
    // застій — відставання від світового фронту, що наростає
    b.gapHist = b.gapHist || [];
    const gap = Math.log(this.frontY || b.y) - Math.log(b.y);
    b.gapHist.push(gap); if (b.gapHist.length > 10) b.gapHist.shift();
    const widening = b.gapHist.length >= 10 && gap - b.gapHist[0] > 0.04;
    b.stagn = widening || b.gAvg < 0.008 ? b.stagn + 1 : Math.max(0, b.stagn - 2);
    const popR = 0.004 + 0.016 * (1 - b.urban) + (b.id === 'US' ? 0.005 : 0) - (b.war ? 0.006 * (b.war.intensity || 1) : 0) - b.famine * 0.05;
    b.pop *= 1 + popR;

    // платформна рента і сила власників платформ
    const antitrust = b.regime === 'oneparty' ? 0.75 : b.regime === 'technocorp' ? 0 : 0.12 + 0.35 * b.inc * (['socdem', 'green', 'coop'].includes(b.gov) ? 1 : 0.4) + (b.id === 'EU' && year > 2015 ? 0.2 : 0) + 0.25 * (this.scen.policy - 0.5);
    b.platRent = b.D * this.scen.conc * clamp(1 - antitrust) * (0.4 + 0.6 * b.AI + 0.4 * b.D);
    const grip = { oneparty: 0.85, autocracy: 0.6, junta: 0.6, theocracy: 0.6 }[b.regime] || 0;
    b.platPow += (b.platRent * b.digSov * (1 - grip) * (b.techAlly ? 1.4 : 1) - b.platPow) * 0.08;
    b.autoPress = b.AI * clamp(1 - O.welfare * 3);
    const target = O.omega + 0.25 * b.platRent * b.digSov + 0.12 * b.autoPress - 0.1 * b.C.org * b.inc - (b.regime === 'council' ? 0.05 : 0);
    b.omega = clamp(b.omega + (target - b.omega) * 0.06, 0.18, 0.75);

    // добробут більшості і очікування
    const w = b.y * (1 - b.omega) / 0.55;
    const ex = 0.1 + 0.5 * b.D + 0.15 * b.urban + 0.15 * b.edu;     // наскільки люди бачать, як живуть деінде
    // неприйняття втрат: до кращого звикають швидко, з гіршим миряться повільно
    const adapt = w > b.expect ? 0.1 : 0.035;
    const ref = w * Math.pow(Math.max(1, wRef / w), 0.3);           // «досяжне» порівняння з багатшими
    b.expect += adapt * (w * 1.01 - b.expect) + 0.008 * ex * (ref - b.expect);
    b.w = w; b.matRatio = w / b.expect;

    // надлишок претендентів у еліту
    const eoT = clamp(0.1 + 1.4 * (b.omega - 0.35) + 0.25 * b.edu + 0.2 * b.D + 6 * (0.025 - b.gAvg));
    b.eo += (eoT - b.eo) * 0.07;

    // держфінанси
    const war = b.war ? 0.1 * (b.war.intensity || 1) : 0;
    const interest = b.order === 'planned' ? 0 : 0.025 * b.debt;
    const polBias = (['democracy', 'hybrid', 'oligarchy'].includes(b.regime) ? 0.015 : 0.005) + (this.year > 2025 ? (H.AGING[b.id] || 0) * 0.04 * Math.min(1, (this.year - 2025) / 40) : 0);   // виборчий цикл і пенсії тягнуть до дефіцитів
    b.def = b.defBias + polBias + interest - O.tax * (b.cap - 0.6) * 0.1 + war + (b.cool > 3 ? 0.02 : 0) + O.welfare * 0.04 * b.AI;
    const infl = this.oil > 0 ? 0.06 : b.order === 'planned' ? 0 : 0.02;   // інфляція «з'їдає» борг
    b.debt = clamp(b.debt + b.def - (g + infl) * b.debt, 0, 4);
    b.defBias *= b.war ? 0.995 : 0.97;
    if (this.oil > 0) b.defBias += 0;
  };

  P.lnPot = function (b) {
    const O = H.ORDERS[b.order];
    let v = 1.064 + 1.9 * b.I + 0.7 * b.D + 0.9 * b.AI + 0.6 * b.edu + O.eff + 0.4 * (b.cap - 0.5) - Math.max(0, b.omega - 0.5) * 1.5;
    if (b.order === 'planned') v -= 1.2 * Math.max(0, b.I + 2 * this.front.D - 0.8) + 1.2 * Math.max(0, this.front.D - b.D);  // план не встигає за складністю економіки
    if (b.war) v -= 0.12 * (b.war.intensity || 1);
    if (b.regime === 'collapse') v -= 0.5;
    if (b.sov < 0.5) v -= 0.15;                                                   // вилучення колонією / імперією
    v -= 0.35 * this.climate * (b.id === 'GS' ? 1.4 : b.id === 'RU' || b.id === 'UA' ? 0.6 : 1);
    // старіння населення після 2025: менше працівників, більше пенсіонерів
    if (this.year > 2025) v -= (H.AGING[b.id] || 0) * Math.min(1, (this.year - 2025) / 50);
    return v;
  };

  /* ---------- Суспільство: потреби, емоції, організація, ідеології ---------- */
  P.society = function (b) {
    const R = H.REGIMES[b.regime], O = H.ORDERS[b.order], r = this.rnd;
    const C = b.C, A = b.A, E = b.E, S = b.S;
    const surv = R.surv * b.D + R.rep * 0.25;
    b.surv = surv;
    const matC = clamp((b.matRatio - 0.75) / 0.35);
    const inWar = b.war ? 1 : 0, col = b.regime === 'collapse' ? 1 : 0;
    // потреби
    C.needs.mat = matC;
    C.needs.sec = clamp(1 - inWar * 0.45 - col * 0.55 - b.rep * 0.3 - b.autoPress * 0.4 - b.famine - Math.max(0, -b.gAvg) * 8);  // спад = страх безробіття
    C.needs.status = clamp(1 - (b.omega - 0.25) * 1.6);
    C.needs.voice = b.inc;
    C.needs.belong = b.coh;
    C.needs.meaning = clamp(0.3 + (C.ideo[b.gov] || 0) * 1.5);
    A.needs.mat = 0.5 + 0.5 * matC;
    A.needs.sec = C.needs.sec + 0.1;
    A.needs.status = clamp(1 - b.eo);
    A.needs.voice = b.inc;
    A.needs.belong = b.coh;
    A.needs.meaning = clamp(0.3 + (A.ideo[b.gov] || 0) * 1.5);
    E.needs.mat = 0.9; E.needs.status = clamp(b.omega / 0.5);
    E.needs.sec = clamp(1 - C.emo.anger * C.org * (1 - b.rep) * 1.5 - inWar * 0.3 - col * 0.6);
    E.needs.voice = clamp(1 - b.inc * (['socdem', 'soc', 'coop'].includes(b.gov) ? 0.7 : 0.3));
    E.needs.belong = b.eCoh; E.needs.meaning = clamp(0.3 + (E.ideo[b.gov] || 0) * 1.5);

    // емоції (з інерцією)
    const sm = (o, k, v, a = 0.35) => { o[k] += (clamp(v) - o[k]) * a; };
    const injustice = Math.max(0, b.omega - 0.35) * (0.2 + b.D * 0.8) + b.humil * 0.3 + (b.sov < 0.5 ? 0.2 : 0)
      + (b.order === 'agrarian' ? 0.15 * (1 - b.urban) : 0)                 // земельний голод селян
      + 0.4 * b.warDefeat + (b.war ? 0.25 * clamp(b.war.exh[b.id] || 0) * (b.war.sides[1].includes(b.id) ? 0.3 : 1) : 0);   // гнів захисників спрямований на агресора, а не на власну владу
    const altAppeal = this.altAppeal(b);
    sm(C.emo, 'anger', (1 - C.needs.mat) * 0.7 + (1 - C.needs.status) * 0.25 + (1 - C.needs.voice) * 0.18 * (0.3 + b.edu) + injustice);
    sm(C.emo, 'fear', (1 - C.needs.sec) * 0.9 + b.rep * 0.25 + b.autoPress * 0.25);
    sm(C.emo, 'hope', 0.35 + b.gAvg * 10 + altAppeal * 0.25 - (1 - C.needs.mat) * 0.3 + (b.sov < 0.5 ? -0.1 : 0));
    sm(C.emo, 'trust', b.legit);
    sm(C.emo, 'pride', b.coh * 0.5 + b.pride * 0.5 - b.humil * 0.5);
    sm(A.emo, 'anger', (1 - A.needs.status) * 0.8 + (1 - A.needs.voice) * 0.25 + injustice * 0.6);
    sm(A.emo, 'fear', (1 - A.needs.sec) * 0.8 + b.rep * 0.3);
    sm(A.emo, 'hope', 0.4 + b.gAvg * 8 + altAppeal * 0.35 - b.eo * 0.3);
    sm(A.emo, 'trust', b.legit * (1 - b.eo * 0.4));
    sm(A.emo, 'pride', C.emo.pride);
    sm(E.emo, 'fear', (1 - E.needs.sec) + (b.inc > 0.5 && ['socdem', 'soc'].includes(b.gov) ? 0.15 : 0));
    sm(E.emo, 'anger', (1 - E.needs.voice) * 0.6 + (1 - E.needs.status) * 0.4);
    sm(E.emo, 'hope', 0.5 + b.gAvg * 8);
    sm(E.emo, 'trust', b.legit * 0.5 + E.needs.voice * 0.5);
    sm(E.emo, 'pride', b.pride);

    // організація
    const orgT = clamp(0.1 + 0.5 * C.emo.anger + 0.35 * b.urban + 0.15 * b.D * (1 - surv) + 0.15 * b.inc + 0.1 * b.edu - 0.25 * C.emo.fear - O.atom - 0.3 * surv);
    C.org += (orgT - C.org) * 0.07 + (b.strain || 0) * 0.04;   // фронт організовує солдатів
    const aOrgT = clamp(0.15 + 0.8 * b.eo * A.emo.anger + 0.2 * b.edu + 0.15 * b.D - 0.25 * surv);
    A.org += (aOrgT - A.org) * 0.08;
    const loyalT = clamp(0.55 + 0.4 * (1 - b.sfd || 0) * 0.5 + 0.2 * b.legit - 0.35 * b.warDefeat - (b.sov < 0.5 ? 0.1 : 0));
    S.loyal += (loyalT - S.loyal) * 0.15;
    S.org = clamp(0.3 + 0.5 * b.cap);

    // згуртованість (асабія) і згуртованість еліт
    const threat = b.war ? 0.6 : Math.max(...H.BLOCS.filter(o => o !== b.id).map(o => this.getTension(b.id, o))) * 0.4;
    b.coh = clamp(b.coh + 0.03 * (0.15 + threat * 0.5 + b.pride * 0.2 - (b.omega - 0.3) * 0.8 - b.D * 0.12 - b.coh * 0.5));
    const eCohT = clamp(0.62 + 0.25 * threat - 0.6 * b.eo - 0.15 * b.D * (1 - surv) - 0.25 * clamp(b.stagn / 15) + (E.emo.fear > 0.6 ? 0.1 : 0));
    b.eCoh += (eCohT - b.eCoh) * 0.06;

    // ідеології
    this.drift(b);
    b.pride *= 0.95; b.humil *= b.sov < 0.5 ? 0.99 : 0.97; b.warDefeat *= 0.75;
  };

  // наскільки привабливі «чужі моделі» (успішні блоки з іншою ідеологією правлячої групи)
  P.altAppeal = function (b) {
    let best = 0;
    const maxP = Math.max(...H.BLOCS.map(id => this.power(this.blocs[id])));
    for (const id of H.BLOCS) {
      const o = this.blocs[id]; if (o === b || o.gov === b.gov) continue;
      const s = clamp(o.gAvg * 25) * o.legit * Math.sqrt(this.power(o) / maxP);
      best = Math.max(best, s);
    }
    return best;
  };

  P.drift = function (b) {
    const C = b.C, A = b.A, E = b.E, av = id => this.avail(id), year = this.year;
    const maxP = Math.max(...H.BLOCS.map(id => this.power(this.blocs[id])));
    const exposure = 0.05 + 0.45 * b.D + 0.15 * b.urban + 0.1 * b.edu;
    const socAppeal = H.BLOCS.some(id => this.blocs[id].gov === 'soc' && this.blocs[id].gAvg > 0.03) ? 0.6 : 0.2;
    const warThreat = b.war ? 0.6 : 0;
    const media = 1 + b.D * 0.6;   // соцмережі прискорюють поляризацію гніву й страху
    const apply = (grp, d, rate) => {
      // дифузія: «успішні моделі» інших блоків притягують
      for (const id of H.BLOCS) {
        const o = this.blocs[id]; if (o === b) continue;
        const s = clamp(o.gAvg * 25) * o.legit * Math.sqrt(this.power(o) / maxP);
        d[o.gov] = (d[o.gov] || 0) + 0.012 * exposure * s;
      }
      let sum = 0;
      for (const k of IDEOS) {
        const a = av(k);
        let v = grp.ideo[k] + rate * ((d[k] || 0) - grp.ideo[k] * 0.06);
        v = a <= 0 ? 0 : Math.max(0.004 * a, v);
        if (a < 1) v = Math.min(v, a * 0.6);
        grp.ideo[k] = v; sum += v;
      }
      for (const k of IDEOS) grp.ideo[k] /= sum;
    };
    const dC = {
      // виснаження війною й земельний голод штовхають до антивоєнного соціалізму («мир, земля, хліб»)
      soc: av('soc') * C.emo.anger * (C.emo.hope * 0.5 + (b.strain || 0) * 1.2 + b.warDefeat * 0.6 + (b.order === 'agrarian' ? 0.25 : 0)) * 0.6 * (0.4 + socAppeal) * (b.inc > 0.6 ? 0.5 : 1),
      socdem: (C.emo.anger * 0.5 * (b.inc + 0.2) + 0.15 * C.emo.trust) * 0.45,
      // масовий націоналізм — явище міського, письменного суспільства
      nat: (C.emo.anger * C.emo.fear * 0.9 * (1 - (b.strain || 0)) + b.humil * 0.5 + warThreat * 0.3 * (1 - (b.strain || 0) * 2) + (b.sov < 0.5 ? 0.3 : 0)) * media * 0.5 * (0.35 + 0.65 * Math.max(b.urban, b.edu * 0.8)),
      rel: C.emo.fear * (1 - b.edu) * 0.35,
      trad: (b.regime === 'autocracy' && b.gov === 'trad' ? 0.25 : 0) * (1 - b.urban) * (1 - b.edu) * (this.year < 1914 ? 1 : 0.5),
      lib: (C.emo.trust * C.emo.hope * 0.7 + b.inc * 0.15) * 0.5,
      neolib: av('neolib') * 0.12 * C.emo.trust,
      tech: av('tech') * b.D * C.emo.hope * 0.18,
      green: av('green') * (this.climate * 0.6 + b.edu * 0.1),
      coop: av('coop') * C.emo.anger * C.emo.hope * b.D * 0.15,
    };
    apply(C, dC, 0.5);
    const revFear = C.emo.anger * C.org;
    const dA = {
      soc: av('soc') * A.emo.anger * (b.eo + (b.strain || 0)) * 1.0 * (0.4 + socAppeal),
      nat: (A.emo.anger * A.emo.fear * 0.8 + b.humil * 0.5 + warThreat * 0.3) * media * 0.5,
      lib: A.emo.hope * 0.4 + b.inc * 0.1,
      socdem: A.emo.anger * b.inc * 0.3,
      tech: av('tech') * b.D * 0.4,
      green: av('green') * (0.15 * b.edu + this.climate * 0.6),
      coop: av('coop') * A.emo.anger * b.D * 0.3,
      neolib: av('neolib') * 0.1,
      rel: A.emo.fear * (1 - b.edu) * 0.2,
    };
    apply(A, dA, 0.5);
    const dE = {
      nat: revFear * 0.9 + b.humil * 0.3 + warThreat * 0.2,
      lib: 0.25 + b.inc * 0.25,
      neolib: av('neolib') * (0.3 + (b.sfd || 0) * 0.6 + (b.order === 'welfare' ? 0.15 : 0)),
      tech: av('tech') * b.platPow * 1.5,
      trad: b.gov === 'trad' ? 0.4 * (1 - b.urban) : 0,
      soc: b.gov === 'soc' && b.regime === 'oneparty' ? 0.7 : 0,
      socdem: (b.war ? 0.15 : 0) + (b.order === 'welfare' ? 0.1 : 0),
      rel: 0.05,
    };
    apply(E, dE, 0.4);
  };

  /* ---------- Політика: легітимність, вибори, курс, ерозія ---------- */
  P.politics = function (b) {
    const C = b.C, A = b.A, E = b.E, R = H.REGIMES[b.regime], year = this.year, r = this.rnd;
    b.yrsRegime++; if (b.cool > 0) b.cool--;
    if (b.regime === 'democracy') b.demYears++;
    // фінансовий стрес держави
    const dr = clamp(b.debt / (0.6 + 1.6 * b.cap + (b.reserve || 0) + (b.aid || 0) * 1.5));   // зовнішня допомога розширює фінансові можливості
    b.aid = (b.aid || 0) * 0.8;
    b.sfd = clamp(0.75 * dr + 0.25 * clamp(b.def * 5));
    // легітимність
    const perf = clamp(0.5 + b.gAvg * 12) * 0.5 + C.needs.mat * 0.5;
    let proc;
    switch (b.regime) {
      case 'democracy': case 'council': proc = b.inc * (0.4 + 0.6 * clamp(b.demYears / 40)); break;  // молода демократія тримається на результатах
      case 'oligarchy': case 'hybrid': proc = 0.25 + 0.5 * b.inc; break;
      case 'autocracy': proc = C.ideo.trad + C.ideo.rel * 0.5 + C.ideo.nat * (b.gov === 'nat' ? 0.8 : 0.2); break;
      case 'oneparty': proc = 0.1 + (C.ideo[b.gov] || 0) * 1.3; break;
      case 'junta': proc = 0.15 + C.ideo.nat * 0.6; break;
      case 'theocracy': proc = C.ideo.rel * 1.2; break;
      case 'technocorp': proc = 0.2 + C.ideo.tech + C.needs.mat * 0.2; break;
      default: proc = 0;
    }
    b.strain = b.war ? clamp((b.war.exh[b.id] || 0) - 0.3) : 0;     // виснаження війною
    const tgt = 0.15 + 0.4 * perf + 0.3 * clamp(proc) + 0.15 * b.coh + 0.1 * b.pride - 0.2 * b.humil - (b.sov < 0.5 ? 0.25 : 0) - 0.35 * b.warDefeat - 0.35 * b.strain;
    b.legit += (clamp(tgt) - b.legit) * 0.12;

    if (b.sov < 0.5 || b.regime === 'collapse') return;   // підпорядковані й розпалі блоки не обирають курс

    // вибори
    if (['democracy', 'hybrid', 'oligarchy', 'technocorp', 'council'].includes(b.regime)) {
      // оборонна війна: вибори відкладаються (воєнний стан)
      const defending = b.war && b.war.sides[1].includes(b.id);
      if (!defending) b.elect--;
      if (b.elect <= 0) { b.elect = b.regime === 'hybrid' ? 5 : 4; this.election(b); }
    }
    // ерозія або відновлення демократії
    if (b.regime === 'democracy' || b.regime === 'hybrid') {
      const instStr = clamp(b.demYears / 60) * 0.6 + E.ideo.lib * 0.3 + C.org * 0.2;
      if (b.gov === 'nat' || b.gov === 'tech') {
        // радикальні націоналісти з підтримкою еліт руйнують молоду демократію швидко
        b.inc -= 0.06 * (1 - instStr) * (C.ideo.nat + E.ideo.nat + E.emo.fear * 0.3) * (0.5 + C.emo.anger);
        if (b.gov === 'nat' && E.ideo.tech > 0.18) { b.techAlly = true; }
      } else if (LIBERAL.has(b.gov)) b.inc += 0.006 * (0.85 - b.inc);
      if (b.regime === 'democracy' && b.inc < 0.44) this.transition(b, { regime: 'hybrid' }, 'erosion', this.causes(b));
      else if (b.regime === 'hybrid' && b.inc > 0.56) this.transition(b, { regime: 'democracy' }, 'redemocratize', this.causes(b));
      else if (b.regime === 'hybrid' && b.inc < 0.18) this.transition(b, { regime: 'autocracy' }, 'autocratize', this.causes(b));
    }
    if (b.regime === 'oligarchy') {
      // хвилі демократизації: після світових воєн і після 1989 року
      const wave = (year >= 1918 && year <= 1925 ? 0.02 : 0) + (year >= 1945 && year <= 1952 ? 0.03 : 0) + (year >= 1989 && year <= 1996 ? 0.02 : 0);
      b.inc += 0.012 * (C.org - 0.25) + 0.002 + wave * (0.5 + C.org);
      if (b.inc >= 0.5) this.transition(b, { regime: 'democracy' }, 'suffrage', this.causes(b));
    }
    if (b.regime === 'technocorp') b.inc = clamp(b.inc - 0.004 + 0.01 * (C.org - 0.4));
    b.inc = clamp(b.inc, 0.02, 0.97);
    if (!['democracy', 'hybrid', 'oligarchy', 'technocorp', 'council'].includes(b.regime)) b.inc += (R.inc - b.inc) * 0.2;
    b.rep += (R.rep - b.rep) * 0.1;

    // реформа «згори» у плановій економіці, що застоюється (Китай 1978): рішення згуртованої верхівки
    // зміна покоління вождів в однопартійній державі: момент, коли курс переглядають (1953, 1976, 1985)
    if (b.order === 'planned' && b.regime === 'oneparty' && b.yrsRegime > 15 && r() < 0.06) {
      const gap = Math.log(this.frontY / b.y);
      this.emit(b.id, 'ev.succession', {}, 'election');
      if ((gap > 0.7 || b.stagn > 3) && r() < 0.55) {
        if (b.eCoh > 0.5) { b.stagn = 0; b.reformed = true; b.legit = clamp(b.legit + 0.1); this.transition(b, { order: 'statecap' }, 'reformAbove', this.causes(b)); return; }
        if (r() < 0.5) { const ideo = C.ideo.nat + A.ideo.nat > C.ideo.lib + A.ideo.lib ? 'nat' : 'lib'; b.eo *= 0.6; b.y *= 0.92; this.transition(b, { regime: 'hybrid', order: 'neoliberal', gov: ideo, inc: 0.45 }, 'opening', this.causes(b)); return; }
      }
      b.yrsRegime = 5;
    }
    if (b.order === 'planned' && b.stagn > 5) {
      const gap = Math.log(this.frontY / b.y);
      const pr = 0.05 * clamp(b.stagn / 12) + 0.03 * clamp(gap - 1.0);   // застій або усвідомлена відсталість
      if (r() < pr * b.eCoh) {
        b.stagn = 0; b.reformed = true; b.legit = clamp(b.legit + 0.1);
        this.transition(b, { order: 'statecap' }, 'reformAbove', this.causes(b));
        return;
      }
      // розколота верхівка відкриває систему (перебудова) — і часто втрачає контроль
      if (r() < pr * (1 - b.eCoh) * 1.6 * (0.3 + C.ideo.lib + A.ideo.lib + A.ideo.nat)) {
        const ideo = C.ideo.nat + A.ideo.nat > C.ideo.lib + A.ideo.lib ? 'nat' : 'lib';
        b.eo *= 0.6; b.y *= 0.92;
        this.transition(b, { regime: 'hybrid', order: 'neoliberal', gov: ideo, inc: 0.45 }, 'opening', this.causes(b));
        return;
      }
    }
    // курс економіки
    const pref = H.prefOrder(b.gov, b, year);
    if (pref !== b.order && this.orderFeasible(b, pref)) {
      if (b.streak.pref === pref) b.streak.n++; else b.streak = { pref, n: 1 };
      const need = ['democracy', 'council'].includes(b.regime) ? (b.cool > 0 ? 2 : 4) : 2;
      // старі еліти гальмують перерозподільчі реформи
      const resist = (pref === 'welfare' || pref === 'commons') ? E.needs.voice * (b.omega - 0.3) : 0;
      if (b.streak.n >= need && r() > resist) {
        const from = b.order; b.order = pref; b.streak = { pref: null, n: 0 };
        this.emit(b.id, 'ev.order', { from, to: pref, gov: b.gov }, 'order');
        if (pref === 'neoliberal') b.defBias *= 0.6;
        if (pref === 'welfare') b.cap = clamp(b.cap + 0.05);
      }
    } else b.streak = { pref: null, n: 0 };
    // держава зміцнюється з часом, слабне в розпаді
    const capT = Math.min(0.88, 0.3 + 0.5 * b.I + 0.1 * b.legit);
    b.cap = clamp(b.cap + (capT - b.cap) * 0.02 - (b.sfd > 0.8 ? 0.01 : 0));
  };

  P.orderFeasible = function (b, o) {
    if (o === 'planned') return b.regime === 'oneparty';
    if (o === 'commons') return b.D > 0.45 && (b.regime === 'council' || b.C.ideo.coop > 0.15);
    if (o === 'rentier') return b.D > 0.5 && b.platPow > 0.3;
    if (o === 'neoliberal') return this.avail('neolib') > 0.5;
    if (o === 'welfare') return b.cap > 0.3 && b.I > 0.35;
    if (o === 'agrarian') return b.I < 0.5;
    return true;
  };

  P.election = function (b) {
    const C = b.C, A = b.A, E = b.E, r = this.rnd;
    const wC = 0.7 * b.inc + 0.1, wA = 0.2, wE = 0.1 + 0.3 * (1 - b.inc);
    const party = k => ({ trad: 'nat', rel: 'nat', coop: 'socdem', green: b.year > 1990 ? 'green' : 'socdem', soc: b.inc > 0.5 ? 'socdem' : 'soc', neolib: 'lib' }[k] || k);
    const votes = {};
    for (const k of IDEOS) {
      const v = wC * C.ideo[k] + wA * A.ideo[k] + wE * E.ideo[k];
      const p = party(k); votes[p] = (votes[p] || 0) + v;
    }
    // рахунок за результати: при поганих справах правлячі втрачають
    const incumbent = b.gov === 'neolib' ? 'lib' : b.gov;
    if (votes[incumbent] != null) {
      const perf = clamp(0.5 + b.gAvg * 15) * 0.5 + C.needs.mat * 0.5;
      votes[incumbent] *= (b.regime === 'hybrid' ? 1.5 : 0.75) + 0.6 * perf;
    }
    if (b.regime === 'technocorp') votes.tech = (votes.tech || 0) + 0.4;
    let tot = 0; const keys = Object.keys(votes);
    for (const k of keys) { votes[k] = Math.pow(votes[k], 3); tot += votes[k]; }
    let x = r() * tot, win = keys[0];
    for (const k of keys) { x -= votes[k]; if (x <= 0) { win = k; break; } }
    // ліберальна перемога у «неоліберальну епоху» — коли еліти тягнуть у цей бік
    if (win === 'lib' && this.avail('neolib') > 0.8 && E.ideo.neolib > E.ideo.lib * 0.6) win = 'neolib';
    if (win === 'green' && b.regime !== 'council') win = 'socdem';
    if (win !== b.gov) {
      const from = b.gov; b.gov = win;
      this.emit(b.id, 'ev.election', { from, to: win }, 'election');
      if (b.regime === 'hybrid' && LIBERAL.has(win)) b.inc += 0.1;
    }
  };

  /* ---------- Відносини між блоками: напруга, війни, суверенітет ---------- */
  P.interBloc = function () {
    const ids = H.BLOCS, r = this.rnd, year = this.year;
    const pw = {}; for (const id of ids) pw[id] = this.power(this.blocs[id]);
    // війни, що тривають
    for (const w of this.wars) if (!w.ended) this.warYear(w, pw);
    this.wars = this.wars.filter(w => !w.ended || year - w.endYear < 2);
    // напруга
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = this.blocs[ids[i]], b = this.blocs[ids[j]];
      if (a.sov < 0.5 || b.sov < 0.5) continue;
      const natA = (a.C.ideo.nat + a.E.ideo.nat) / 2, natB = (b.C.ideo.nat + b.E.ideo.nat) / 2;
      const ratio = Math.min(pw[a.id], pw[b.id]) / Math.max(pw[a.id], pw[b.id]);
      const transition = ratio > 0.55 ? 0.25 * ratio : 0;
      const claim = (b.claim === a.id && IMPERIAL.has(a.gov)) || (a.claim === b.id && IMPERIAL.has(b.gov)) ? 0.55 : 0;
      const demPeace = H.REGIMES[a.regime].fam === 'democratic' && H.REGIMES[b.regime].fam === 'democratic' ? 0.9 : 0;
      const trade = MARKET.has(a.order) && MARKET.has(b.order) ? 0.25 * Math.min(a.I, b.I) : 0.05;
      const geo = { 'EU-RU': 0.15, 'RU-UA': 0.2, 'CN-US': 0.1, 'CN-RU': 0.05 }[pk(a.id, b.id)] || -0.1;
      const scen = this.mode === 'future' ? (this.scen.tension - 0.5) * 0.4 : 0;
      const eq = clamp(ideoDist(a.gov, b.gov) * 0.45 + (natA + natB) * 0.5 + transition + claim + geo + scen - demPeace - trade);
      const k = pk(a.id, b.id);
      this.tension[k] = clamp((this.tension[k] || 0) + (eq - (this.tension[k] || 0)) * 0.08);
      // нова війна
      const busy = a.war || b.war;
      if (busy || a.regime === 'collapse' || b.regime === 'collapse') continue;
      const nuke = H.NUKES[a.id] && H.NUKES[b.id] && year >= Math.max(H.NUKES[a.id], H.NUKES[b.id]);
      let p = clamp((this.tension[k] - 0.62) * 0.25) * (nuke ? 0.03 : 1);
      if (this.useShocks && this.mode === 'history' && year < 2025 && !claim) p *= 0.15;   // великі війни ХХ ст. задано шоками
      if (r() < p) {
        const aggr = natA * pw[a.id] > natB * pw[b.id] ? a : b, def = aggr === a ? b : a;
        this.startWar([aggr.id], [def.id], null, claim ? 'reconquest' : 'war', false);
      }
    }
    // суверенітет: незалежність, деколонізація
    for (const id of ids) {
      const b = this.blocs[id];
      if (!b.dom) continue;
      const d = this.blocs[b.dom];
      if (b.id === 'GS') {
        const norm = year >= 1945 ? 0.6 : 0.1;   // після 1945 колоніальне правління втрачає міжнародну легітимність
        const weak = (d.war ? 0.4 : 0) + d.warDefeat * 0.6 + (1 - d.legit) * 0.3 + (d.regime === 'collapse' ? 0.8 : 0);
        b.sov = clamp(b.sov + 0.012 * (b.A.org * (b.A.ideo.nat + b.A.ideo.soc) * 3 + weak + norm) - 0.004);
        if (b.sov >= 0.5) { this.liberate(b, 'decolonization'); }
        continue;
      }
      const crisisD = d.regime === 'collapse' || d.warDefeat > 0.4 || d.cool > 4;
      const p = (crisisD ? 0.6 : year > 1985 && d.stagn > 10 && d.legit < 0.4 ? 0.12 : 0.0005) * clamp(b.C.ideo.nat + b.A.ideo.nat + b.C.ideo.lib + b.A.ideo.lib) * (0.3 + b.coh);
      if (r() < p) this.liberate(b, d.regime === 'collapse' ? 'independenceWar' : 'independence');
    }
  };

  P.liberate = function (b, how) {
    const d = this.blocs[b.dom];
    b.sov = Math.max(b.sov, how === 'decolonization' ? 0.6 : 1); b.dom = null; b.cool = 4;
    const ideo = this.revIdeology(b, true);
    const target = this.regimeFor(ideo, b);
    if (how === 'independenceWar') { b.pending = target; this.transition(b, { regime: 'collapse', order: 'subsistence' }, 'independenceWar', { by: ideo }); }
    else this.transition(b, target, how, { by: ideo });
  };

  P.startWar = function (sa, sb, until, key, forced) {
    const w = { sides: [sa.slice(), sb.slice()], start: this.year, until, key, exh: {}, intensity: 1, forced };
    for (const id of sa.concat(sb)) { if (this.blocs[id]) { this.blocs[id].war = w; w.exh[id] = 0; } }
    this.wars.push(w);
    const named = ['ww1', 'ww2', 'invasion2022', 'japan', 'ongoing'].includes(key);
    this.emit(sa[0] in this.blocs ? sa[0] : sb[0], named ? 'ev.war.' + key : 'ev.war', { a: sa[0], b: sb[0] }, 'war');
    return w;
  };

  P.warYear = function (w, pw) {
    const side = i => w.sides[i].filter(id => this.blocs[id]);
    const supp = i => {
      // підтримка союзників: демократії підтримують сторону, що воює проти автократичного нападника
      let s = 0;
      for (const id of H.BLOCS) {
        if (w.sides[0].includes(id) || w.sides[1].includes(id)) continue;
        const o = this.blocs[id];
        if (o.sov < 0.5 || o.regime === 'collapse') continue;
        const target = side(1 - i)[0];
        if (!target) continue;
        const friend = side(i).some(x => H.REGIMES[this.blocs[x].regime].fam === 'democratic') && H.REGIMES[o.regime].fam === 'democratic' && LIBERAL.has(o.gov);
        if (friend && this.getTension(id, target) > 0.4) s += pw[id] * 0.06;
      }
      return s;
    };
    const P0 = side(0).reduce((s, id) => s + pw[id], 0) + supp(0) + (w.sides[0].includes('JP') ? 0 : 0);
    let P1 = side(1).reduce((s, id) => s + pw[id], 0) + supp(1);
    if (w.sides[1].includes('JP')) P1 += pw[side(0)[0]] * 0.9;
    const tot = P0 + P1 || 1;
    for (let i = 0; i < 2; i++) for (const id of side(i)) {
      const b = this.blocs[id], enemyShare = (i === 0 ? P1 : P0) / tot;
      const defender = i === 1 ? 0.75 : 1;                 // оборона своєї землі дешевша за наступ
      const aid = i === 0 ? 0 : clamp(supp(1) / Math.max(1, pw[id]));  // допомога союзників покриває частину витрат
      w.exh[id] = (w.exh[id] || 0) + (0.06 + 0.2 * enemyShare) * defender - 0.04 * b.cap - 0.06 * b.coh - 0.03 * aid;
      if (aid > 0) { b.debt = Math.max(0, b.debt - 0.07 * aid); b.aid = Math.max(b.aid || 0, aid); }
      b.coh = clamp(b.coh + (this.year - w.start < 2 ? 0.04 : -0.01));
      b.pop *= 1 - 0.004 * w.intensity;
    }
    const year = this.year;
    let loser = null;
    if (w.until && year >= w.until) {
      // кінець «історичної» війни: поразка того, хто найбільш виснажений або нападав як націоналістична диктатура
      for (const id of Object.keys(w.exh)) {
        const b = this.blocs[id]; if (!b) continue;
        const aggressorFascist = w.key === 'ww2' && b.gov === 'nat' && ['oneparty', 'autocracy', 'junta'].includes(b.regime) && b.id !== 'RU';
        const defeat = aggressorFascist ? 1 : clamp(w.exh[id] * (1.1 - b.cap) * 1.2);
        b.warDefeat = Math.max(b.warDefeat, defeat); b.war = null;
        b.humil = clamp(b.humil + 0.5 * defeat);
        if (defeat > 0.6) this.emit(id, 'ev.defeat', {}, 'war');
        else { b.pride = clamp(b.pride + 0.4); }
        if (aggressorFascist && this.blocs.US.regime === 'democracy') this.occupy(b);
      }
      this.endWar(w); return;
    }
    for (let i = 0; i < 2; i++) for (const id of side(i)) if (w.exh[id] > 1.2 || this.blocs[id].regime === 'collapse') loser = i;
    const minExh = Math.min(...Object.values(w.exh));
    if (loser == null && year - w.start > 2 && this.rnd() < 0.04 + 0.12 * minExh) {
      // перемир'я без переможця
      for (const id of Object.keys(w.exh)) { const b = this.blocs[id]; if (b) { b.war = null; b.warDefeat = Math.max(b.warDefeat, 0.2); } }
      this.emit(side(0)[0] || side(1)[0], 'ev.ceasefire', { a: side(0)[0], b: side(1)[0] }, 'war');
      this.endWar(w); return;
    }
    if (loser != null) {
      const win = 1 - loser;
      for (const id of side(loser)) { const b = this.blocs[id]; b.war = null; b.warDefeat = 1; b.humil = clamp(b.humil + 0.4); }
      for (const id of side(win)) { const b = this.blocs[id]; b.war = null; b.pride = clamp(b.pride + 0.4); b.legit = clamp(b.legit + 0.1); }
      const L = side(loser)[0], Wn = side(win)[0];
      this.emit(L || Wn, 'ev.warEnd', { win: Wn || 'JP', lose: L || 'JP' }, 'war');
      // завоювання: імперський переможець, набагато сильніший, підкоряє того, на кого має «претензію»
      if (L && Wn) {
        const lb = this.blocs[L], wb = this.blocs[Wn];
        // повне підкорення — лише якщо переможений народ розколотий і без союзників; інакше — тяжкий мир
        const allied = H.BLOCS.some(o => o !== L && o !== Wn && H.REGIMES[this.blocs[o].regime].fam === 'democratic' && this.getTension(o, Wn) > 0.4) && H.REGIMES[lb.regime].fam !== 'autocratic';
        if (lb.claim === Wn && IMPERIAL.has(wb.gov) && pw[Wn] / pw[L] > 1.6 && (lb.coh < 0.45 || !allied) && this.rnd() < (allied ? 0.4 : 0.85)) this.conquer(lb, wb);
        else if (lb.claim === Wn) { lb.y *= 0.9; lb.humil = clamp(lb.humil + 0.2); this.emit(L, 'ev.hardPeace', { by: Wn }, 'war'); }
      }
      this.endWar(w);
    }
  };
  P.endWar = function (w) {
    w.ended = true; w.endYear = this.year;
    for (const id of Object.keys(w.exh)) {
      const b = this.blocs[id]; if (!b) continue;
      if (b.war === w) b.war = null;
      // союзники допомагають відбудові й реструктуризують борги (план Маршалла)
      if ((b.aid || 0) > 0.15 && b.sov >= 0.5) { b.debt *= 0.55; b.defBias = 0; b.aid = 0.5; b.tfp = Math.min(b.tfp, -0.2); this.emit(id, 'ev.reconstruction', {}, 'war'); }
    }
  };

  P.conquer = function (b, d) {
    b.sov = 0; b.dom = d.id; b.claim = d.id;
    this.transition(b, { regime: d.regime, order: d.order, gov: d.gov, inc: d.inc }, 'conquered', { by: d.id });
    b.humil = clamp(b.humil + 0.5);
  };
  P.occupy = function (b) {
    this.transition(b, { regime: 'democracy', order: 'welfare', gov: 'socdem', inc: 0.65 }, 'occupation', {});
    b.eo *= 0.4; b.debt *= 0.3; b.C.ideo.nat *= 0.4; b.E.ideo.nat *= 0.4; b.A.ideo.nat *= 0.4;
  };

  /* ---------- Кризи і переходи ---------- */
  // головні причини тиску на систему — для пояснень у хроніці
  P.causes = function (b) {
    const list = [
      ['mmp', b.mmp || 0], ['emp', b.emp || 0], ['sfd', b.sfd || 0], ['legit', 1 - b.legit],
      ['anger', b.C.emo.anger], ['fear', b.C.emo.fear], ['war', b.warDefeat], ['foreign', b.sov < 0.5 ? 0.8 : 0],
      ['platform', b.platPow], ['stagn', clamp(b.stagn / 15)],
    ].sort((x, y) => y[1] - x[1]).slice(0, 3).filter(x => x[1] > 0.15);
    return { causes: list.map(x => [x[0], Math.round(x[1] * 100)]) };
  };

  P.crisis = function (b) {
    const C = b.C, A = b.A, E = b.E, S = b.S, R = H.REGIMES[b.regime], r = this.rnd;
    // Турчин: тиск мас × тиск еліт × фінансовий тиск держави
    b.mmp = clamp((1.05 - b.matRatio) * 3 + 0.25 * b.autoPress + b.famine) * (0.4 + 0.6 * b.urban);
    b.emp = clamp(b.eo * (0.5 + 0.5 * A.org));
    // середнє геометричне: усі три тиски підсилюють один одного
    b.psi = Math.cbrt((b.mmp + 0.1) * (b.emp + 0.1) * (b.sfd + 0.1)) / 1.1;
    b.mob = C.org * 0.6 + A.org * 0.4;
    const inst = 0.45 * b.psi + 0.25 * (1 - b.legit) + 0.4 * C.emo.anger * (0.3 + b.mob) + 0.35 * b.warDefeat + 0.3 * (b.strain || 0) + 0.15 * b.humil + (b.order === 'planned' ? 0.05 * clamp(b.stagn / 10) : 0);
    b.inst = b.war && b.war.sides[1].includes(b.id) ? inst - 0.12 * b.coh : inst;
    if (b.regime === 'collapse') { this.resolveCollapse(b); return; }
    if (b.sov < 0.5 || b.cool > 0) return;
    const thr = R.thr + 0.1 * b.rep * (1 - C.org) + (b.regime === 'democracy' ? -0.08 + 0.12 * clamp(b.demYears / 40) : 0);
    const p = clamp((b.inst - thr) * 2.2, 0, 0.5);
    if (r() >= p) return;
    this.resolveCrisis(b);
  };

  P.revIdeology = function (b, liberation) {
    const C = b.C, A = b.A, w = {};
    for (const k of IDEOS) {
      if (k === b.gov || k === 'neolib') continue;
      let v = C.ideo[k] * (0.3 + C.org) + A.ideo[k] * (0.3 + A.org) * 1.5;
      if (k === 'soc') v *= (liberation ? 0.8 : 1.4) * this.avail('soc');
      if (k === 'nat') v *= liberation ? 1.6 : 1.2;
      if (k === 'lib' && b.inc < 0.3) v *= 0.7;
      if (k === 'trad') v *= 0.4;
      w[k] = v * v;
    }
    let tot = 0; for (const k in w) tot += w[k];
    let x = this.rnd() * tot;
    for (const k in w) { x -= w[k]; if (x <= 0) return k; }
    return 'nat';
  };
  P.regimeFor = function (ideo, b) {
    switch (ideo) {
      case 'soc': return { regime: 'oneparty', order: 'planned', gov: 'soc' };
      case 'socdem': return { regime: 'democracy', order: b.I > 0.35 ? 'welfare' : 'laissez', gov: 'socdem', inc: 0.6 };
      case 'lib': return { regime: 'democracy', order: this.year < 1975 ? (this.year < 1945 ? 'laissez' : 'welfare') : 'neoliberal', gov: 'lib', inc: 0.6 };
      case 'green': return { regime: 'democracy', order: 'welfare', gov: 'socdem', inc: 0.65 };
      case 'nat': return { regime: b.inc > 0.4 && this.rnd() < 0.5 ? 'hybrid' : 'oneparty', order: 'statecap', gov: 'nat' };
      case 'rel': return { regime: 'theocracy', order: b.I < 0.4 ? 'agrarian' : 'statecap', gov: 'rel' };
      case 'coop': return b.D > 0.4 && b.C.ideo.coop > 0.2 ? { regime: 'council', order: 'commons', gov: 'coop', inc: 0.9 } : { regime: 'democracy', order: 'welfare', gov: 'socdem', inc: 0.65 };
      case 'tech': return { regime: 'technocorp', order: b.D > 0.5 ? 'rentier' : 'neoliberal', gov: 'tech', inc: 0.3 };
      case 'trad': return { regime: 'autocracy', order: b.I < 0.45 ? 'agrarian' : 'statecap', gov: 'trad' };
      default: return { regime: 'junta', order: 'statecap', gov: 'nat' };
    }
  };

  P.resolveCrisis = function (b) {
    const C = b.C, A = b.A, E = b.E, S = b.S, r = this.rnd, year = this.year;
    const why = this.causes(b);
    // ефект згуртування навколо прапора: під час оборонної війни суспільство рідше «ламає» владу
    const rally = b.war && b.war.sides[1].includes(b.id) ? 1 - 0.6 * b.coh : 1;
    const revForce = C.emo.anger * b.mob * (1 - b.rep * S.loyal * 0.8);
    const cand = [];
    cand.push(['muddle', 1.0 * clamp(1 - b.inst)]);
    if (b.inc > 0.45) cand.push(['reform', 2.6 * b.inc * (0.3 + C.org) * (C.ideo.socdem + C.ideo.lib * 0.4 + C.ideo.green * 0.5 + C.ideo.coop * 0.6 + C.ideo.soc * 0.4) * (0.5 + E.needs.belong * 0.5)]);
    if (b.order === 'planned' && ['oneparty', 'autocracy'].includes(b.regime)) {
      cand.push(['reformAbove', 3 * b.eCoh * clamp(b.stagn / 8)]);
      cand.push(['opening', 2.2 * (1 - b.eCoh) * clamp(b.stagn / 10) * (C.ideo.lib + A.ideo.lib + C.ideo.nat * 0.5) * (0.4 + b.D)]);
    }
    if (b.inc > 0.4 && b.regime !== 'technocorp') cand.push(['populist', 2.2 * (C.ideo.nat + A.ideo.nat) * 0.5 * C.emo.anger * (0.5 + b.eo) * rally]);
    // «кольорова революція»: організоване громадянське суспільство зупиняє узурпацію (2004, 2014 в Україні)
    if (['hybrid', 'oligarchy', 'autocracy'].includes(b.regime) && b.yrsRegime < 30) cand.push(['protest', 3.0 * C.org * (C.ideo.lib + C.ideo.socdem + A.ideo.lib) * C.emo.anger * (1 - b.rep * S.loyal) * (b.regime === 'autocracy' ? 0.5 : 1)]);
    if (b.D > 0.5 && b.platPow > 0.35 && !['oneparty'].includes(b.regime)) cand.push(['techCapture', 3.2 * b.platPow * (1 - C.org) * (1 - b.inc * 0.4) * (0.5 + E.ideo.tech)]);
    if (b.regime === 'technocorp') cand.push(['stateReassert', 1.6 * (C.ideo.nat + E.ideo.nat) * b.cap]);
    cand.push(['revolution', 2.6 * revForce * (0.5 + A.org) * (b.inc > 0.5 ? 0.25 : 1) * rally]);
    // реакція: еліти, налякані лівими, разом із націоналістичним рухом беруть владу (Італія 1922, Німеччина 1933)
    if (b.inc > 0.3) {
      const instStr = clamp(b.demYears / 60) * 0.6 + E.ideo.lib * 0.3;
      cand.push(['reaction', 3.0 * (E.ideo.nat + 0.2) * (0.3 + E.emo.fear) * (C.ideo.nat + A.ideo.nat) * (1 - instStr) * (0.5 + C.emo.anger) * rally]);
    }
    if (b.inc < 0.7) cand.push(['coup', 1.3 * revForce * E.emo.fear * (1 - b.inc) * (0.3 + S.org) * (b.regime === 'junta' ? 0.2 : 1)]);
    cand.push(['collapse', (2.2 * (1 - b.cap) * b.sfd * (1 - b.eCoh) + 1.5 * b.warDefeat * (1 - b.cap)) * rally * (1 - clamp(b.aid || 0) * 0.5)]);
    if (b.regime === 'hybrid' || b.regime === 'autocracy' || b.regime === 'oneparty') cand.push(['crackdown', 1.2 * b.rep * S.loyal]);
    let tot = 0; for (const c of cand) tot += Math.max(0, c[1]);
    let x = r() * tot, pick = 'muddle';
    for (const c of cand) { x -= Math.max(0, c[1]); if (x <= 0) { pick = c[0]; break; } }
    b.lastCrisis = { year, pick, why };

    switch (pick) {
      case 'muddle':
        b.legit = clamp(b.legit - 0.04); b.omega -= 0.01; b.cool = 3;
        this.emit(b.id, 'ev.muddle', why, 'crisis'); break;
      case 'crackdown':
        b.rep = clamp(b.rep + 0.15); C.org *= 0.6; A.org *= 0.6; b.legit = clamp(b.legit - 0.06); b.inc = clamp(b.inc - 0.05); b.cool = 4;
        this.emit(b.id, 'ev.crackdown', why, 'crisis'); break;
      case 'reform': {
        const ideo = C.ideo.coop > 0.2 && b.D > 0.45 ? 'coop' : 'socdem';
        const order = ideo === 'coop' && this.orderFeasible(b, 'commons') ? 'commons' : 'welfare';
        b.omega -= 0.06; b.eo *= 0.7; b.legit = clamp(b.legit + 0.2); b.platPow *= 0.6;
        this.transition(b, { order, gov: ideo === 'coop' ? 'coop' : 'socdem' }, 'reform', why); break;
      }
      case 'reformAbove':
        b.legit = clamp(b.legit + 0.12); b.stagn = 0; b.reformed = true;
        this.transition(b, { order: 'statecap' }, 'reformAbove', why); break;
      case 'opening': {
        const ideo = C.ideo.nat + A.ideo.nat > C.ideo.lib + A.ideo.lib ? 'nat' : 'lib';
        b.eo *= 0.6;
        this.transition(b, { regime: 'hybrid', order: 'neoliberal', gov: ideo, inc: 0.42 }, 'opening', why); break;
      }
      case 'populist':
        b.inc = clamp(b.inc - 0.12);
        this.transition(b, { gov: 'nat', regime: b.inc < 0.44 ? 'hybrid' : b.regime }, 'populist', why); break;
      case 'techCapture':
        this.transition(b, { regime: 'technocorp', order: 'rentier', gov: 'tech', inc: clamp(b.inc * 0.6) }, 'techCapture', why); break;
      case 'stateReassert':
        b.platPow *= 0.3;
        this.transition(b, { regime: 'oneparty', order: 'statecap', gov: 'nat' }, 'stateReassert', why); break;
      case 'revolution': {
        const ideo = this.revIdeology(b), target = this.regimeFor(ideo, b);
        b.y *= 0.9; b.eo *= 0.3; b.omega = H.ORDERS[target.order].omega; b.legit = 0.55; b.coh = clamp(b.coh + 0.1);
        C.org *= 0.7; b.platPow *= 0.3;
        // громадянська війна, якщо стара еліта згуртована і армія не перейшла на бік повсталих
        if (b.eCoh > 0.35 && (ideo === 'soc' || ideo === 'nat' || ideo === 'rel') && r() < 0.35 + 0.4 * b.eCoh) {
          b.pending = target;
          this.transition(b, { regime: 'collapse', order: 'subsistence' }, 'revolutionCivilWar', Object.assign({ by: ideo }, why));
        } else this.transition(b, target, 'revolution', Object.assign({ by: ideo }, why));
        break;
      }
      case 'protest':
        b.legit = clamp(b.legit + 0.1); b.rep *= 0.6;
        this.transition(b, { regime: 'democracy', gov: C.ideo.socdem > C.ideo.lib ? 'socdem' : 'lib', inc: Math.max(0.58, b.inc + 0.2) }, 'protest', why); break;
      case 'reaction':
        b.rep = 0.7; C.org *= 0.6; A.org *= 0.6;
        this.transition(b, { regime: 'oneparty', gov: 'nat', order: 'statecap' }, 'reaction', why); break;
      case 'coup':
        b.rep = 0.8; C.org *= 0.5;
        this.transition(b, { regime: 'junta', gov: 'nat', order: b.order === 'planned' ? 'statecap' : b.order }, 'coup', why); break;
      case 'collapse':
        b.pending = null;
        this.transition(b, { regime: 'collapse', order: 'subsistence' }, 'collapse', why); break;
    }
  };

  P.resolveCollapse = function (b) {
    b.collapseYrs++;
    const r = this.rnd, C = b.C, A = b.A;
    if (b.collapseYrs < 2) return;
    if (r() > 0.22 + 0.05 * b.collapseYrs) return;
    let target = b.pending;
    if (!target) {
      // хто організованіший — той і збирає країну наново
      const cand = [
        ['junta', 0.4 * b.S.org],
        ['ideo', 0.6 * (C.org + A.org)],
      ];
      target = cand[0][1] > cand[1][1] * (0.5 + r()) ? { regime: 'junta', order: 'statecap', gov: 'nat' } : this.regimeFor(this.revIdeology(b), b);
    }
    b.pending = null; b.collapseYrs = 0; b.cap = clamp(b.cap * 0.8 + 0.1);
    b.legit = 0.5; b.coh = clamp(b.coh + 0.15); b.eo *= 0.4;
    if (target.regime === 'oneparty') b.cap = clamp(b.cap + 0.15);
    this.transition(b, target, 'rebuild', { by: target.gov });
  };

  P.transition = function (b, t, why, causes) {
    const before = H.classify(b), prev = { regime: b.regime, order: b.order, gov: b.gov };
    if (t.regime) b.regime = t.regime;
    if (t.order) b.order = t.order;
    if (t.gov) b.gov = t.gov;
    if (t.inc != null) b.inc = t.inc;
    else if (t.regime && t.regime !== prev.regime) {
      const R = H.REGIMES[b.regime];
      b.inc = ['democracy', 'hybrid', 'oligarchy', 'council'].includes(b.regime) ? Math.max(R.inc * 0.75, b.inc) : R.inc;
    }
    if (b.regime === 'democracy' && b.inc < 0.5) b.inc = 0.52;
    if (t.regime && t.regime !== prev.regime) { b.yrsRegime = 0; b.demYears = b.regime === 'democracy' ? 0 : b.demYears; }
    b.cool = 6;
    const after = H.classify(b);
    this.emit(b.id, 'tr.' + why, Object.assign({ from: before, to: after, regime: b.regime, order: b.order, gov: b.gov }, causes || {}), 'transition');
  };

  /* ---------- Запис стану ---------- */
  P.record = function () {
    for (const id of H.BLOCS) {
      const b = this.blocs[id];
      // підпорядкований блок живе за режимом метрополії
      if (b.sov < 0.5 && b.dom && b.id !== 'GS') {
        const d = this.blocs[b.dom];
        if (d.regime !== 'collapse') { b.regime = d.regime; b.order = d.order; b.gov = d.gov; b.inc = Math.min(d.inc, 0.3); }
      }
      const cat = H.classify(b);
      if (cat !== this.lastCats[id]) this.lastCats[id] = cat;
      b.cat = cat;
      b.rec.push({
        y: this.year, cat, regime: b.regime, order: b.order, gov: b.gov,
        gdp: +b.y.toFixed(2), inc: +b.inc.toFixed(3), omega: +b.omega.toFixed(3), psi: +(b.psi || 0).toFixed(3), inst: +(b.inst || 0).toFixed(3),
        legit: +b.legit.toFixed(3), mmp: +(b.mmp || 0).toFixed(3), emp: +(b.emp || 0).toFixed(3), sfd: +(b.sfd || 0).toFixed(3), debt: +b.debt.toFixed(2),
        anger: +b.C.emo.anger.toFixed(3), fear: +b.C.emo.fear.toFixed(3), hope: +b.C.emo.hope.toFixed(3), trust: +b.C.emo.trust.toFixed(3),
        org: +b.C.org.toFixed(3), eo: +b.eo.toFixed(3), plat: +b.platPow.toFixed(3), war: !!b.war, sov: +b.sov.toFixed(2),
      });
    }
  };

  /* ---------- Багато прогонів ---------- */
  // накопичення результатів по одному прогону — щоб інтерфейс міг рахувати частинами
  H.newEnsemble = function (opts) {
    const res = { opts, n: 0, years: null, share: {}, paths: {}, firstTF: {}, samples: [], wars: 0, nukeFree: 0 };
    for (const id of H.BLOCS) { res.share[id] = {}; res.paths[id] = {}; res.firstTF[id] = []; }
    return res;
  };
  H.addRun = function (res, k) {
    const opts = res.opts;
    const s = new H.Sim(Object.assign({}, opts, { seed: (opts.seed || 1) * 7919 + k * 104729 }));
    s.run();
    if (!res.years) res.years = s.blocs.US.rec.map(x => x.y);
    for (const id of H.BLOCS) {
      const rec = s.blocs[id].rec, sh = res.share[id];
      const path = [];
      rec.forEach((x, i) => {
        sh[i] = sh[i] || {}; sh[i][x.cat] = (sh[i][x.cat] || 0) + 1;
        const pc = x.cat === 'libdem' || x.cat === 'socdem' ? 'democracy' : x.cat;   // ринкова й соціальна демократія — одна гілка
        if (path[path.length - 1] !== pc) path.push(pc);
      });
      const key = path.slice(0, 6).join('>');
      res.paths[id][key] = (res.paths[id][key] || 0) + 1;
      const tf = rec.find(x => x.cat === 'technofeudal');
      res.firstTF[id].push(tf ? tf.y : null);
    }
    if (res.samples.length < 3) res.samples.push(s);
    res.n++;
    return s;
  };
  H.runMany = function (opts, n, onProgress) {
    const res = H.newEnsemble(opts);
    for (let k = 0; k < n; k++) { H.addRun(res, k); if (onProgress) onProgress(k + 1); }
    return res;
  };
})(typeof window !== 'undefined' ? (window.H = window.H || {}) : (global.H = global.H || {}));
