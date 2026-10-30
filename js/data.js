/* ============================================================
   Людство: дані моделі
   Блоки, політичні режими, економічні лади, ідеології,
   стартові стани (1900 і 2025), реальна історія для перевірки,
   історичні шоки. Усі числа — наближені оцінки для моделі,
   джерела перелічено в H.SOURCES.
   ============================================================ */
(function (H) {
  'use strict';

  H.BLOCS = ['US', 'EU', 'UA', 'RU', 'CN', 'GS'];

  /* ---------- Політичні режими ----------
     inc — інклюзивність (наскільки звичайні люди мають голос і права)
     rep — базовий рівень репресій
     thr — поріг кризи: наскільки сильний тиск режим витримує
     surv — схильність до цифрового нагляду, коли технології дозволяють */
  H.REGIMES = {
    autocracy:  { inc: 0.08, rep: 0.45, thr: 0.36, surv: 0.8, fam: 'autocratic' },  // монархія / персоналістська автократія
    oligarchy:  { inc: 0.38, rep: 0.20, thr: 0.42, surv: 0.3, fam: 'limited' },     // обмежена «демократія для небагатьох»
    democracy:  { inc: 0.80, rep: 0.05, thr: 0.50, surv: 0.15, fam: 'democratic' },
    hybrid:     { inc: 0.38, rep: 0.35, thr: 0.42, surv: 0.5, fam: 'limited' },     // конкурентний авторитаризм, популістський режим
    oneparty:   { inc: 0.06, rep: 0.70, thr: 0.42, surv: 0.95, fam: 'autocratic' }, // ідеологічна однопартійна держава
    junta:      { inc: 0.05, rep: 0.70, thr: 0.38, surv: 0.7, fam: 'autocratic' },
    theocracy:  { inc: 0.12, rep: 0.60, thr: 0.42, surv: 0.7, fam: 'autocratic' },
    technocorp: { inc: 0.30, rep: 0.20, thr: 0.45, surv: 0.85, fam: 'limited' },    // реальна влада у власників платформ
    council:    { inc: 0.92, rep: 0.03, thr: 0.48, surv: 0.1, fam: 'democratic' },  // рада / кооперативна демократія
    collapse:   { inc: 0.10, rep: 0.30, thr: 9.00, surv: 0.1, fam: 'collapse' },    // розпад, громадянська війна
  };

  /* ---------- Економічні лади ----------
     omega — частка доходу верхніх 10% (Турчин: «насос багатства»)
     tax — податкове навантаження, welfare — соціальні витрати
     eff — ефективність (впливає на зростання), atom — розпорошення працівників */
  H.ORDERS = {
    agrarian:    { omega: 0.50, tax: 0.07, welfare: 0.00, eff: -0.30, atom: 0.10, fam: 'agrarian' },
    laissez:     { omega: 0.46, tax: 0.10, welfare: 0.02, eff: 0.00, atom: 0.05, fam: 'market' },
    welfare:     { omega: 0.31, tax: 0.36, welfare: 0.18, eff: -0.02, atom: 0.00, fam: 'market' },
    neoliberal:  { omega: 0.44, tax: 0.28, welfare: 0.10, eff: 0.02, atom: 0.12, fam: 'market' },
    planned:     { omega: 0.24, tax: 0.45, welfare: 0.12, eff: -0.12, atom: 0.05, fam: 'planned' },
    statecap:    { omega: 0.42, tax: 0.24, welfare: 0.06, eff: -0.08, atom: 0.10, fam: 'statecap' },
    rentier:     { omega: 0.56, tax: 0.20, welfare: 0.08, eff: -0.06, atom: 0.35, fam: 'rentier' },  // платформна рента
    commons:     { omega: 0.24, tax: 0.30, welfare: 0.16, eff: -0.04, atom: 0.00, fam: 'commons' },
    subsistence: { omega: 0.40, tax: 0.03, welfare: 0.00, eff: -0.80, atom: 0.40, fam: 'collapse' },
  };

  /* ---------- Ідеології ---------- */
  H.IDEOS = ['trad', 'rel', 'lib', 'socdem', 'soc', 'nat', 'neolib', 'tech', 'green', 'coop'];
  // доступність ідеї в певний рік (0..1): ідея не може захопити маси, поки її не сформульовано
  H.ideoAvail = function (id, year) {
    const ramp = (a, b) => year <= a ? 0 : year >= b ? 1 : (year - a) / (b - a);
    switch (id) {
      case 'soc': return 0.55 + 0.45 * ramp(1905, 1920);
      case 'neolib': return ramp(1968, 1982);
      case 'tech': return ramp(1995, 2014);
      case 'green': return ramp(1968, 1992);
      case 'coop': return 0.5 + 0.5 * ramp(2000, 2030);
      default: return 1;
    }
  };
  // якому ладу віддає перевагу влада певної ідеології
  H.prefOrder = function (gov, b, year) {
    switch (gov) {
      case 'trad': return b.I < 0.45 ? 'agrarian' : 'statecap';
      case 'rel': return b.I < 0.4 ? 'agrarian' : 'statecap';
      // усталена соціальна держава має інерцію: ліберали її не демонтують
      case 'lib': return year < 1945 ? 'laissez' : year < 1975 ? 'welfare' : (year > 2000 && b.order === 'welfare' ? 'welfare' : 'neoliberal');
      case 'socdem': return 'welfare';
      case 'soc': return b.regime === 'oneparty' ? (b.reformed ? 'statecap' : 'planned') : 'welfare';
      case 'nat': return 'statecap';
      case 'neolib': return 'neoliberal';
      case 'tech': return b.D > 0.5 && b.platPow > 0.25 ? 'rentier' : 'neoliberal';
      case 'green': return 'welfare';
      case 'coop': return b.D > 0.45 ? 'commons' : 'welfare';
      default: return b.order;
    }
  };

  /* ---------- Узагальнені «системи» для графіків (8 кольорів + розпад) ---------- */
  H.CATS = ['libdem', 'autocratic', 'socdem', 'oligarchic', 'dominated', 'council', 'technofeudal', 'socialist', 'collapse'];
  H.classify = function (b) {
    if (b.sov < 0.5) return 'dominated';
    if (b.regime === 'collapse') return 'collapse';
    if (b.regime === 'technocorp' || (b.order === 'rentier' && b.inc < 0.6)) return 'technofeudal';
    if (b.regime === 'council') return 'council';
    const fam = H.REGIMES[b.regime].fam;
    if (fam === 'democratic') return b.order === 'welfare' || b.order === 'commons' ? 'socdem' : 'libdem';
    if (fam === 'limited') return b.order === 'planned' ? 'socialist' : 'oligarchic';
    return b.order === 'planned' ? 'socialist' : 'autocratic';
  };
  // для перевірки на історії: родина політичного режиму та родина економіки
  H.polFam = cat => ({ libdem: 'dem', socdem: 'dem', council: 'dem', oligarchic: 'lim', technofeudal: 'lim', autocratic: 'aut', socialist: 'aut', collapse: 'col', dominated: 'dom' }[cat]);

  /* ---------- Стартовий стан 1900 ----------
     y — ВВП на особу, тис. $ (ПКС, ціни 2011, за Maddison Project, округлено)
     I/D/A — освоєння індустріальних, цифрових технологій і автоматизації (0..1)
     sov — суверенітет (для Глобального Півдня — частка населення поза колоніями) */
  const ideo = o => Object.assign({ trad: 0, rel: 0, lib: 0, socdem: 0, soc: 0, nat: 0, neolib: 0, tech: 0, green: 0, coop: 0 }, o);
  H.START_1900 = {
    US: { pop: 76, y: 8.0, regime: 'democracy', inc: 0.50, order: 'laissez', gov: 'lib', cap: 0.40, legit: 0.62, debt: 0.07, defBias: 0, coh: 0.6, eCoh: 0.6, sov: 1,
      I: 0.30, D: 0, AI: 0, urban: 0.40, edu: 0.88, omega: 0.42, eo: 0.25, digSov: 0.9, rep: 0.08,
      C: { ideo: ideo({ trad: 0.05, rel: 0.27, lib: 0.33, socdem: 0.1, soc: 0.06, nat: 0.14, coop: 0.05 }), org: 0.25 },
      A: { ideo: ideo({ rel: 0.15, lib: 0.5, socdem: 0.15, soc: 0.08, nat: 0.12 }), org: 0.2 },
      E: { ideo: ideo({ rel: 0.15, lib: 0.7, nat: 0.1, trad: 0.05 }) } },
    EU: { pop: 280, y: 5.0, regime: 'oligarchy', inc: 0.36, order: 'laissez', gov: 'lib', cap: 0.55, legit: 0.6, debt: 0.45, defBias: 0, coh: 0.6, eCoh: 0.55, sov: 1,
      I: 0.28, D: 0, AI: 0, urban: 0.38, edu: 0.75, omega: 0.48, eo: 0.35, digSov: 0.9, rep: 0.2,
      C: { ideo: ideo({ trad: 0.15, rel: 0.2, lib: 0.14, socdem: 0.2, soc: 0.1, nat: 0.16, coop: 0.05 }), org: 0.3 },
      A: { ideo: ideo({ trad: 0.05, rel: 0.1, lib: 0.35, socdem: 0.15, soc: 0.12, nat: 0.23 }), org: 0.25 },
      E: { ideo: ideo({ trad: 0.3, rel: 0.1, lib: 0.4, nat: 0.2 }) } },
    UA: { pop: 28, convF: 0.7, y: 1.9, regime: 'autocracy', inc: 0.06, order: 'agrarian', gov: 'trad', cap: 0.3, legit: 0.35, debt: 0.2, defBias: 0, coh: 0.45, eCoh: 0.4, sov: 0, dom: 'RU', claim: 'RU',
      I: 0.10, D: 0, AI: 0, urban: 0.14, edu: 0.25, omega: 0.50, eo: 0.25, digSov: 0.2, rep: 0.5,
      C: { ideo: ideo({ trad: 0.2, rel: 0.3, lib: 0.05, socdem: 0.1, soc: 0.08, nat: 0.2, coop: 0.07 }), org: 0.1 },
      A: { ideo: ideo({ trad: 0.05, rel: 0.1, lib: 0.2, socdem: 0.2, soc: 0.15, nat: 0.3 }), org: 0.15 },
      E: { ideo: ideo({ trad: 0.6, rel: 0.2, lib: 0.1, nat: 0.1 }) } },
    RU: { pop: 70, convF: 0.85, y: 2.0, regime: 'autocracy', inc: 0.06, order: 'agrarian', gov: 'trad', cap: 0.35, legit: 0.5, debt: 0.3, defBias: 0, coh: 0.5, eCoh: 0.5, sov: 1,
      I: 0.12, D: 0, AI: 0, urban: 0.13, edu: 0.25, omega: 0.47, eo: 0.3, digSov: 0.5, rep: 0.5,
      C: { ideo: ideo({ trad: 0.32, rel: 0.3, lib: 0.04, socdem: 0.08, soc: 0.1, nat: 0.11, coop: 0.05 }), org: 0.12 },
      A: { ideo: ideo({ trad: 0.05, rel: 0.05, lib: 0.25, socdem: 0.2, soc: 0.3, nat: 0.15 }), org: 0.2 },
      E: { ideo: ideo({ trad: 0.65, rel: 0.15, lib: 0.12, nat: 0.08 }) } },
    CN: { pop: 400, convF: 0.75, y: 0.85, regime: 'autocracy', inc: 0.04, order: 'agrarian', gov: 'trad', cap: 0.15, legit: 0.32, debt: 0.4, defBias: 0.01, coh: 0.4, eCoh: 0.3, sov: 1, humil: 0.6,
      I: 0.03, D: 0, AI: 0, urban: 0.06, edu: 0.15, omega: 0.45, eo: 0.4, digSov: 0.3, rep: 0.4,
      C: { ideo: ideo({ trad: 0.45, rel: 0.25, lib: 0.02, socdem: 0.03, soc: 0.02, nat: 0.2, coop: 0.03 }), org: 0.08 },
      A: { ideo: ideo({ trad: 0.25, rel: 0.05, lib: 0.25, socdem: 0.1, soc: 0.05, nat: 0.3 }), org: 0.15 },
      E: { ideo: ideo({ trad: 0.8, rel: 0.1, nat: 0.1 }) } },
    GS: { pop: 900, convF: 0.4, y: 1.0, regime: 'autocracy', inc: 0.06, order: 'agrarian', gov: 'trad', cap: 0.2, legit: 0.3, debt: 0.2, defBias: 0, coh: 0.35, eCoh: 0.35, sov: 0.25, dom: 'EU', claim: 'EU', humil: 0.4,
      I: 0.04, D: 0, AI: 0, urban: 0.08, edu: 0.12, omega: 0.52, eo: 0.25, digSov: 0.2, rep: 0.45,
      C: { ideo: ideo({ trad: 0.42, rel: 0.35, lib: 0.03, socdem: 0.03, soc: 0.02, nat: 0.13, coop: 0.02 }), org: 0.06 },
      A: { ideo: ideo({ trad: 0.15, rel: 0.15, lib: 0.25, socdem: 0.1, soc: 0.05, nat: 0.3 }), org: 0.1 },
      E: { ideo: ideo({ trad: 0.6, rel: 0.2, lib: 0.15, nat: 0.05 }) } },
  };

  /* ---------- Стартовий стан 2025 ----------
     inc — за індексом ліберальної демократії V-Dem (наближено; для США — з урахуванням падіння
     на 24% у 2025 р. за звітом V-Dem 2026); debt — валовий держборг, % ВВП (МВФ, 2025–2026);
     omega — частка доходу верхніх 10% (World Inequality Database, наближено). */
  H.START_2025 = {
    US: { pop: 340, y: 60, regime: 'democracy', inc: 0.57, order: 'neoliberal', gov: 'nat', cap: 0.70, legit: 0.42, debt: 1.24, defBias: 0.035, coh: 0.32, eCoh: 0.35, sov: 1, nuke: true,
      I: 1.0, D: 0.88, AI: 0.14, urban: 0.83, edu: 0.92, omega: 0.46, eo: 0.62, digSov: 0.95, rep: 0.1, platPow: 0.62,
      C: { ideo: ideo({ rel: 0.14, lib: 0.22, socdem: 0.17, soc: 0.04, nat: 0.3, neolib: 0.05, tech: 0.03, green: 0.03, coop: 0.02 }), org: 0.22 },
      A: { ideo: ideo({ rel: 0.06, lib: 0.22, socdem: 0.2, soc: 0.1, nat: 0.24, neolib: 0.04, tech: 0.08, green: 0.04, coop: 0.02 }), org: 0.4 },
      E: { ideo: ideo({ rel: 0.08, lib: 0.25, nat: 0.25, neolib: 0.18, tech: 0.24 }) } },
    EU: { pop: 450, y: 42, regime: 'democracy', inc: 0.74, order: 'welfare', gov: 'lib', cap: 0.70, legit: 0.5, debt: 0.88, defBias: 0.01, coh: 0.45, eCoh: 0.5, sov: 1, nuke: true,
      I: 1.0, D: 0.82, AI: 0.1, urban: 0.75, edu: 0.9, omega: 0.36, eo: 0.42, digSov: 0.25, rep: 0.05, platPow: 0.1,
      C: { ideo: ideo({ rel: 0.08, lib: 0.24, socdem: 0.22, soc: 0.04, nat: 0.22, neolib: 0.06, tech: 0.02, green: 0.1, coop: 0.02 }), org: 0.38 },
      A: { ideo: ideo({ rel: 0.04, lib: 0.25, socdem: 0.2, soc: 0.06, nat: 0.18, neolib: 0.06, tech: 0.05, green: 0.13, coop: 0.03 }), org: 0.38 },
      E: { ideo: ideo({ rel: 0.05, lib: 0.4, socdem: 0.15, nat: 0.12, neolib: 0.18, tech: 0.05, green: 0.05 }) } },
    UA: { pop: 33, convF: 0.7, y: 11, regime: 'democracy', inc: 0.48, order: 'neoliberal', gov: 'lib', cap: 0.45, legit: 0.6, debt: 1.05, defBias: 0.01, coh: 0.75, eCoh: 0.5, sov: 1, claim: 'RU',
      I: 0.8, D: 0.72, AI: 0.05, urban: 0.7, edu: 0.9, omega: 0.34, eo: 0.35, digSov: 0.15, rep: 0.15, platPow: 0.05, humil: 0.3,
      C: { ideo: ideo({ rel: 0.1, lib: 0.3, socdem: 0.15, soc: 0.02, nat: 0.3, neolib: 0.05, tech: 0.03, green: 0.02, coop: 0.03 }), org: 0.45 },
      A: { ideo: ideo({ rel: 0.05, lib: 0.38, socdem: 0.14, nat: 0.28, neolib: 0.06, tech: 0.06, green: 0.03 }), org: 0.5 },
      E: { ideo: ideo({ lib: 0.4, nat: 0.25, neolib: 0.25, tech: 0.05, rel: 0.05 }) } },
    RU: { pop: 144, convF: 0.85, y: 25, regime: 'autocracy', inc: 0.07, order: 'statecap', gov: 'nat', cap: 0.6, legit: 0.5, debt: 0.2, defBias: 0.02, coh: 0.45, eCoh: 0.55, sov: 1, nuke: true,
      I: 0.9, D: 0.72, AI: 0.06, urban: 0.75, edu: 0.9, omega: 0.47, eo: 0.4, digSov: 0.55, rep: 0.8, platPow: 0.2, humil: 0.5,
      C: { ideo: ideo({ trad: 0.1, rel: 0.15, lib: 0.07, socdem: 0.08, soc: 0.12, nat: 0.44, neolib: 0.01, tech: 0.01, green: 0.02 }), org: 0.1 },
      A: { ideo: ideo({ trad: 0.05, rel: 0.08, lib: 0.2, socdem: 0.1, soc: 0.1, nat: 0.4, tech: 0.05, green: 0.02 }), org: 0.12 },
      E: { ideo: ideo({ trad: 0.1, rel: 0.1, nat: 0.6, lib: 0.1, neolib: 0.1 }) } },
    CN: { pop: 1410, convF: 0.75, reformed: true, y: 18, regime: 'oneparty', inc: 0.04, order: 'statecap', gov: 'soc', cap: 0.85, legit: 0.62, debt: 0.96, defBias: 0.04, coh: 0.6, eCoh: 0.7, sov: 1, nuke: true,
      I: 0.85, D: 0.72, AI: 0.1, urban: 0.66, edu: 0.8, omega: 0.43, eo: 0.5, digSov: 0.85, rep: 0.75, platPow: 0.5, humil: 0.3,
      C: { ideo: ideo({ trad: 0.05, rel: 0.05, lib: 0.05, socdem: 0.1, soc: 0.3, nat: 0.38, tech: 0.04, green: 0.03 }), org: 0.08 },
      A: { ideo: ideo({ trad: 0.03, rel: 0.03, lib: 0.1, socdem: 0.1, soc: 0.25, nat: 0.35, tech: 0.1, green: 0.04 }), org: 0.12 },
      E: { ideo: ideo({ soc: 0.4, nat: 0.4, tech: 0.15, lib: 0.05 }) } },
    GS: { pop: 5000, convF: 0.4, y: 8, regime: 'hybrid', inc: 0.4, order: 'neoliberal', gov: 'nat', cap: 0.4, legit: 0.45, debt: 0.62, defBias: 0.02, coh: 0.4, eCoh: 0.4, sov: 1,
      I: 0.55, D: 0.55, AI: 0.03, urban: 0.5, edu: 0.65, omega: 0.55, eo: 0.5, digSov: 0.15, rep: 0.35, platPow: 0.08,
      C: { ideo: ideo({ trad: 0.1, rel: 0.3, lib: 0.12, socdem: 0.12, soc: 0.06, nat: 0.22, neolib: 0.03, tech: 0.02, green: 0.03 }), org: 0.2 },
      A: { ideo: ideo({ trad: 0.04, rel: 0.18, lib: 0.2, socdem: 0.12, soc: 0.08, nat: 0.25, neolib: 0.04, tech: 0.06, green: 0.03 }), org: 0.25 },
      E: { ideo: ideo({ trad: 0.1, rel: 0.15, lib: 0.25, nat: 0.25, neolib: 0.2, tech: 0.05 }) } },
  };
  // хто чим «озброєний» ядерно і з якого року (стримує прямі війни між такими блоками)
  H.NUKES = { US: 1945, RU: 1949, EU: 1952, CN: 1964 };
  // наскільки старіння населення гальмуватиме економіку до 2075 (наближено, за прогнозами ООН)
  H.AGING = { US: 0.05, EU: 0.15, UA: 0.25, RU: 0.2, CN: 0.28, GS: -0.05 };

  /* ---------- Реальна історія (узагальнено до 9 «систем») ----------
     Блоки — агрегати: усередині ЄС чи Глобального Півдня завжди були різні режими.
     Тут показано переважний тип за населенням. */
  H.HISTORY = {
    US: [[1900, 'libdem'], [1933, 'socdem'], [1981, 'libdem']],
    EU: [[1900, 'oligarchic'], [1919, 'libdem'], [1933, 'autocratic'], [1945, 'socdem']],
    UA: [[1900, 'dominated'], [1917, 'collapse'], [1922, 'dominated'], [1991, 'oligarchic'], [2014, 'libdem']],
    RU: [[1900, 'autocratic'], [1917, 'collapse'], [1922, 'socialist'], [1992, 'oligarchic'], [2012, 'autocratic']],
    CN: [[1900, 'autocratic'], [1912, 'collapse'], [1928, 'autocratic'], [1937, 'collapse'], [1950, 'socialist'], [1978, 'autocratic']],
    GS: [[1900, 'dominated'], [1950, 'autocratic'], [1990, 'oligarchic']],
  };
  H.historyAt = function (id, year) {
    let c = null;
    for (const [y, cat] of H.HISTORY[id]) if (year >= y) c = cat;
    return c;
  };

  /* ---------- Історичні шоки (режим «з реальними шоками») ----------
     Модель отримує зовнішні поштовхи, а реакцію на них (революції, реформи, переходи)
     рахує сама. */
  H.SHOCKS = [
    { year: 1914, type: 'war', sides: [['EU'], ['RU']], until: 1918, key: 'ww1' },
    { year: 1917, type: 'joinwar', bloc: 'US', side: 1, key: 'usJoins' },
    { year: 1918, type: 'pandemic', sev: 0.02, key: 'flu' },
    { year: 1929, type: 'crash', sev: 0.35, len: 4, key: 'depression' },
    { year: 1937, type: 'invasion', bloc: 'CN', until: 1945, key: 'japan' },
    { year: 1939, type: 'war', sides: [['EU'], ['RU']], until: 1945, key: 'ww2' },
    { year: 1941, type: 'joinwar', bloc: 'US', side: 1, key: 'usJoins2' },
    { year: 1973, type: 'oil', sev: 0.04, key: 'oil' },
    { year: 2008, type: 'crash', sev: 0.07, len: 2, key: 'gfc' },
    { year: 2014, type: 'tension', a: 'RU', b: 'UA', val: 0.9, key: 'crimea' },
    { year: 2020, type: 'pandemic', sev: 0.006, gdp: 0.04, key: 'covid' },
    { year: 2022, type: 'war', sides: [['RU'], ['UA']], until: null, key: 'invasion2022' },
  ];

  /* ---------- Технологічний фронт ---------- */
  H.frontier = function (year, scen) {
    const lerp = (pts) => {
      if (year <= pts[0][0]) return pts[0][1];
      for (let i = 1; i < pts.length; i++) if (year <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * (year - a) / (b - a); }
      return pts[pts.length - 1][1];
    };
    const I = lerp([[1900, 0.3], [1930, 0.55], [1960, 0.82], [1985, 0.97], [2000, 1]]);
    const D = lerp([[1950, 0], [1975, 0.05], [1995, 0.22], [2010, 0.62], [2025, 0.88], [2040, 0.97], [2060, 1]]);
    let A = lerp([[2005, 0], [2015, 0.03], [2025, 0.14]]);
    if (year > 2025) {
      const sp = scen ? scen.ai : 0.5;                 // 0 — повільно, 1 — дуже швидко
      const k = 0.06 + 0.22 * sp, mid = 2062 - 30 * sp; // логістична крива автоматизації
      const target = 0.14 + 0.81 / (1 + Math.exp(-k * (year - mid)));
      A = Math.max(0.14, target);
    }
    return { I, D, A };
  };

  /* ---------- Умови сценарію (режим «майбутнє») ----------
     scope: global — діє на весь світ; blocs — можна обрати блоки; one — один блок (медійна персона)
     multi — можна додати кілька разів */
  H.CONDS = [
    { id: 'warming', scope: 'global', str: 0.4 },
    { id: 'ads', scope: 'blocs', str: 0.6 },
    { id: 'market', scope: 'blocs', str: 0.6 },
    { id: 'persona', scope: 'one', multi: true, str: 0.7, len: 8, ideo: 'nat', bloc: 'US' },
    { id: 'celebs', scope: 'blocs', str: 0.6 },
    { id: 'ubi', scope: 'blocs', str: 0.6, from: 2035 },
    { id: 'unions', scope: 'blocs', str: 0.6 },
    { id: 'migration', scope: 'global', str: 0.5 },
    { id: 'energy', scope: 'global', str: 0.6, from: 2040 },
    { id: 'openai', scope: 'global', str: 0.6 },
    { id: 'pandemics', scope: 'global', str: 0.5 },
  ];

  /* ---------- Джерела ---------- */
  H.SOURCES = [
    ['Maddison Project Database 2023 (ВВП на особу)', 'https://www.rug.nl/ggdc/historicaldevelopment/maddison/'],
    ['V-Dem Democracy Report 2026', 'https://www.v-dem.net/documents/75/V-Dem_Institute_Democracy_Report_2026_lowres.pdf'],
    ['World Inequality Database (частка верхніх 10%)', 'https://wid.world/'],
    ['IMF Fiscal Monitor, квітень 2026 (держборг)', 'https://www.mappr.co/public-debt-by-country/'],
    ['P. Turchin, структурно-демографічна теорія', 'https://escholarship.org/content/qt6qp8x28p/qt6qp8x28p.pdf'],
    ['Y. Varoufakis, «Technofeudalism» (огляд Г. Ловінка)', 'https://www.yanisvaroufakis.eu/2024/04/01/technofeudalism-reviewed-by-geert-lovink/'],
    ['E. Morozov, критика технофеодалізму (Jacobin)', 'https://jacobin.com/2023/04/evgeny-morozov-critique-of-techno-feudalism-modes-of-production-capitalism'],
    ['C. Durand відповідає Морозову (Verso)', 'https://www.versobooks.com/blogs/news/where-is-digital-technology-taking-us-cedric-durand-responds-to-evgeny-morozov'],
  ];
})(window.H = window.H || {});

