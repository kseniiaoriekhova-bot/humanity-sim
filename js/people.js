/* ============================================================
   Люди-представники: по четверо в кожному блоці
   (проста людина, освічений претендент, представник еліти, службовець).
   Їхні потреби й емоції походять зі стану групи + особисті коливання.
   Щороку кожен пише рядок у щоденник.
   ============================================================ */
(function (H) {
  'use strict';
  const clamp = H.clamp;

  // імена: [українською, німецькою]
  const NAMES = {
    US: { m: [['Джон', 'John'], ['Френк', 'Frank'], ['Віллі', 'Willie'], ['Маркус', 'Marcus'], ['Хосе', 'José'], ['Тайлер', 'Tyler']], f: [['Мері', 'Mary'], ['Рут', 'Ruth'], ['Долорес', 'Dolores'], ['Кейша', 'Keisha'], ['Ешлі', 'Ashley'], ['Софія', 'Sofia']], s: [['Міллер', 'Miller'], ['Джонсон', 'Johnson'], ['Гарсія', 'García'], ['О\'Браєн', 'O\'Brien'], ['Ковальські', 'Kowalski'], ['Вашингтон', 'Washington']] },
    EU: { m: [['Ганс', 'Hans'], ['П\'єр', 'Pierre'], ['Джованні', 'Giovanni'], ['Ян', 'Jan'], ['Карлос', 'Carlos'], ['Лукас', 'Lukas']], f: [['Марі', 'Marie'], ['Ельза', 'Elsa'], ['Анна', 'Anna'], ['Лючія', 'Lucia'], ['Агнешка', 'Agnieszka'], ['Лена', 'Lena']], s: [['Шмідт', 'Schmidt'], ['Мартен', 'Martin'], ['Россі', 'Rossi'], ['Новак', 'Nowak'], ['Гарсія', 'García'], ['Янссен', 'Janssen']] },
    UA: { m: [['Тарас', 'Taras'], ['Іван', 'Iwan'], ['Петро', 'Petro'], ['Олекса', 'Oleksa'], ['Дмитро', 'Dmytro'], ['Андрій', 'Andrij']], f: [['Оксана', 'Oksana'], ['Марія', 'Marija'], ['Ганна', 'Hanna'], ['Леся', 'Lesja'], ['Ірина', 'Iryna'], ['Соломія', 'Solomija']], s: [['Коваленко', 'Kowalenko'], ['Шевчук', 'Schewtschuk'], ['Бондар', 'Bondar'], ['Мельник', 'Melnyk'], ['Ткаченко', 'Tkatschenko'], ['Лисенко', 'Lyssenko']] },
    RU: { m: [['Іван', 'Iwan'], ['Микола', 'Nikolai'], ['Сергій', 'Sergei'], ['Олексій', 'Alexei'], ['Дмитро', 'Dmitri'], ['Павло', 'Pawel']], f: [['Наталія', 'Natalja'], ['Ольга', 'Olga'], ['Тетяна', 'Tatjana'], ['Олена', 'Jelena'], ['Анна', 'Anna'], ['Віра', 'Wera']], s: [['Іванов', 'Iwanow'], ['Смирнов', 'Smirnow'], ['Кузнєцов', 'Kusnezow'], ['Попов', 'Popow'], ['Соколов', 'Sokolow'], ['Морозов', 'Morosow']] },
    CN: { m: [['Лі Вей', 'Li Wei'], ['Ван Лун', 'Wang Long'], ['Чжан Мін', 'Zhang Ming'], ['Лю Цян', 'Liu Qiang'], ['Чень Хао', 'Chen Hao'], ['Ян Бо', 'Yang Bo']], f: [['Лі На', 'Li Na'], ['Ван Фан', 'Wang Fang'], ['Чжан Лі', 'Zhang Li'], ['Лю Ін', 'Liu Ying'], ['Чень Цзін', 'Chen Jing'], ['Ян Мей', 'Yang Mei']], s: [['', ''], ['', ''], ['', ''], ['', ''], ['', ''], ['', '']] },
    GS: { m: [['Раджеш', 'Rajesh'], ['Амаду', 'Amadou'], ['Педру', 'Pedro'], ['Агус', 'Agus'], ['Кофі', 'Kofi'], ['Фарід', 'Farid']], f: [['Прія', 'Priya'], ['Амінат', 'Aminat'], ['Ана', 'Ana'], ['Сіті', 'Siti'], ['Фатіма', 'Fatima'], ['Лусія', 'Lucía']], s: [['Кумар', 'Kumar'], ['Діалло', 'Diallo'], ['Сілва', 'Silva'], ['Сантосо', 'Santoso'], ['Мензах', 'Mensah'], ['Рахман', 'Rahman']] },
  };
  H.ROLES = ['C', 'A', 'E', 'S'];

  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function makePerson(r, bloc, role, born, surname) {
    const N = NAMES[bloc], f = r() < 0.5;
    const first = pick(r, f ? N.f : N.m);
    const sur = surname || pick(r, N.s);
    return { bloc, role, female: f, first, sur, born, dies: born + 62 + Math.floor(r() * 22), mood: { anger: 0.3, fear: 0.3, hope: 0.5, trust: 0.5 }, diary: [], gen: 1, quirk: r() - 0.5 };
  }
  H.personName = function (p, lang) {
    const i = lang === 'de' ? 1 : 0;
    return (p.first[i] + (p.sur[i] ? ' ' + p.sur[i] : '')).trim();
  };

  H.People = function (sim) {
    this.sim = sim;
    this.r = H.rng((sim.seed || 1) ^ 0x5bd1e995);
    this.list = [];
    for (const id of H.BLOCS) for (const role of H.ROLES) {
      const age = 20 + Math.floor(this.r() * 25);
      this.list.push(makePerson(this.r, id, role, sim.year - age));
    }
    this.lastAI = {};
    this.update(true);
  };
  const P = H.People.prototype;

  P.eraOf = function (b) {
    if (b.AI > 0.4) return 'ai';
    if (b.D > 0.4) return 'dig';
    if (b.I > 0.45 || b.order !== 'agrarian') return b.I > 0.45 ? 'ind' : 'agr';
    return 'agr';
  };

  P.update = function (first) {
    const sim = this.sim, year = sim.year, r = this.r;
    for (let i = 0; i < this.list.length; i++) {
      let p = this.list[i];
      const b = sim.blocs[p.bloc];
      if (year >= p.dies) {
        const child = makePerson(r, p.bloc, p.role, year - 18 - Math.floor(r() * 8), p.sur);
        child.gen = p.gen + 1; child.parent = { first: p.first, sur: p.sur, female: p.female };
        child.diary.push({ year, key: 'd.inherit', p: { parent: p.first, pf: p.female } });
        this.list[i] = p = child;
      }
      const grp = p.role === 'S' ? null : b[p.role];
      const e = grp ? grp.emo : { anger: clamp(1 - b.S.loyal), fear: clamp(b.warDefeat + (b.regime === 'collapse' ? 0.6 : 0) + b.sfd * 0.4), hope: clamp(b.cap * 0.6 + b.gAvg * 10), trust: b.legit };
      const q = p.quirk * 0.25;
      for (const k of ['anger', 'fear', 'hope', 'trust']) {
        const target = clamp((e[k] || 0) + (k === 'anger' ? q : k === 'hope' ? -q : 0) + (r() - 0.5) * 0.12);
        p.mood[k] += (target - p.mood[k]) * (first ? 1 : 0.5);
      }
      if (first) continue;
      p.diary.push(this.entry(p, b));
      if (p.diary.length > 14) p.diary.shift();
    }
  };

  // що людина запише цього року
  P.entry = function (p, b) {
    const sim = this.sim, year = sim.year;
    const era = this.eraOf(b), order = b.order;
    const base = { role: p.role, era, order, war: !!b.war, rep: b.rep > 0.5, f: p.female };
    // спершу — великі події свого блоку
    const evs = sim.log.filter(e => e.year === year && (e.bloc === p.bloc || e.bloc == null || e.p.a === p.bloc || e.p.b === p.bloc));
    const big = evs.find(e => e.kind === 'transition' && e.bloc === p.bloc) || evs.find(e => e.kind === 'war') || evs.find(e => e.kind === 'shock') || evs.find(e => e.key === 'ev.crackdown');
    if (big) {
      base.att = big.p.a === p.bloc;
      const k = big.key.replace(/^(tr|ev)\./, '');
      const key = 'd.ev.' + k;
      if (H.hasText(key + '.' + p.role)) return { year, key: key + '.' + p.role, p: base };
      if (H.hasText(key)) return { year, key, p: base };
    }
    if (b.AI > 0.4 && !this.lastAI[p.bloc + p.role] && p.role === 'C') { this.lastAI[p.bloc + p.role] = true; return { year, key: 'd.ai', p: base }; }
    // інакше — найсильніша емоція і те, що людина бачить навколо
    const m = p.mood;
    let emo = 'trust', best = m.trust * 0.8;
    for (const k of ['anger', 'fear', 'hope']) if (m[k] > best) { best = m[k]; emo = k; }
    if (b.regime === 'collapse') return { year, key: 'd.collapse', p: base };
    const cand = [`d.${emo}.${p.role}.0`, `d.${emo}.${p.role}.1`];
    const sit = [
      [b.war, 'war.' + p.role, 2], [b.omega > 0.5 && p.role !== 'E', 'sit.inequality', 1], [b.platPow > 0.4, 'sit.platform.' + (p.role === 'E' ? 'E' : 'X'), 1],
      [b.rep > 0.6 && p.role !== 'S', 'sit.repression', 1], [b.gAvg > 0.03, 'sit.growth', 1], [b.stagn > 5, 'sit.stagn', 1],
      [(b.emp || 0) > 0.45 && p.role === 'A', 'sit.elites', 1], [(b.sfd || 0) > 0.5 && p.role === 'S', 'sit.debt', 1],
      [b.AI > 0.5 && p.role !== 'E', 'sit.ai', 1], [b.AI > 0.5 && p.role === 'E', 'sit.ai.E', 1], [this.sim.climate > 0.4, 'sit.climate', 1],
    ];
    for (const [ok, k, w] of sit) if (ok) for (let i = 0; i < w; i++) cand.push('d.' + k);
    const recent = new Set(p.diary.slice(-3).map(d => d.key));
    let pool = cand.filter(k => !recent.has(k) && H.hasText(k));
    if (!pool.length) pool = cand.filter(k => H.hasText(k) && k !== (p.diary.length && p.diary[p.diary.length - 1].key));
    return { year, key: pool.length ? pool[Math.floor(this.r() * pool.length)] : cand[0], p: base };
  };

  P.ofBloc = function (id) { return this.list.filter(p => p.bloc === id); };
})(typeof window !== 'undefined' ? (window.H = window.H || {}) : (global.H = global.H || {}));
