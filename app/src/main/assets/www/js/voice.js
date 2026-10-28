/* קול מאמן (TTS בעברית), צלילים וניווט בשלט (טלוויזיה) */
(function () {
  'use strict';
  let heVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    heVoice = vs.find((v) => /^(he|iw)/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  const Voice = {
    enabled: true,
    speak(text, flush) {
      if (!this.enabled || !text) return;
      try {
        if (window.AndroidTTS && window.AndroidTTS.speak) { window.AndroidTTS.speak(String(text), flush === false ? 0 : 1); return; }
        if (!('speechSynthesis' in window)) return;
        if (flush !== false) speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'he-IL'; if (heVoice) u.voice = heVoice; u.rate = 1.02;
        speechSynthesis.speak(u);
      } catch (e) { }
    },
    stop() { try { if (window.AndroidTTS) window.AndroidTTS.stop(); else if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { } }
  };

  let ctx = null;
  const Sound = {
    enabled: true,
    beep(freq, ms, vol) {
      if (!this.enabled) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq || 880;
        g.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ms || 150) / 1000);
        o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + (ms || 150) / 1000 + 0.02);
      } catch (e) { }
    },
    tick() { this.beep(660, 90, 0.18); },
    go() { this.beep(990, 260, 0.3); },
    done() { this.beep(784, 160); setTimeout(() => this.beep(1046, 280), 170); }
  };

  // ---------- ניווט מרחבי בשלט ----------
  const FOCUSABLE = 'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, a[href]';
  function visible(e) {
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(e);
    return st.visibility !== 'hidden' && st.display !== 'none' && e.offsetParent !== null;
  }
  function scope() {
    const m = document.querySelector('.modal.open:last-of-type') || document.querySelector('.modal.open');
    if (m) return m;
    const p = document.querySelector('#player.open');
    return p || document.body;
  }
  function move(dirKey) {
    const root = scope();
    const items = Array.from(root.querySelectorAll(FOCUSABLE)).filter(visible);
    if (!items.length) return;
    const cur = document.activeElement;
    if (!cur || cur === document.body || !root.contains(cur)) { items[0].focus(); return; }
    const a = cur.getBoundingClientRect();
    const ac = [a.left + a.width / 2, a.top + a.height / 2];
    let best = null, bs = Infinity;
    items.forEach((e) => {
      if (e === cur) return;
      const b = e.getBoundingClientRect();
      const bc = [b.left + b.width / 2, b.top + b.height / 2];
      const dx = bc[0] - ac[0], dy = bc[1] - ac[1];
      let main, cross;
      if (dirKey === 'ArrowRight') { if (b.left < a.right - 4 && dx <= 4) return; main = dx; cross = dy; }
      else if (dirKey === 'ArrowLeft') { if (b.right > a.left + 4 && dx >= -4) return; main = -dx; cross = dy; }
      else if (dirKey === 'ArrowDown') { if (b.top < a.bottom - 4 && dy <= 4) return; main = dy; cross = dx; }
      else { if (b.bottom > a.top + 4 && dy >= -4) return; main = -dy; cross = dx; }
      if (main <= 0) return;
      const score = main + Math.abs(cross) * 2.2;
      if (score < bs) { bs = score; best = e; }
    });
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (tag === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
      if (tag === 'INPUT' && e.target.type === 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
      if (tag === 'SELECT') return;
      e.preventDefault(); move(e.key);
      document.body.classList.add('kbd');
    }
  });
  document.addEventListener('pointerdown', () => document.body.classList.remove('kbd'));

  window.Voice = Voice; window.Sound = Sound; window.SpatialNav = { move };
})();
