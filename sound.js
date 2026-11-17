/* =========================================================
   SOUND
   The cues are pre-rendered WAVs in sounds/, cut from the
   ultron_blast machine (~/sfx: `python -m sfx.ironlog sounds`).
   Synthesis that dense — 140 drifting harmonics, ring-mod
   clusters, two halls — is rendered offline, not in the browser.

   Files are fetched at page load and decoded on the first
   gesture (Sfx.wake), so the first cue is ready by the time
   anyone needs it.
   ========================================================= */
(function () {
  'use strict';

  const NAMES = ['tap', 'count3', 'count2', 'count1', 'go', 'log', 'down', 'finish'];

  // Start downloading immediately; decoding needs an AudioContext, which needs a gesture.
  const raw = {};
  NAMES.forEach(n => {
    raw[n] = fetch('sounds/' + n + '.wav').then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
  });

  let ctx = null, on = true;
  const buffers = {};

  function decode(data) {
    // Safari before 14.1 only has the callback form.
    return new Promise((resolve, reject) => {
      const p = ctx.decodeAudioData(data, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }

  function wake() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); }
      catch (e) { ctx = null; return; }
      NAMES.forEach(n => raw[n].then(d => d && decode(d)).then(b => { if (b) buffers[n] = b; }).catch(() => {}));
    }
    if (ctx.state !== 'running') ctx.resume();
  }

  // rate: a small playback-rate nudge, so a hundred taps never sound like one sample on repeat.
  function play(name, rate) {
    if (!on || !ctx || !buffers[name]) return;
    if (ctx.state !== 'running') ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    if (rate) src.playbackRate.value = rate;
    src.connect(ctx.destination);
    src.start();
  }

  window.Sfx = {
    wake,
    setOn(v) { on = !!v; },
    tap() { play('tap', 0.96 + Math.random() * 0.08); },
    count(n) { play('count' + (n >= 1 && n <= 3 ? n : 3)); },
    go() { play('go'); },
    log() { play('log'); },
    down() { play('down'); },
    finish() { play('finish'); }
  };
})();
