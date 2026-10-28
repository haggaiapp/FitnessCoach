/* מנוע הדמיה – דמות מונפשת (SVG) */
(function () {
  'use strict';
  const L = { T: 50, UA: 28, FA: 26, TH: 40, SH: 38, NECK: 7, HR: 10.5, FOOT: 13 };
  const G = 180; // קו הרצפה
  const R = Math.PI / 180;
  const NS = 'http://www.w3.org/2000/svg';

  const dir = (a) => [Math.cos(a * R), Math.sin(a * R)];
  const add = (p, a, len) => { const d = dir(a); return [p[0] + d[0] * len, p[1] + d[1] * len]; };
  const ang = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]) / R;

  // IK דו-מפרקי: מחזיר [זווית1, זווית2]
  function ik(o, p, l1, l2, k) {
    let dx = p[0] - o[0], dy = p[1] - o[1];
    let d = Math.hypot(dx, dy);
    d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, d));
    const base = Math.atan2(dy, dx);
    const c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const a1 = base + (k || 1) * Math.acos(c);
    const j = [o[0] + Math.cos(a1) * l1, o[1] + Math.sin(a1) * l1];
    const reach = [o[0] + Math.cos(base) * d, o[1] + Math.sin(base) * d];
    const a2 = Math.atan2(reach[1] - j[1], reach[0] - j[0]);
    return [a1 / R, a2 / R];
  }

  // המרת מפרט תנוחה לתנוחה מלאה
  function resolve(s) {
    let hip, t = s.t == null ? -90 : s.t;
    if (s.feet) {
      const lt = s.lt;
      hip = add(s.feet, lt + 180, L.TH + L.SH);
    } else if (s.knee) {
      hip = add(s.knee, s.th + 180, L.TH);
    } else hip = [s.x == null ? 160 : s.x, s.y == null ? G - L.TH - L.SH : s.y];
    if (s.tTo) t = ang(hip, s.tTo);
    const sh = add(hip, t, L.T);
    const limb = (spec, origin, l1, l2, def) => {
      if (!spec) return def.slice();
      if (Array.isArray(spec)) return spec.slice();
      return ik(origin, spec.h, l1, l2, spec.k);
    };
    let ldef = [90, 90];
    if (s.feet) ldef = [s.lt, s.lt];
    if (s.knee) ldef = [s.th, s.sk == null ? 180 : s.sk];
    const a = limb(s.a, sh, L.UA, L.FA, [92, 90]);
    const b = limb(s.b || s.a, sh, L.UA, L.FA, [88, 88]);
    const l = limb(s.l, hip, L.TH, L.SH, ldef);
    const m = limb(s.m || s.l, hip, L.TH, L.SH, ldef);
    const f = s.f != null ? s.f : null, g = s.g != null ? s.g : (s.f != null ? s.f : null);
    return { hip, t, a, b, l, m, f, g, hd: s.hd || 0 };
  }

  function lerpA(a, b, k) { let d = ((b - a + 540) % 360) - 180; return a + d * k; }
  function lerpPose(p, q, k) {
    const la = (x, y) => [lerpA(x[0], y[0], k), lerpA(x[1], y[1], k)];
    const lf = (x, y, sx, sy) => {
      const fx = x == null ? sx - 90 : x, fy = y == null ? sy - 90 : y;
      return lerpA(fx, fy, k);
    };
    return {
      hip: [p.hip[0] + (q.hip[0] - p.hip[0]) * k, p.hip[1] + (q.hip[1] - p.hip[1]) * k],
      t: lerpA(p.t, q.t, k), a: la(p.a, q.a), b: la(p.b, q.b), l: la(p.l, q.l), m: la(p.m, q.m),
      f: lf(p.f, q.f, p.l[1], q.l[1]), g: lf(p.g, q.g, p.m[1], q.m[1]), hd: p.hd + (q.hd - p.hd) * k
    };
  }
  const ease = (x) => 0.5 - Math.cos(Math.PI * x) / 2;

  // דגימת אנימציה בזמן יחסי u ∈ [0,1)
  function sample(anim, u) {
    if (!anim._r) anim._r = anim.k.map(resolve);
    const ks = anim._r, n = ks.length;
    if (n === 1) return lerpPose(ks[0], ks[0], 0);
    const w = anim.w || ks.map(() => 1);
    const tot = w.reduce((x, y) => x + y, 0);
    let pos = (u % 1) * tot, i = 0;
    while (i < n - 1 && pos > w[i]) { pos -= w[i]; i++; }
    const k = Math.min(1, pos / w[i]);
    const hold = anim.hold || 0; // אחוז החזקה בקצה כל מקטע
    let kk = k < hold ? 0 : (k - hold) / (1 - hold);
    return lerpPose(ks[i], ks[(i + 1) % n], ease(Math.max(0, Math.min(1, kk))));
  }

  // ------- ציור -------
  const C = {
    skin: '#f0b98d', skinD: '#c98a62', shirt: '#14b8c8', shirtD: '#0e8290', shorts: '#23262d', shortsD: '#15171b',
    shoe: '#ffd21f', shoeD: '#d9ae00', hair: '#2b211c', db: '#3b4048', dbH: '#9aa3ad', prop: '#7d8794', propD: '#5a636f',
    pad: '#2f3540', cable: '#9aa3ad', mat: '#ffd21f'
  };

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const ln = (g, w, c) => el('line', { 'stroke-width': w, stroke: c, 'stroke-linecap': 'round' }, g);
  const setL = (e, p, q) => { e.setAttribute('x1', p[0].toFixed(1)); e.setAttribute('y1', p[1].toFixed(1)); e.setAttribute('x2', q[0].toFixed(1)); e.setAttribute('y2', q[1].toFixed(1)); };

  class Figure {
    constructor(container, opts) {
      opts = opts || {};
      this.svg = el('svg', { viewBox: '0 -18 320 218', class: 'fig-svg', preserveAspectRatio: 'xMidYMid meet', role: 'img', style: 'overflow:hidden' });
      const defs = el('defs', {}, this.svg);
      const lg = el('linearGradient', { id: 'bgg' + (Figure._n = (Figure._n || 0) + 1), gradientUnits: 'userSpaceOnUse', x1: 0, y1: -18, x2: 0, y2: 182 }, defs);
      el('stop', { offset: '0', 'stop-color': opts.bg1 || '#f3f5f8' }, lg);
      el('stop', { offset: '1', 'stop-color': opts.bg2 || '#d9dee5' }, lg);
      this.bg = el('rect', { x: -900, y: -900, width: 2120, height: 1082, fill: 'url(#' + lg.id + ')' }, this.svg);
      el('rect', { x: -900, y: G + 2, width: 2120, height: 900, fill: '#c9cfd8' }, this.svg);
      this.mat = el('rect', { x: 40, y: G - 1, width: 250, height: 6, rx: 2, fill: C.mat }, this.svg);
      this.shadow = el('ellipse', { cx: 160, cy: G + 4, rx: 50, ry: 4, fill: 'rgba(0,0,0,.15)' }, this.svg);
      this.propG = el('g', {}, this.svg);
      this.dynG = el('g', {}, this.svg);
      this.fig = el('g', {}, this.svg);
      if (container) container.appendChild(this.svg);
      this.anim = null; this.raf = 0; this.t0 = 0; this.onLoop = null; this.paused = false; this.speed = 1;
    }
    setExercise(ex) {
      this.ex = ex; this.anim = ex.anim; this.anim._r = null;
      this.view = ex.anim.view || 'side';
      this.build();
      this.draw(sample(this.anim, this.anim.thumb != null ? this.anim.thumb : 0.25));
    }
    build() {
      const f = this.fig; f.innerHTML = ''; this.propG.innerHTML = ''; this.dynG.innerHTML = '';
      const a = this.anim;
      this.mat.style.display = a.noMat ? 'none' : '';
      // אביזרים סטטיים
      (a.props || []).forEach((p) => this.drawProp(p));
      this.cables = (a.props || []).filter((p) => p.type === 'cable' || p.type === 'lever').map((p) => ({ p, e: ln(this.dynG, p.type === 'lever' ? 5 : 1.6, p.type === 'lever' ? C.propD : C.cable) }));
      this.pads = (a.props || []).filter((p) => p.type === 'anklepad').map((p) => ({ p, e: el('circle', { r: 6, fill: C.pad }, this.dynG) }));
      const P = {};
      if (this.view === 'front') {
        P.armL = [ln(f, 9, C.skin), ln(f, 8, C.skin)];
        P.legL = [ln(f, 12, C.skin), ln(f, 10, C.skin), ln(f, 7, C.shoe)];
        P.shortL = ln(f, 14, C.shorts);
        P.legR = [ln(f, 12, C.skin), ln(f, 10, C.skin), ln(f, 7, C.shoe)];
        P.shortR = ln(f, 14, C.shorts);
        P.torso = el('path', { fill: C.shirt }, f);
        P.armR = [ln(f, 9, C.skin), ln(f, 8, C.skin)];
        P.neck = ln(f, 7, C.skin);
        P.hair = el('circle', { r: L.HR + 1, fill: C.hair }, f);
        P.head = el('circle', { r: L.HR, fill: C.skin }, f);
      } else {
        P.armF = [ln(f, 8, C.skinD), ln(f, 7, C.skinD)];
        P.legF = [ln(f, 11, C.skinD), ln(f, 9.5, C.skinD), ln(f, 6.5, C.shoeD)];
        P.shortF = ln(f, 13.5, C.shortsD);
        P.torso = ln(f, 22, C.shirt);
        P.hipC = el('circle', { r: 11.5, fill: C.shorts }, f);
        P.legN = [ln(f, 11.5, C.skin), ln(f, 10, C.skin), ln(f, 7, C.shoe)];
        P.shortN = ln(f, 14, C.shorts);
        P.neck = ln(f, 7, C.skin);
        P.hair = el('circle', { r: L.HR + 0.8, fill: C.hair }, f);
        P.head = el('circle', { r: L.HR, fill: C.skin }, f);
        P.armN = [ln(f, 8.5, C.skin), ln(f, 7.5, C.skin)];
      }
      // משקולות
      this.dbs = [];
      if (a.db) {
        const mk = () => { const g = el('g', {}, f); ln(g, 3, C.dbH); ln(g, 7, C.db); ln(g, 7, C.db); return g; };
        if (a.db === 1) this.dbs.push({ g: mk(), hand: 'n' });
        else { this.dbs.push({ g: mk(), hand: 'f' }); this.dbs.push({ g: mk(), hand: 'n' }); }
        if (this.view !== 'front' && this.dbs.length === 2) f.insertBefore(this.dbs[0].g, P.legF[0]);
      }
      this.P = P;
    }
    drawProp(p) {
      const g = this.propG;
      switch (p.type) {
        case 'seat': el('rect', { x: p.x, y: p.y, width: p.w || 55, height: 7, rx: 3, fill: C.pad }, g);
          el('rect', { x: p.x + (p.w || 55) / 2 - 3, y: p.y + 7, width: 6, height: G - p.y - 7, fill: C.prop }, g);
          el('rect', { x: p.x + (p.w || 55) / 2 - 18, y: G - 3, width: 36, height: 4, rx: 2, fill: C.propD }, g); break;
        case 'back': el('rect', { x: p.x, y: p.y, width: 8, height: p.h, rx: 3, fill: C.pad, transform: `rotate(${p.r || 0} ${p.x + 4} ${p.y + p.h})` }, g); break;
        case 'post': el('rect', { x: p.x - 4, y: p.top == null ? 14 : p.top, width: 8, height: G - (p.top == null ? 14 : p.top), fill: C.prop }, g);
          if (p.beam) el('rect', { x: Math.min(p.x, p.beam), y: (p.top == null ? 14 : p.top), width: Math.abs(p.beam - p.x), height: 7, fill: C.prop }, g);
          el('rect', { x: p.x - 16, y: G - 3, width: 32, height: 5, rx: 2, fill: C.propD }, g); break;
        case 'pulley': el('circle', { cx: p.x, cy: p.y, r: 5, fill: C.propD, stroke: C.prop, 'stroke-width': 2 }, g); break;
        case 'pad': el('circle', { cx: p.x, cy: p.y, r: p.r || 7, fill: C.pad }, g); break;
        case 'bench': el('rect', { x: p.x, y: p.y, width: p.w, height: 8, rx: 3, fill: C.pad }, g);
          el('rect', { x: p.x + 10, y: p.y + 8, width: 5, height: G - p.y - 8, fill: C.prop }, g);
          el('rect', { x: p.x + p.w - 15, y: p.y + 8, width: 5, height: G - p.y - 8, fill: C.prop }, g); break;
        case 'chair': el('rect', { x: p.x, y: p.y, width: p.w || 42, height: 6, rx: 2, fill: '#8d6e52' }, g);
          el('rect', { x: p.x, y: p.y - 50, width: 6, height: 50, rx: 2, fill: '#8d6e52' }, g);
          el('rect', { x: p.x + 2, y: p.y + 6, width: 4, height: G - p.y - 6, fill: '#6f553f' }, g);
          el('rect', { x: p.x + (p.w || 42) - 6, y: p.y + 6, width: 4, height: G - p.y - 6, fill: '#6f553f' }, g); break;
        case 'plate': el('rect', { x: p.x, y: p.y, width: 14, height: p.h || 30, rx: 2, fill: C.propD }, g); break;
      }
    }
    joints(P) {
      const hip = P.hip, sh = add(hip, P.t, L.T);
      const head = add(sh, P.t + P.hd, L.NECK + L.HR);
      const arm = (a) => { const e = add(sh, a[0], L.UA); return [sh, e, add(e, a[1], L.FA)]; };
      const leg = (l, f) => { const k = add(hip, l[0], L.TH); const an = add(k, l[1], L.SH); const fa = f == null ? l[1] - 90 : f; return [hip, k, an, add(an, fa, L.FOOT)]; };
      return { hip, sh, head, aN: arm(P.a), aF: arm(P.b), lN: leg(P.l, P.f), lF: leg(P.m, P.g) };
    }
    draw(P) {
      this.pose = P;
      const E = this.P;
      if (this.view === 'front') {
        const cx = P.hip[0], hy = P.hip[1], sy = hy - L.T;
        const mir = (a) => 180 - a;
        const arm = (side, a) => { const s = [cx + side * 15, sy + 4]; const ua = side > 0 ? a[0] : mir(a[0]); const fa = side > 0 ? a[1] : mir(a[1]); const e = add(s, ua, L.UA); return [s, e, add(e, fa, L.FA)]; };
        const leg = (side, l) => { const h = [cx + side * 8, hy]; const th = side > 0 ? l[0] : mir(l[0]); const sh = side > 0 ? l[1] : mir(l[1]); const k = add(h, th, L.TH); const an = add(k, sh, L.SH); return [h, k, an, [an[0] + side * 7, an[1] + 2]]; };
        const aR = arm(1, P.a), aL = arm(-1, P.a), lR = leg(1, P.l), lLft = leg(-1, P.l);
        const setArm = (e, j) => { setL(e[0], j[0], j[1]); setL(e[1], j[1], j[2]); };
        const setLeg = (e, s, j) => { setL(e[0], j[0], j[1]); setL(e[1], j[1], j[2]); setL(e[2], j[2], j[3]); setL(s, j[0], [j[0][0] + (j[1][0] - j[0][0]) * .55, j[0][1] + (j[1][1] - j[0][1]) * .55]); };
        setArm(E.armL, aL); setArm(E.armR, aR); setLeg(E.legL, E.shortL, lLft); setLeg(E.legR, E.shortR, lR);
        E.torso.setAttribute('d', `M${cx - 18},${sy} L${cx + 18},${sy} Q${cx + 20},${sy + 8} ${cx + 13},${hy + 4} L${cx - 13},${hy + 4} Q${cx - 20},${sy + 8} ${cx - 18},${sy} Z`);
        const head = [cx, sy - L.NECK - L.HR + 2];
        setL(E.neck, [cx, sy + 2], [cx, head[1] + 4]);
        E.head.setAttribute('cx', head[0]); E.head.setAttribute('cy', head[1] + 1.5);
        E.hair.setAttribute('cx', head[0]); E.hair.setAttribute('cy', head[1] - 1.5);
        this.hands = { n: aR[2], f: aL[2], nE: aR[1], fE: aL[1] };
        this.feet = { n: lR[2], f: lLft[2] };
        this.shadow.setAttribute('cx', cx); this.shadow.setAttribute('rx', 34);
      } else {
        const J = this.joints(P);
        const setArm = (e, j) => { setL(e[0], j[0], j[1]); setL(e[1], j[1], j[2]); };
        const setLeg = (e, s, j) => { setL(e[0], j[0], j[1]); setL(e[1], j[1], j[2]); setL(e[2], j[2], j[3]); setL(s, j[0], [j[0][0] + (j[1][0] - j[0][0]) * .55, j[0][1] + (j[1][1] - j[0][1]) * .55]); };
        setArm(E.armF, J.aF); setArm(E.armN, J.aN);
        setLeg(E.legF, E.shortF, J.lF); setLeg(E.legN, E.shortN, J.lN);
        setL(E.torso, add(J.hip, P.t, 4), add(J.sh, P.t, -3));
        E.hipC.setAttribute('cx', J.hip[0]); E.hipC.setAttribute('cy', J.hip[1]);
        setL(E.neck, J.sh, add(J.sh, P.t + P.hd, L.NECK + 2));
        const face = dir(P.t + P.hd + 90);
        E.head.setAttribute('cx', (J.head[0] + face[0] * 1.2).toFixed(1)); E.head.setAttribute('cy', (J.head[1] + face[1] * 1.2).toFixed(1));
        const back = add(J.head, P.t + P.hd, 1.5);
        E.hair.setAttribute('cx', (back[0] - face[0] * 2.2).toFixed(1)); E.hair.setAttribute('cy', (back[1] - face[1] * 2.2).toFixed(1));
        this.hands = { n: J.aN[2], f: J.aF[2], nE: J.aN[1], fE: J.aF[1] };
        this.feet = { n: J.lN[2], f: J.lF[2] };
        const xs = [J.hip[0], J.sh[0], J.lN[3][0], J.aN[2][0]];
        const mn = Math.min(...xs), mx = Math.max(...xs);
        this.shadow.setAttribute('cx', ((mn + mx) / 2).toFixed(1)); this.shadow.setAttribute('rx', Math.max(25, (mx - mn) / 2 + 10).toFixed(1));
      }
      // משקולות
      this.dbs.forEach((d) => {
        const h = this.hands[d.hand], e = this.hands[d.hand + 'E'];
        let a = ang(e, h) + 90; // מאונך לאמה
        if (this.anim.dbAng != null) a = this.anim.dbAng;
        const p1 = add(h, a, 8), p2 = add(h, a, -8);
        const [bar, w1, w2] = d.g.children;
        setL(bar, p1, p2);
        setL(w1, add(h, a, 6), add(h, a, 10)); setL(w2, add(h, a, -6), add(h, a, -10));
      });
      // כבלים / ידיות
      (this.cables || []).forEach((c) => {
        const to = c.p.to === 'foot' ? this.feet.n : this.hands[c.p.hand || 'n'];
        setL(c.e, c.p.from, to);
      });
      (this.pads || []).forEach((c) => { const ft = this.feet.n; c.e.setAttribute('cx', ft[0].toFixed(1)); c.e.setAttribute('cy', (ft[1] - 1).toFixed(1)); });
    }
    frame(u) { this.draw(sample(this.anim, u)); }
    play(onLoop) {
      this.stop(); this.onLoop = onLoop || null; this.paused = false;
      let last = performance.now(), u = 0;
      const dur = (this.anim.dur || 2) * 1000;
      const loop = (now) => {
        const dt = now - last; last = now;
        if (!this.paused) {
          u += (dt * this.speed) / dur;
          if (u >= 1) { u -= 1; if (this.onLoop) this.onLoop(); }
          this.draw(sample(this.anim, u));
        }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
    pause(v) { this.paused = v; }
  }

  window.FigureEngine = { Figure, resolve, sample, ik, L, G };
})();
