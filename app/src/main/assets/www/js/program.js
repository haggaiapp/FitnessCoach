/* תוכנית האימונים, מצב שמור והתקדמות הדרגתית */
(function () {
  'use strict';
  const { byId } = window.EXDB;

  const LEVELS = [
    { n: 'מתחיל', sets: 2, rest: 60, f: 1.0, wu: 30, desc: 'בניית בסיס, טכניקה נכונה והרגל אימון' },
    { n: 'בסיסי', sets: 3, rest: 60, f: 1.2, wu: 30, desc: 'הגדלת נפח, הוספת תרגילים חדשים' },
    { n: 'בינוני', sets: 3, rest: 50, f: 1.45, wu: 40, desc: 'עצימות גבוהה יותר ותרגילים מורכבים' },
    { n: 'מתקדם', sets: 4, rest: 45, f: 1.7, wu: 40, desc: 'כוח וסיבולת – מנוחות קצרות' },
    { n: 'מומחה', sets: 4, rest: 40, f: 2.0, wu: 45, desc: 'אתגר מלא – נפח ועצימות מקסימליים' }
  ];
  const WEEKS = [
    { n: 'שבוע הסתגלות', f: 1.0 }, { n: 'שבוע בנייה', f: 1.1 }, { n: 'שבוע שיא', f: 1.2 }, { n: 'שבוע התאוששות', f: 0.9 }
  ];
  const DAYS = ['A', 'B', 'C', 'D'];
  const DAYINFO = {
    A: { n: 'פלג גוף עליון ומשקולות', s: 'חזה · כתפיים · גב · ידיים', icon: '💪' },
    B: { n: 'בטן וליבה', s: 'בטן · אלכסוניים · גב תחתון', icon: '🎯' },
    C: { n: 'רגליים וישבן', s: 'ירכיים · ישבן · שוקיים', icon: '🦵' },
    D: { n: 'אימון מכשיר – גוף מלא', s: 'חזה · גב · רגליים · ידיים', icon: '⚙️' },
    D0: { n: 'מעגל גוף מלא', s: 'כל הגוף · דופק', icon: '⚡' }
  };
  const MAIN = {
    A: [['kneepush', 'dbpress', 'dbrow', 'dbcurl', 'plank'],
      ['pushup', 'dbpress', 'dbrow', 'lateral', 'chairdips', 'dbcurl', 'plank'],
      ['pushup', 'spiderman', 'dbpress', 'dbrow', 'ohext', 'hammer', 'rollplank'],
      ['pushup', 'pike', 'mantis', 'dbrow', 'lateral', 'frontraise', 'ohext', 'reversepush'],
      ['walkout', 'pike', 'spiderman', 'dbpress', 'dbrow', 'lateral', 'ohext', 'burpee']],
    B: [['butterfly', 'deadbug', 'plank', 'birddog', 'superman'],
      ['butterfly', 'bicycle', 'legdrops', 'deadbug', 'plank', 'birddog'],
      ['butterfly', 'oblique', 'toetouch', 'mountain', 'legdrops', 'plank'],
      ['suitcase', 'oblique', 'toetouch', 'mountain', 'bicycle', 'rollplank', 'plank'],
      ['suitcase', 'toetouch', 'oblique', 'legdrops', 'mountain', 'bicycle', 'rollplank', 'plank']],
    C: [['squat', 'glutebridge', 'calfraise', 'superman'],
      ['goblet', 'lunge', 'rdl', 'glutebridge', 'calfraise'],
      ['goblet', 'dblunge', 'rdl', 'glutebridge', 'dbcalf', 'superman'],
      ['goblet', 'dblunge', 'rdl', 'squat', 'glutebridge', 'dbcalf', 'burpee'],
      ['goblet', 'dblunge', 'rdl', 'lunge', 'glutebridge', 'dbcalf', 'burpee', 'superman']],
    D: [['mchest', 'latpull', 'legext', 'legcurl', 'pushdown'],
      ['mchest', 'latpull', 'mrow', 'legext', 'legcurl', 'pushdown'],
      ['mchest', 'latpull', 'mrow', 'legext', 'legcurl', 'pushdown', 'cablecurl'],
      ['mchest', 'latpull', 'mrow', 'legext', 'legcurl', 'pushdown', 'cablecurl', 'plank'],
      ['mchest', 'latpull', 'mrow', 'legext', 'legcurl', 'pushdown', 'cablecurl', 'mountain']],
    D0: [['squat', 'kneepush', 'dbrow', 'glutebridge', 'plank'],
      ['goblet', 'pushup', 'dbrow', 'dbpress', 'plank', 'birddog'],
      ['goblet', 'pushup', 'dbrow', 'dbpress', 'burpee', 'mountain'],
      ['goblet', 'spiderman', 'dbrow', 'dbpress', 'burpee', 'mountain', 'rdl'],
      ['dblunge', 'walkout', 'dbrow', 'dbpress', 'burpee', 'mountain', 'rdl']]
  };
  const WARM = {
    A: ['march', 'jacks', 'armcircles', 'armswing', 'inchworm'],
    B: ['march', 'jacks', 'hiphinge', 'highknees', 'inchworm'],
    C: ['march', 'legswing', 'hiphinge', 'squat', 'jacks'],
    D: ['march', 'jacks', 'armcircles', 'armswing', 'hiphinge']
  };
  const COOL = {
    A: ['tricepstretch', 'cobra', 'childpose'], B: ['cobra', 'childpose', 'hamstretch'],
    C: ['quadstretch', 'hamstretch', 'childpose'], D: ['tricepstretch', 'quadstretch', 'hamstretch', 'childpose']
  };
  const WT = { s: [2, 2, 3, 3, 4], m: [3, 4, 5, 6, 8], l: [4, 6, 8, 10, 12] };
  const MW = { mchest: 10, latpull: 15, mrow: 15, legext: 10, legcurl: 10, pushdown: 10, cablecurl: 5 };

  // ---------- מצב ----------
  const KEY = 'fitcoach.v1';
  const DEF = () => ({
    onboarded: false, level: 1, unlocked: 1, done: { 1: [], 2: [], 3: [], 4: [], 5: [] }, history: [], weights: {},
    adapt: { A: 1, B: 1, C: 1, D: 1 },
    settings: { voice: true, count: true, beeps: true, auto: true, speed: 1, restMul: 1, machine: true, dbs: [1, 2, 3, 4, 5, 6, 8, 10, 12], scale: 1, coach: true }
  });
  let state;
  function load() {
    try { state = Object.assign(DEF(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { state = DEF(); }
    state.settings = Object.assign(DEF().settings, state.settings || {});
    return state;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } }
  function reset() { state = DEF(); save(); return state; }

  // ---------- חישובים ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function dayType(i) { return DAYS[i % 4]; }
  function weekOf(i) { return Math.floor(i / 4); }
  function amount(ex, lvl, wk, adapt, phase) {
    const L = LEVELS[lvl - 1];
    if (phase !== 'main') return ex.type === 'time' ? L.wu : Math.round(ex.base * 0.8);
    const v = ex.base * L.f * WEEKS[wk].f * (adapt || 1);
    if (ex.type === 'time') return clamp(Math.round(v / 5) * 5, 15, 150);
    return clamp(Math.round(v), 3, 60);
  }
  function suggestWeight(ex, lvl) {
    if (state.weights[ex.id] != null) return state.weights[ex.id];
    if (ex.eq === 'machine') return (MW[ex.id] || 10) + (lvl - 1) * 5;
    if (ex.eq !== 'db') return null;
    const target = WT[ex.wt || 'm'][lvl - 1];
    const list = (state.settings.dbs || [2, 4, 6]).slice().sort((a, b) => a - b);
    let best = list[0];
    list.forEach((w) => { if (Math.abs(w - target) < Math.abs(best - target)) best = w; });
    return best;
  }
  function stepWeight(ex, cur, dir) {
    if (ex.eq === 'machine') return Math.max(0, (cur || 0) + dir * 5);
    const list = (state.settings.dbs || [2, 4, 6]).slice().sort((a, b) => a - b);
    let i = list.indexOf(cur); if (i < 0) i = 0;
    return list[clamp(i + dir, 0, list.length - 1)];
  }
  // סך הלולאות (חזרות) שנספרות ע"י ההדמיה
  function loopsFor(ex, amt) { return ex.side ? (ex.anim.alt ? amt : amt * 2) : amt; }

  function buildWorkout(lvl, idx, opts) {
    opts = opts || {};
    const type = dayType(idx), wk = weekOf(idx), L = LEVELS[lvl - 1];
    const machine = state.settings.machine;
    const mkey = type === 'D' && !machine ? 'D0' : type;
    const adapt = state.adapt[type] || 1;
    const restMul = state.settings.restMul || 1;
    const warm = WARM[type].filter((id) => byId[id].lv <= lvl).slice(0, 5);
    const main = MAIN[mkey][lvl - 1].filter((id) => byId[id]);
    const cool = COOL[type];
    const steps = [];
    const push = (s) => steps.push(s);
    push({ kind: 'ready', phase: 'warmup', secs: 8, next: warm[0] });
    warm.forEach((id, i) => {
      const ex = byId[id];
      push({ kind: 'ex', phase: 'warmup', id, set: 1, sets: 1, amt: amount(ex, lvl, wk, 1, 'warmup'), type: 'time' });
      if (i < warm.length - 1) push({ kind: 'rest', phase: 'warmup', secs: 8, next: warm[i + 1], short: true });
    });
    push({ kind: 'rest', phase: 'main', secs: 25, next: main[0], label: 'סיום חימום – שתו מים' });
    main.forEach((id, i) => {
      const ex = byId[id];
      const sets = L.sets;
      for (let s = 1; s <= sets; s++) {
        push({ kind: 'ex', phase: 'main', id, set: s, sets, amt: amount(ex, lvl, wk, adapt, 'main'), type: ex.type });
        const last = i === main.length - 1 && s === sets;
        if (!last) {
          const between = s === sets;
          push({ kind: 'rest', phase: 'main', secs: Math.round((between ? L.rest + 15 : L.rest) * restMul / 5) * 5, next: between ? main[i + 1] : id, sameEx: !between });
        }
      }
    });
    push({ kind: 'rest', phase: 'cool', secs: 15, next: cool[0], label: 'כל הכבוד! עוברים לשחרור' });
    cool.forEach((id, i) => {
      push({ kind: 'ex', phase: 'cool', id, set: 1, sets: 1, amt: 30, type: 'time' });
      if (i < cool.length - 1) push({ kind: 'rest', phase: 'cool', secs: 5, next: cool[i + 1], short: true });
    });
    push({ kind: 'done' });
    const info = DAYINFO[mkey];
    return { lvl, idx, type, mkey, wk, title: info.n, sub: info.s, icon: info.icon, warm, main, cool, steps, est: estimate(steps) };
  }
  function estimate(steps) {
    let t = 0;
    steps.forEach((s) => {
      if (s.kind === 'rest' || s.kind === 'ready') t += s.secs;
      else if (s.kind === 'ex') {
        const ex = byId[s.id];
        t += s.type === 'time' ? s.amt : loopsFor(ex, s.amt) * (ex.anim.dur || 2) + 4;
      }
    });
    return Math.round(t / 60);
  }
  function nextIndex(lvl) {
    const d = state.done[lvl] || [];
    for (let i = 0; i < 16; i++) if (d.indexOf(i) < 0) return i;
    return 0;
  }
  function complete(w, info) {
    const d = state.done[w.lvl] = state.done[w.lvl] || [];
    if (d.indexOf(w.idx) < 0) d.push(w.idx);
    const fb = info.feedback;
    const k = fb === 'easy' ? 1.1 : fb === 'hard' ? 0.9 : 1.02;
    state.adapt[w.type] = clamp((state.adapt[w.type] || 1) * k, 0.7, 1.5);
    // התאמת משקלים לפי משוב
    if (fb === 'easy' || fb === 'hard') {
      w.main.forEach((id) => {
        const ex = byId[id];
        if (ex.eq === 'db' || ex.eq === 'machine') {
          const cur = state.weights[id] != null ? state.weights[id] : suggestWeight(ex, w.lvl);
          state.weights[id] = stepWeight(ex, cur, fb === 'easy' ? 1 : -1);
        }
      });
    }
    state.history.unshift({ date: new Date().toISOString(), lvl: w.lvl, idx: w.idx, type: w.type, title: w.title, dur: info.dur, sets: info.sets, reps: info.reps, feedback: fb });
    state.history = state.history.slice(0, 300);
    let unlockedNow = false;
    if (d.length >= 12 && w.lvl < 5 && state.unlocked <= w.lvl) { state.unlocked = w.lvl + 1; unlockedNow = true; }
    save();
    return { unlockedNow };
  }
  function streak() {
    const days = new Set(state.history.map((h) => h.date.slice(0, 10)));
    let s = 0; const d = new Date();
    // רצף ימים עם אימון (מאפשר יום מנוחה אחד בין אימונים)
    for (let i = 0, gap = 0; i < 400; i++) {
      const k = new Date(d.getTime() - i * 864e5).toISOString().slice(0, 10);
      if (days.has(k)) { s++; gap = 0; } else if (++gap > 2) break;
    }
    return s;
  }

  window.Program = { LEVELS, WEEKS, DAYS, DAYINFO, load, save, reset, get state() { return state; }, buildWorkout, nextIndex, complete, suggestWeight, stepWeight, loopsFor, amount, streak, dayType, weekOf };
})();