/* ---------- Ключові повороти ХХ століття: перевірка «у правильному вікні» ---------- */
(function (H) {
  'use strict';
  // test: чи відбулася подія у вікні [from, to]; given — умова, без якої подія не має сенсу
  H.TURNS = [
    { id: 'ruRevolution', bloc: 'RU', from: 1905, to: 1925, test: (r) => r.some(x => x.y >= 1905 && x.y <= 1925 && x.cat !== 'autocratic') },
    { id: 'cnCollapse', bloc: 'CN', from: 1905, to: 1930, test: (r) => r.some(x => x.y >= 1905 && x.y <= 1930 && x.cat === 'collapse') },
    { id: 'uaIndependence1917', bloc: 'UA', from: 1915, to: 1925, test: (r) => r.some(x => x.y >= 1915 && x.y <= 1925 && x.cat !== 'dominated') },
    { id: 'uaReconquered', bloc: 'UA', from: 1918, to: 1940, given: (r) => r.some(x => x.y >= 1915 && x.y <= 1925 && x.cat !== 'dominated'), test: (r) => r.some(x => x.y >= 1919 && x.y <= 1940 && x.cat === 'dominated') },
    { id: 'usNewDeal', bloc: 'US', from: 1929, to: 1945, test: (r) => r.some(x => x.y >= 1929 && x.y <= 1945 && x.order === 'welfare') },
    { id: 'euAuthoritarian', bloc: 'EU', from: 1920, to: 1940, test: (r) => r.some(x => x.y >= 1920 && x.y <= 1940 && (x.cat === 'autocratic' || x.cat === 'socialist')) },
    { id: 'euDemocracy1955', bloc: 'EU', from: 1955, to: 1960, test: (r) => r.filter(x => x.y >= 1955 && x.y <= 1960).every(x => x.cat === 'libdem' || x.cat === 'socdem') },
    { id: 'decolonization', bloc: 'GS', from: 1940, to: 1970, test: (r) => r.some(x => x.y >= 1940 && x.y <= 1970 && x.sov >= 0.5) && r.every(x => x.y >= 1940 || x.sov < 0.5) },
    { id: 'neoliberalTurn', bloc: 'US', from: 1970, to: 1995, test: (r) => r.some(x => x.y >= 1970 && x.y <= 1995 && x.order === 'neoliberal') },
    { id: 'ruPlanEnds', bloc: 'RU', from: 1980, to: 2000, given: (r) => r.some(x => x.y < 1980 && x.order === 'planned'), test: (r) => { const a = r.find(x => x.y === 1979); return a && a.order === 'planned' && r.some(x => x.y >= 1980 && x.y <= 2000 && x.order !== 'planned'); } },
    { id: 'cnReform', bloc: 'CN', from: 1970, to: 1995, given: (r) => r.some(x => x.y >= 1950 && x.y < 1970 && x.order === 'planned'), test: (r) => r.some(x => x.y >= 1970 && x.y <= 1995 && x.order !== 'planned') },
    { id: 'uaIndependence1991', bloc: 'UA', from: 1985, to: 2000, given: (r) => r.some(x => x.y >= 1960 && x.y <= 1984 && x.cat === 'dominated'), test: (r) => r.some(x => x.y >= 1985 && x.y <= 2000 && x.cat !== 'dominated') },
    { id: 'usStaysDemocratic', bloc: 'US', from: 1900, to: 2024, test: (r) => r.filter(x => x.y <= 2024).every(x => x.cat === 'libdem' || x.cat === 'socdem') },
  ];
  H.checkTurn = function (t, sim) {
    const r = sim.blocs[t.bloc].rec;
    if (t.given && !t.given(r)) return null;
    return !!t.test(r);
  };
})(window.H = window.H || {});
