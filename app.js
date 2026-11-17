/* =========================================================
   IRON LOG
   Data      -> current.json (see json_schema_docs.md)
   Notation  -> ProgrammingNotation.md
   Storage   -> localStorage: the live session and the history.
   ========================================================= */
'use strict';

/* ---------- small helpers ---------- */

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => Date.now();
const pad = n => String(n).padStart(2, '0');
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s % 60);
}
// Countdowns round up, so "0:01" is on screen for the whole last second.
const countdown = ms => clock(Math.ceil(ms / 1000) * 1000);
const secsText = s => s >= 60 ? Math.floor(s / 60) + ':' + pad(s % 60) : String(s);

const ICON = {
  close: '<svg viewBox="0 0 24 24"><path d="M5.6 4.2 12 10.6l6.4-6.4 1.4 1.4-6.4 6.4 6.4 6.4-1.4 1.4-6.4-6.4-6.4 6.4-1.4-1.4 6.4-6.4-6.4-6.4z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" class="day-arrow"><path d="M13 5l7 7-7 7-1.4-1.4 4.6-4.6H4v-2h12.2l-4.6-4.6z"/></svg>',
  play: '<svg viewBox="0 0 12 12"><path d="M2 1l9 5-9 5z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3zM15 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM17.8 5.7a9 9 0 0 1 0 12.6l-1.4-1.4a7 7 0 0 0 0-9.8z"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3zM15.3 9.7l1.4-1.4L19 10.6l2.3-2.3 1.4 1.4-2.3 2.3 2.3 2.3-1.4 1.4-2.3-2.3-2.3 2.3-1.4-1.4 2.3-2.3z"/></svg>'
};

/* ---------- storage (can throw in private mode; never fatal) ---------- */

const KEYS = { session: 'ironlog.session.v2', history: 'ironlog.history.v1', sound: 'ironlog.sound.v1' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  json(k, fallback) {
    const raw = this.get(k);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }
};

/* =========================================================
   NOTATION
   "5A120s"            -> 5 rounds of block A, 120s rest
   "KB Press 8'@16"    -> 8 reps each side at 16kg
   "RopeFlow :120@BW"  -> 120 seconds, bodyweight
   "10/8/6/4A120s"     -> ladder block: 4 rounds (rungs) of 10, 8, 6, 4 reps
   "KB Thruster @16+16/20+20/20+20/24+20"
                       -> inside a ladder: reps come from the rung, load per rung
   ========================================================= */

function parseHeader(h) {
  if (h === 'WU') return { kind: 'wu', letter: 'WU', label: 'Warm-up', rounds: 1, rest: 0 };
  if (h === 'FIN') return { kind: 'fin', letter: 'FIN', label: 'Finisher', rounds: 1, rest: 0 };
  const m = /^(\d+(?:\/\d+)*)([A-Z])(\d+)s?$/.exec(h);
  if (m) {
    const n = m[1].split('/').map(Number);
    const rungs = n.length > 1 ? n : null;
    return { kind: 'work', letter: m[2], label: 'Block ' + m[2], rounds: rungs ? rungs.length : n[0], rest: +m[3], rungs };
  }
  return { kind: 'work', letter: h, label: h, rounds: 1, rest: 0 };
}

// A ladder ("10/8/6/4", "16/20/24") steps one rung per round; extra rounds stay on the last rung.
// In a ladder block (rungs from the header) an exercise without reps does the rung's reps.
const rung = (list, round) => list[Math.min(round, list.length - 1)];

function parseExercise(line, round = 0, rungs = null) {
  const at = line.lastIndexOf('@');
  const body = (at > -1 ? line.slice(0, at) : line).trim();
  const loads = at > -1 ? line.slice(at + 1).trim().split('/') : null;
  const load = loads ? rung(loads, round) : null;
  const m = /^(.*?)\s+(:?)(\d+(?:\/\d+)*)(?:-(\d+))?(')?$/.exec(body);
  if (!m && rungs) return { raw: line, name: body, load, ladder: true, rungs, value: rung(rungs, round), hi: null, each: false, time: false, isRest: false, isCarry: false };
  if (!m) return { raw: line, name: body, load, value: null, ladder: loads && loads.length > 1 };
  const reps = m[3].split('/').map(Number);
  return {
    raw: line,
    name: m[1],
    load,
    ladder: reps.length > 1 || loads != null && loads.length > 1,
    rungs: reps,
    time: m[2] === ':',
    value: rung(reps, round),
    hi: m[4] ? +m[4] : null,
    each: !!m[5],
    isRest: /^rest$/i.test(m[1]),
    isCarry: /carry|walk/i.test(m[1])
  };
}

// Timed each-side holds need two passes to count as done.
const passesNeeded = ex => (ex.time && ex.each ? 2 : 1);

function doseText(ex) {
  if (ex.value == null) return '';
  if (ex.time) return secsText(ex.value) + (ex.value < 60 ? 's' : '') + (ex.each ? ' ea' : '');
  const n = ex.value + (ex.hi ? '–' + ex.hi : '');
  return n + (ex.isCarry ? ' steps' : '') + (ex.each ? ' ea' : '');
}

function parseLoad(load) {
  if (!load) return null;
  if (/^BW$/i.test(load)) return { bw: true };
  const m = /^([+-]?)(\d+(?:\.\d+)?)(?:\+(\d+(?:\.\d+)?))?\s*(lbs?|kg)?$/i.exec(load);
  if (!m) return { raw: load };
  return {
    sign: m[1], a: +m[2], b: m[3] != null ? +m[3] : null,
    unit: m[4] && /lb/i.test(m[4]) ? 'lb' : 'kg',
    suffix: m[4] || ''
  };
}

function loadText(load) {
  const p = parseLoad(load);
  if (!p) return '';
  if (p.bw) return 'BW';
  if (p.raw) return p.raw;
  if (p.b != null) return (p.a === p.b ? '2×' + p.a : p.a + '+' + p.b) + p.unit;
  return p.sign + p.a + p.unit;
}

// One plate/bell jump: 5lb on a belt or sandbag, 4kg between kettlebells.
function stepLoad(load, dir) {
  const p = parseLoad(load);
  if (!p || p.bw || p.raw) return load;
  const step = p.unit === 'lb' ? 5 : 4;
  const move = v => Math.max(0, v + (p.sign === '-' ? -dir : dir) * step);
  const a = move(p.a);
  const b = p.b != null ? move(p.b) : null;
  return p.sign + a + (b != null ? '+' + b : '') + p.suffix;
}

// "Drop to +25lbs if grinding" -> "+25lbs"
function dropTarget(note) {
  const m = /drop to\s+([+-]?\d+(?:\.\d+)?\s*(?:lbs?|kg)?)/i.exec(note || '');
  return m ? m[1].replace(/\s+/g, '') : null;
}

const isEmomNote = note => /\bEMOM\b/i.test(note || '');
const alternatingEmom = note => /odd minutes? work/i.test(note || '');

/* =========================================================
   PROGRAM + HISTORY
   ========================================================= */

let program = null;
let progMeta = null;
let homeWeek = null;

function readProgramMeta() {
  const weeks = Object.keys(program.weeks);
  const m = /(\d+)\s*-\s*week/i.exec(program.subtitle || '') || /(\d+)\s*-\s*week/i.exec(program.title || '');
  return { weeks, repeat: weeks.length === 1, cycleLen: m ? +m[1] : null };
}

const getDay = (week, day) => program.weeks[week].days.find(d => d.day === day);

function firstWorkIndex(day) {
  return day.blocks.findIndex(b => parseHeader(b.header).kind === 'work');
}

const history = () => store.json(KEYS.history, []);
const writeHistory = h => store.set(KEYS.history, JSON.stringify(h));
const programHistory = () => history().filter(e => e.title === program.title);

function entriesFor(week, day) {
  return programHistory()
    .filter(e => e.day === day && (progMeta.repeat || e.week === week))
    .sort((a, b) => b.endedAt - a.endedAt);
}

// With one week repeated N times, the "week" you're on is the rotation:
// rotation r is complete once every day has been logged r times.
function rotation() {
  const days = program.weeks[progMeta.weeks[0]].days.map(d => d.day);
  const counts = {};
  days.forEach(d => { counts[d] = 0; });
  programHistory().forEach(e => { if (e.day in counts) counts[e.day]++; });
  const current = Math.min(...days.map(d => counts[d])) + 1;
  const doneNow = days.filter(d => counts[d] >= current);
  return { current, counts, doneNow, next: days.find(d => counts[d] < current), total: days.length };
}

// Did the primary lift of this logged session hit every prescribed round, rep, and load?
function heldStatus(entry, day) {
  const bi = firstWorkIndex(day);
  if (bi < 0 || !entry.blocks[bi]) return 'none';
  const blk = day.blocks[bi];
  const m = parseHeader(blk.header);
  const rounds = entry.blocks[bi].rounds || [];
  if (!rounds.length) return 'short';
  const ok = rounds.length >= m.rounds &&
    rounds.every((r, ri) => {
      const ex = parseExercise(blk.exercises[0], ri, m.rungs);
      return (r.reps[0] || 0) >= (ex.value || 0) && r.loads[0] === ex.load;
    });
  return ok ? 'held' : 'short';
}

/* =========================================================
   SOUND + HAPTICS
   ========================================================= */

// The synth lives in sound.js; this layer only knows the on/off preference.
let soundOn = store.get(KEYS.sound) !== '0';

function wakeAudio() {
  if (!window.Sfx) return;
  Sfx.wake();
  Sfx.setOn(soundOn);
}

const cue = name => arg => { if (soundOn && window.Sfx) Sfx[name](arg); };
const sfx = {
  tap: cue('tap'),         // every press: a low relay
  count: cue('count'),     // 3 · 2 · 1 (pass the second)
  go: cue('go'),           // rest over, work minute, timer done
  log: cue('log'),         // round or item locked in
  down: cue('down'),       // rest begins
  finish: cue('finish')    // session complete
};

function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } }

/* =========================================================
   SCREEN WAKE LOCK (needs https; silently absent otherwise)
   ========================================================= */

let wakeLock = null;
function acquireWake() {
  if (!('wakeLock' in navigator) || wakeLock) return;
  navigator.wakeLock.request('screen').then(lock => {
    wakeLock = lock;
    lock.addEventListener('release', () => { wakeLock = null; });
  }).catch(() => {});
}
function releaseWake() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

/* =========================================================
   SESSION STATE
   One object, saved whole on every change. Times are wall
   clock, so a locked phone or a reload doesn't lose a rest.
   ========================================================= */

let S = null;           // the live session
let ui = {};            // view-only state: open editors, one-shot animations

function newSession(week, day) {
  const d = getDay(week, day);
  return {
    v: 2, title: program.title, week, day,
    startedAt: null, acc: 0, runSince: null,
    blockIndex: 0,
    blocks: d.blocks.map(b => {
      const rungs = b.header && parseHeader(b.header).rungs;
      const exs = b.exercises.map(line => parseExercise(line, 0, rungs));
      return {
        rounds: [], extra: 0,
        checks: exs.map(() => 0),
        loads: exs.map(e => e.load),
        draft: exs.map(e => e.value),
        tStart: null, tEnd: null,
        emom: null
      };
    }),
    rest: null,
    timer: null,
    savedAt: now()
  };
}

const sDay = () => getDay(S.week, S.day);
const sBlock = i => sDay().blocks[i];
// Exercises as prescribed for round r (default: the round about to be done).
const sRungs = i => parseHeader(sBlock(i).header).rungs;
const sExs = (i, r = S.blocks[i].rounds.length) => sBlock(i).exercises.map(line => parseExercise(line, r, sRungs(i)));
const isLadder = i => !!sRungs(i);

// After a ladder round is logged or undone, reset reps and loads to the new rung.
function syncRung(i) {
  const st = S.blocks[i];
  sExs(i).forEach((ex, j) => {
    if (!ex.ladder) return;
    st.draft[j] = ex.value;
    st.loads[j] = ex.load;
  });
}
const targetRounds = i => parseHeader(sBlock(i).header).rounds + S.blocks[i].extra;

function elapsed() {
  if (!S) return 0;
  return S.acc + (S.runSince ? now() - S.runSince : 0);
}

// The session clock starts on the first real action, not on opening the day.
function ensureRunning() {
  if (S.runSince) return;
  if (!S.startedAt) S.startedAt = now();
  S.runSince = now();
  if (S.blocks[S.blockIndex].tStart == null) S.blocks[S.blockIndex].tStart = elapsed();
  acquireWake();
}

function pauseClock() {
  if (!S.runSince) return;
  S.acc += now() - S.runSince;
  S.runSince = null;
}

function save() {
  if (!S) return;
  if (!S.startedAt) { store.del(KEYS.session); return; }
  S.savedAt = now();
  store.set(KEYS.session, JSON.stringify(S));
}

function loadSaved() {
  const s = store.json(KEYS.session, null);
  if (!s || s.v !== 2 || s.title !== program.title || !program.weeks[s.week]) return null;
  const d = getDay(s.week, s.day);
  if (!d || d.blocks.length !== s.blocks.length) return null;
  // Gone for over 30 minutes: stop the clock where it was saved rather than
  // invent the time the phone spent in a pocket.
  if (s.runSince && now() - s.savedAt > 30 * 60000) {
    s.acc += s.savedAt - s.runSince;
    s.runSince = null;
    s.rest = null;
    s.timer = null;
    s.blocks.forEach(b => { if (b.emom && !b.emom.done) b.emom.done = true; });
  }
  return s;
}

/* =========================================================
   VIEWS
   ========================================================= */

let view = 'home';

function show(name) {
  view = name;
  ['home', 'log', 'session', 'summary'].forEach(v => {
    const node = $('#view-' + v);
    node.hidden = v !== name;
    if (v === name) { node.classList.remove('enter'); void node.offsetWidth; node.classList.add('enter'); }
  });
  document.body.classList.toggle('in-session', name === 'session' || name === 'summary');
  const bar = $('#tabbar');
  bar.dataset.on = name === 'log' ? 'log' : 'home';
  bar.querySelectorAll('.tab').forEach(t => {
    if (t.dataset.view === bar.dataset.on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

function shutter(mid) {
  const sh = $('#shutter');
  if (reduceMotion) { mid(); return; }
  sh.classList.add('shut');
  setTimeout(() => {
    mid();
    requestAnimationFrame(() => sh.classList.remove('shut'));
  }, 250);
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
}

/* ---------- HOME ---------- */

function keyLift(day) {
  const bi = firstWorkIndex(day);
  if (bi < 0) return null;
  const m = parseHeader(day.blocks[bi].header);
  const ex = parseExercise(day.blocks[bi].exercises[0], 0, m.rungs);
  if (m.rungs) return { name: ex.name, spec: 'Ladder ' + m.rungs.join('-') };
  if (ex.ladder) return { name: ex.name, spec: m.rounds + ' sets · ' + (ex.rungs || []).join('/') + ' · ' + [...new Set(ex.raw.slice(ex.raw.lastIndexOf('@') + 1).split('/'))].map(loadText).join('→') };
  return { name: ex.name, spec: m.rounds + '×' + doseText(ex) + (ex.load ? ' · ' + loadText(ex.load) : '') };
}

function shortDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function renderHome() {
  const week = homeWeek;
  const days = program.weeks[week].days;
  const rot = progMeta.repeat ? rotation() : null;
  const saved = loadSaved();
  let h = '';

  h += '<header class="home-top">' +
    '<span class="brand">IRON<span>/</span>LOG</span>' +
    '<button class="icon-btn press" type="button" data-act="sound" aria-pressed="' + soundOn + '" aria-label="Sound">' +
    (soundOn ? ICON.soundOn : ICON.soundOff) + '</button></header>';
  h += '<h1 class="prog-title">' + esc(program.title) + '</h1>';
  if (program.subtitle) h += '<p class="prog-sub">' + esc(program.subtitle) + '</p>';

  if (saved) {
    const d = getDay(saved.week, saved.day);
    const b = d.blocks[saved.blockIndex];
    const ms = saved.acc + (saved.runSince ? now() - saved.runSince : 0);
    h += '<div class="resume plate">' +
      '<span class="label">In progress · ' + clock(ms) + '</span>' +
      '<h3>' + esc(d.name) + '</h3>' +
      '<p>' + esc(parseHeader(b.header).label) + ' · block ' + (saved.blockIndex + 1) + ' of ' + d.blocks.length + '</p>' +
      '<div class="resume-actions">' +
      '<button class="btn btn-ember press" type="button" data-act="resume">Resume</button>' +
      '<button class="btn btn-ghost hold-btn" type="button" data-hold="discard" style="--hold:.8s"><span>Hold to discard</span></button>' +
      '</div></div>';
  }

  if (rot) {
    const len = progMeta.cycleLen;
    const finished = len && rot.current > len;
    const shown = finished ? len : rot.current;
    const nextDay = rot.next != null ? days.find(d => d.day === rot.next) : null;
    h += '<section class="cycle plate">' +
      '<div class="cycle-row">' +
      '<div><span class="label">Week</span><div class="cycle-big"><b class="num">' + pad(shown) + '</b>' +
      (len ? '<span>/' + len + '</span>' : '') + '</div></div>' +
      '<div class="cycle-side"><span class="label">' + (finished ? 'Block' : rot.doneNow.length + ' of ' + rot.total + ' done') + '</span>' +
      '<strong>' + (finished ? 'Complete' : nextDay ? 'Next · ' + esc(nextDay.name) : '') + '</strong></div>' +
      '</div>';
    if (len) {
      h += '<div class="cycle-bar" aria-hidden="true">';
      for (let i = 1; i <= len; i++) {
        if (i < rot.current) h += '<i class="done"></i>';
        else if (i === rot.current) h += '<i class="now" style="--p:0" data-p="' + (rot.doneNow.length / rot.total) + '"></i>';
        else h += '<i></i>';
      }
      h += '</div>';
    }
    h += '</section>';
  } else {
    h += '<div class="sec-head"><span class="label">Week</span><span class="label"><b>' + esc(program.weeks[week].phase) + '</b></span></div>';
    h += '<nav class="week-chips" aria-label="Week">' + progMeta.weeks.map(w =>
      '<button class="week-chip press" type="button" data-act="week" data-week="' + esc(w) + '" aria-current="' + (w === week) + '">' + esc(w) + '</button>'
    ).join('') + '</nav>';
  }

  h += '<div class="sec-head"><span class="label">Sessions</span></div><div class="days rise">';
  days.forEach(d => {
    const last = entriesFor(week, d.day)[0];
    const lift = keyLift(d);
    let state = '', tag = '';
    if (rot) {
      if (rot.doneNow.includes(d.day)) { state = 'is-done'; tag = '<span class="tag tag-done">Done · ' + esc(shortDate(entriesFor(week, d.day)[0].endedAt)) + '</span>'; }
      else if (rot.next === d.day) { state = 'is-next'; tag = '<span class="tag tag-go">Up next</span>'; }
    } else if (last) {
      state = 'is-done'; tag = '<span class="tag tag-done">Done · ' + esc(shortDate(last.endedAt)) + '</span>';
    }
    if (!tag && last) tag = '<span class="tag">Last ' + clock(last.duration) + '</span>';
    h += '<button class="day plate press ' + state + '" type="button" data-act="open-day" data-day="' + d.day + '">' +
      '<span class="day-idx">' + d.day + '</span>' +
      '<span><span class="day-name">' + esc(d.name) + '</span>' +
      (lift ? '<span class="day-key">' + esc(lift.name) + ' · ' + esc(lift.spec) + '</span>' : '') +
      (tag ? '<span class="day-sub">' + tag + '</span>' : '') +
      '</span>' + ICON.arrow + '</button>';
  });
  h += '</div>';

  // Hold line: the last eight sessions of each day's primary lift.
  h += '<div class="sec-head"><span class="label">Hold line</span><span class="label"><b>Primary lifts</b></span></div>';
  h += '<section class="hold plate">';
  let anyHistory = false;
  days.forEach(d => {
    const lift = keyLift(d);
    if (!lift) return;
    const entries = entriesFor(week, d.day).slice(0, 8).reverse();
    if (entries.length) anyHistory = true;
    let marks = '';
    for (let i = 0; i < 8; i++) {
      const e = entries[i];
      marks += '<i class="' + (e ? heldStatus(e, d) : '') + '"></i>';
    }
    const held = entries.filter(e => heldStatus(e, d) === 'held').length;
    h += '<div class="hold-row"><span class="hold-name">' + esc(lift.name) + '</span>' +
      '<span class="hold-marks" aria-label="' + held + ' of ' + entries.length + ' held">' + marks + '</span>' +
      '<span class="hold-spec">' + esc(lift.spec) + (entries.length ? ' · held ' + held + '/' + entries.length : '') + '</span></div>';
  });
  if (!anyHistory) h += '<p class="hold-empty">Each finished session marks a square: green if every round hit the prescribed reps at the prescribed load.</p>';
  else h += '<div class="hold-key"><span><i></i>Held</span><span><i class="s"></i>Dropped</span></div>';
  h += '</section>';

  // Standing orders
  const wk = program.weeks[week];
  if (program.notes || wk.goal) {
    h += '<div class="sec-head"><span class="label">Orders</span></div>';
    h += '<details class="orders plate"><summary><strong>' + esc(wk.phase || 'Program notes') + '</strong>' + ICON.plus + '</summary><div class="orders-body">';
    if (wk.goal) h += '<div><span class="label">Goal</span><p>' + esc(wk.goal) + '</p></div>';
    if (program.notes) h += '<div><span class="label">Rules</span><p>' + esc(program.notes) + '</p></div>';
    h += '</div></details>';
  }

  $('#view-home').innerHTML = h;

  // Fill the current cycle segment after paint so it visibly charges.
  const seg = $('#view-home .cycle-bar .now');
  if (seg) requestAnimationFrame(() => requestAnimationFrame(() => seg.style.setProperty('--p', seg.dataset.p)));
}

/* ---------- LOG ---------- */

function renderLog() {
  const all = history().sort((a, b) => b.endedAt - a.endedAt);
  let h = '<header class="home-top"><span class="brand">IRON<span>/</span>LOG</span></header>';
  h += '<h1 class="log-title">Log</h1>';

  const mine = all.filter(e => e.title === program.title);
  const totalMs = mine.reduce((a, e) => a + e.duration, 0);
  const rounds = mine.reduce((a, e) => a + e.blocks.reduce((x, b) => x + (b.rounds ? b.rounds.length : 0), 0), 0);
  h += '<div class="stats log-stats">' +
    '<div class="stat"><b>' + mine.length + '</b><span class="label">Sessions</span></div>' +
    '<div class="stat"><b>' + Math.round(totalMs / 60000) + '</b><span class="label">Minutes</span></div>' +
    '<div class="stat"><b>' + rounds + '</b><span class="label">Rounds</span></div></div>';

  h += '<div class="sec-head"><span class="label">Sessions</span><span class="label"><b>' + all.length + '</b></span></div>';
  if (!all.length) {
    h += '<div class="empty plate"><b>Nothing filed yet</b>Finish a session and it lands here, written in your notation.</div>';
  } else {
    h += '<div class="entries">';
    all.forEach(e => {
      const d = new Date(e.endedAt);
      h += '<details class="entry plate"><summary>' +
        '<span class="entry-date"><b>' + d.getDate() + '</b><span>' + d.toLocaleDateString(undefined, { month: 'short' }) + '</span></span>' +
        '<span><span class="entry-name">' + esc(e.dayName) + '</span>' +
        '<span class="entry-sub">' + esc(d.toLocaleDateString(undefined, { weekday: 'short' })) + ' · W' + esc(e.week) + ' · ' + esc(e.title) + '</span></span>' +
        '<span class="entry-time">' + clock(e.duration) + '</span></summary>' +
        '<div class="entry-body"><pre class="notation">' + esc(e.notation) + '</pre>' +
        '<div class="btn-row"><button class="btn press" type="button" data-act="copy" data-id="' + esc(e.id) + '">Copy</button>' +
        '<button class="btn btn-ghost hold-btn" type="button" data-hold="delete" data-id="' + esc(e.id) + '"><span>Hold to delete</span></button></div>' +
        '</div></details>';
    });
    h += '</div>';
  }

  h += '<div class="sec-head"><span class="label">Backup</span><span class="label"><b>This phone only</b></span></div>' +
    '<div class="backup"><button class="btn press" type="button" data-act="export">Export</button>' +
    '<label class="btn press" for="import-file">Import</label><input type="file" id="import-file" accept="application/json,.json"></div>';

  $('#view-log').innerHTML = h;
  $('#import-file').addEventListener('change', importHistory);
}

/* ---------- SESSION ---------- */

function renderSession() {
  const d = sDay();
  let h = '<header class="s-top">' +
    '<button class="icon-btn press" type="button" data-act="close" aria-label="Back to today">' + ICON.close + '</button>' +
    '<div class="s-title"><span class="label">' + (progMeta.repeat ? 'Day ' + S.day : 'W' + esc(S.week) + ' · Day ' + S.day) + '</span><b>' + esc(d.name) + '</b></div>' +
    '<button class="s-clock press" type="button" data-act="clock" aria-label="Pause or resume session clock"><i></i><span id="s-clock">' + clock(elapsed()) + '</span></button>' +
    '</header>';
  h += '<nav class="strip" id="strip" aria-label="Blocks"></nav>';
  h += '<div id="block-host"></div>';
  h += '<div class="dock" id="dock"></div>';
  $('#view-session').innerHTML = h;
  renderStrip();
  renderBlock();
  updateClock();
}

function renderStrip() {
  const d = sDay();
  $('#strip').innerHTML = d.blocks.map((b, i) => {
    const m = parseHeader(b.header);
    const st = S.blocks[i];
    const done = st.tEnd != null;
    const cls = i === S.blockIndex ? 'current' : done ? 'done' : '';
    return '<button type="button" class="' + cls + '" data-act="jump" data-i="' + i + '" aria-label="' + esc(m.label) + '">' + esc(m.letter) + '</button>';
  }).join('');
}

function lastRoundsFor(bi) {
  const prev = entriesFor(S.week, S.day)[0];
  if (!prev || !prev.blocks[bi] || prev.blocks[bi].header !== sBlock(bi).header) return null;
  return prev.blocks[bi].rounds || null;
}

function renderBlock() {
  const i = S.blockIndex;
  const blk = sBlock(i);
  const m = parseHeader(blk.header);
  const st = S.blocks[i];
  const exs = sExs(i);
  const emom = m.kind === 'work' && isEmomNote(blk.note);
  let h = '<article class="block plate is-' + m.kind + '">';

  h += '<header class="block-head"><div class="block-letter">' + esc(m.letter) + '</div>';
  if (m.kind === 'work') {
    const tr = targetRounds(i);
    if (emom) {
      h += '<div class="block-spec">EMOM<span>·</span>' + m.rounds + ' rounds</div>';
      h += '<div class="block-sub">' + (alternatingEmom(blk.note) ? 'Odd minutes work · even rest' : 'Every minute on the minute') + '</div>';
    } else if (m.rungs) {
      const n = Math.min(st.rounds.length + 1, tr);
      h += '<div class="block-spec">' + (st.tEnd != null ? 'Ladder done' : 'Rung ' + n + '<span>/</span>' + tr) + (m.rest ? '<span>·</span>' + m.rest + 's rest' : '') + '</div>';
      h += '<div class="block-sub">' + exs.length + ' moves · no rest inside a rung</div>';
    } else {
      const ladder = isLadder(i);
      h += '<div class="block-spec">' + tr + (ladder ? ' rungs' : ' rounds') + (m.rest ? '<span>·</span>' + m.rest + 's rest' : '') + '</div>';
      h += '<div class="block-sub">' + exs.length + (exs.length > 1 ? ' movements · ' + (ladder ? 'ladder ' + (sRungs(i) || exs[0].rungs).join('-') : 'superset') : ' movement') + '</div>';
    }
  } else {
    const done = exs.filter((e, j) => st.checks[j] >= passesNeeded(e)).length;
    h += '<div class="block-spec">' + esc(m.label) + '</div>';
    h += '<div class="block-sub">' + done + ' of ' + exs.length + ' done</div>';
  }
  h += '</header>';

  if (st.tEnd != null && m.kind === 'work') h += '<span class="cleared">CLEARED</span>';

  if (m.rungs) h += ladderStrip(i);
  else if (m.kind === 'work') {
    const tr = targetRounds(i);
    h += '<div class="pips" aria-label="' + st.rounds.length + ' of ' + tr + ' rounds">';
    for (let r = 0; r < Math.max(tr, st.rounds.length); r++) {
      const rd = st.rounds[r];
      let cls = rd ? (rd.effort === 'grind' ? 'on grind' : 'on') : '';
      if (ui.popPip === r) cls += ' pop';
      h += '<i class="' + cls + '"></i>';
    }
    h += '</div>';
  }

  if (blk.note) {
    const drop = dropTarget(blk.note);
    h += '<button type="button" class="block-note' + (ui.noteOpen ? ' open' : '') + (drop ? ' has-drop' : '') + '" data-act="note"><span>' + esc(blk.note) + '</span></button>';
  }

  if (emom) h += emomPanel(i);

  if (m.rungs) h += ladderList(i, exs);
  else if (m.kind === 'work') h += workList(i, exs);
  else h += checkList(i, exs);

  if (m.kind === 'work' && st.rounds.length) {
    h += '<ol class="rlog">';
    st.rounds.forEach((r, ri) => {
      if (m.rungs) { h += ladderLogRow(i, r, ri); return; }
      const parts = sExs(i, ri).map((ex, j) => {
        const v = r.reps[j] == null ? '–' : (ex.time ? r.reps[j] + 's' : r.reps[j]);
        const changed = r.loads[j] !== ex.load;
        return changed ? v + '<em>@' + esc(loadText(r.loads[j])) + '</em>' : v;
      });
      h += '<li class="' + (ui.newRound === ri ? 'new' : '') + '"><span class="r-n">R' + (ri + 1) + '</span>' +
        '<span class="r-v">' + parts.join(' · ') + '</span>' +
        '<button type="button" class="eff-btn" data-act="effort-cycle" data-r="' + ri + '" data-v="' + (r.effort || '') + '">' + (r.effort || 'rate') + '</button></li>';
    });
    h += '</ol>';
    h += '<div class="rlog-actions"><button type="button" class="link-btn" data-act="undo-round">Undo last</button>' +
      (!emom ? '<button type="button" class="link-btn go" data-act="extra-round">+1 round</button>' : '') + '</div>';
  }
  h += '</article>';

  $('#block-host').innerHTML = h;
  ui.popPip = null;
  ui.newRound = null;
  renderDock();
  tickTimers();
}

/* ---------- ladder blocks ---------- */

// The whole ladder at a glance: reps big, bells under, done / now / to come.
function ladderStrip(i) {
  const st = S.blocks[i];
  const m = parseHeader(sBlock(i).header);
  const tr = targetRounds(i);
  const now = st.rounds.length;
  let prev = null;
  let h = '<ol class="rungs" aria-label="Rung ' + Math.min(now + 1, tr) + ' of ' + tr + '">';
  for (let r = 0; r < Math.max(tr, now); r++) {
    const rd = st.rounds[r];
    const load = rd ? rd.loads[0] : r === now ? st.loads[0] : sExs(i, r)[0].load;
    const state = rd ? (rd.effort === 'grind' ? 'done grind' : 'done') : r === now && st.tEnd == null ? 'now' : '';
    const swap = prev != null && load !== prev;
    h += '<li class="rung ' + state + (ui.popPip === r ? ' pop' : '') + '">' +
      '<b>' + rung(m.rungs, r) + '</b>' +
      '<span class="' + (swap ? 'swap' : '') + '">' + esc(loadText(load)) + '</span></li>';
    prev = load;
  }
  h += '</ol>';
  if (st.tEnd == null && st.loads[0]) h += rungBells(i);
  return h;
}

// One load control for the rung: every move uses the same bells.
function rungBells(i) {
  const st = S.blocks[i];
  const planned = sExs(i)[0].load;
  const p = parseLoad(st.loads[0]);
  const adjustable = p && !p.bw && !p.raw;
  const changed = st.loads[0] !== planned;
  const step = p && p.unit === 'lb' ? '5lb' : '4kg';
  return '<div class="rung-bells' + (changed ? ' changed' : '') + '"><span class="label">Bells</span>' +
    '<b>' + esc(loadText(st.loads[0])) + '</b>' +
    (adjustable ? '<button type="button" class="press" data-act="rung-load" data-d="-1" aria-label="Lighter">−' + step + '</button>' +
      (changed ? '<button type="button" class="press reset" data-act="rung-load-reset">' + esc(loadText(planned)) + '</button>' : '') +
      '<button type="button" class="press" data-act="rung-load" data-d="1" aria-label="Heavier">+' + step + '</button>' : '') +
    '</div>';
}

// Moves in a rung: name and a rep counter, nothing repeated.
function ladderList(i, exs) {
  const st = S.blocks[i];
  let h = '<ul class="exs exs-ladder">';
  exs.forEach((ex, j) => {
    h += '<li class="ex-row"><span class="ex-name">' + esc(ex.name) + '</span>';
    if (ex.time) h += runButton(i, j, ex);
    else if (ex.value != null) {
      const v = st.draft[j];
      h += '<div class="stepper"><button type="button" data-act="dec" data-ex="' + j + '" aria-label="One less">−</button>' +
        '<output id="out-' + j + '" class="' + (v < ex.value ? 'off' : '') + '"><span>' + v + '</span>' + (ex.each ? '<small>EA</small>' : '') + '</output>' +
        '<button type="button" data-act="inc" data-ex="' + j + '" aria-label="One more">+</button></div>';
    }
    h += '</li>';
  });
  return h + '</ul>';
}

function ladderLogRow(i, r, ri) {
  const exs = sExs(i, ri);
  const missed = exs.map((ex, j) => (!ex.time && r.reps[j] != null && r.reps[j] < ex.value ? ex.name.replace(/^KB /, '') + ' ' + r.reps[j] : null)).filter(Boolean);
  return '<li class="' + (ui.newRound === ri ? 'new' : '') + '"><span class="r-n">' + exs[0].value + '</span>' +
    '<span class="r-v">@ ' + esc(loadText(r.loads[0])) + (missed.length ? ' · <em>' + esc(missed.join(', ')) + '</em>' : ' · all reps') + '</span>' +
    '<button type="button" class="eff-btn" data-act="effort-cycle" data-r="' + ri + '" data-v="' + (r.effort || '') + '">' + (r.effort || 'rate') + '</button></li>';
}

function workList(i, exs) {
  const st = S.blocks[i];
  const last = lastRoundsFor(i);
  let h = '<ul class="exs">';
  exs.forEach((ex, j) => {
    const load = st.loads[j];
    const loadChanged = load !== ex.load;
    const lastVals = last ? last.map(r => r.reps[j]).filter(v => v != null) : [];
    h += '<li class="ex"><div class="ex-name">' + esc(ex.name) + '</div>';
    h += '<div class="ex-line"><div><span class="ex-target">' + esc(doseText(ex)) + (ex.load ? ' @ ' + esc(loadText(ex.load)) : '') + '</span>' +
      (lastVals.length ? '<span class="ex-last">LAST <b>' + lastVals.join('·') + '</b></span>' : '') + '</div>';
    h += '<div class="ex-ctrls">';
    if (ex.time) {
      h += runButton(i, j, ex);
    } else if (ex.value != null) {
      const v = st.draft[j];
      h += '<div class="stepper"><button type="button" data-act="dec" data-ex="' + j + '" aria-label="One less">−</button>' +
        '<output id="out-' + j + '" class="' + (v < ex.value ? 'off' : '') + '"><span>' + v + '</span><small>' + (ex.isCarry ? 'STEP' : ex.each ? 'EA' : 'REPS') + '</small></output>' +
        '<button type="button" data-act="inc" data-ex="' + j + '" aria-label="One more">+</button></div>';
    }
    if (load) {
      const adjustable = parseLoad(load) && !parseLoad(load).bw && !parseLoad(load).raw;
      h += '<button type="button" class="load-chip press' + (loadChanged ? ' changed' : '') + '" data-act="load" data-ex="' + j + '"' + (adjustable ? '' : ' disabled') + '>' + esc(loadText(load)) + '</button>';
    }
    h += '</div></div>';
    if (ui.loadEdit === j) {
      h += '<div class="load-edit"><button type="button" class="press" data-act="load-step" data-ex="' + j + '" data-d="-1">− ' + (parseLoad(load).unit === 'lb' ? '5lb' : '4kg') + '</button>' +
        (loadChanged ? '<button type="button" class="press reset" data-act="load-reset" data-ex="' + j + '">' + esc(loadText(ex.load)) + '</button>' : '') +
        '<button type="button" class="press" data-act="load-step" data-ex="' + j + '" data-d="1">+ ' + (parseLoad(load).unit === 'lb' ? '5lb' : '4kg') + '</button></div>';
    }
    h += '</li>';
  });
  return h + '</ul>';
}

function checkList(i, exs) {
  const st = S.blocks[i];
  let h = '<ul class="chk-list">';
  exs.forEach((ex, j) => {
    const need = passesNeeded(ex);
    const done = st.checks[j] >= need;
    h += '<li class="chk' + (done ? ' done' : '') + (ex.isRest ? ' is-rest' : '') + '">' +
      '<button type="button" class="chk-hit" data-act="check" data-ex="' + j + '" aria-pressed="' + done + '">' +
      '<span class="chk-box"></span>' +
      '<span class="chk-text"><span class="ex-name">' + esc(ex.name) + '</span>' +
      '<span class="ex-target">' + esc(doseText(ex)) + (ex.load && ex.load !== 'BW' ? ' @ ' + esc(loadText(ex.load)) : '') +
      (need > 1 && st.checks[j] === 1 ? ' · <span class="half">side 2</span>' : '') + '</span></span></button>' +
      (ex.time ? runButton(i, j, ex) : '<span></span>') +
      '</li>';
  });
  return h + '</ul>';
}

function runButton(i, j, ex) {
  const on = S.timer && S.timer.b === i && S.timer.ex === j;
  return '<button type="button" class="run press' + (on ? ' is-on' : '') + '" data-act="timer" data-ex="' + j + '" id="run-' + j + '">' +
    ICON.play + '<b>' + (on ? countdown(S.timer.endsAt - now()) : secsText(ex.value)) + '</b><span class="fill"></span></button>';
}

function emomPanel(i) {
  const st = S.blocks[i];
  const blk = sBlock(i);
  const m = parseHeader(blk.header);
  const alt = alternatingEmom(blk.note);
  const total = alt ? m.rounds * 2 - 1 : m.rounds;
  const e = st.emom;
  const minute = e && !e.done ? Math.floor((now() - e.startAt) / 60000) : (e && e.done ? total : -1);
  let bar = '';
  for (let k = 0; k < total; k++) {
    const work = !alt || k % 2 === 0;
    bar += '<i class="' + (work ? 'w ' : '') + (k < minute ? 'past' : k === minute ? 'now' : '') + '"></i>';
  }
  return '<div class="emom' + (!e ? ' is-idle' : '') + '" id="emom">' +
    '<div><div class="emom-min">Minute <b id="emom-min">' + (e ? pad(Math.min(minute + 1, total)) : '00') + '</b> / ' + total + '</div>' +
    '<div class="emom-phase" id="emom-phase">' + (!e ? 'Standby' : e.done ? 'Done' : 'Work') + '</div></div>' +
    '<div class="emom-sec" id="emom-sec">' + (e && !e.done ? '60' : '—') + '</div>' +
    '<div class="emom-bar" id="emom-bar">' + bar + '</div></div>';
}

/* The dock holds the one thing to do next. */
function renderDock() {
  const i = S.blockIndex;
  const blk = sBlock(i);
  const m = parseHeader(blk.header);
  const st = S.blocks[i];
  const isLast = i === sDay().blocks.length - 1;
  const next = !isLast ? parseHeader(sBlock(i + 1).header) : null;
  const emom = m.kind === 'work' && isEmomNote(blk.note);
  let html;

  const nextBtn = (strong) => isLast
    ? '<button type="button" class="act hold-btn' + (strong ? '' : ' quiet') + '" data-hold="finish"><span class="act-l">Hold to finish</span><span class="act-r">' + clock(elapsed()) + '</span></button>'
    : '<button type="button" class="act' + (strong ? '' : ' quiet') + '" data-act="next-block"><span class="act-l">Next · ' + esc(next.label) + '</span><span class="act-r">' + (i + 2) + '/' + sDay().blocks.length + '</span></button>';

  if (m.kind !== 'work') {
    const all = sExs(i).every((e, j) => st.checks[j] >= passesNeeded(e));
    html = nextBtn(all);
  } else if (emom) {
    if (!st.emom) html = '<button type="button" class="act" data-act="emom-start"><span class="act-l">Start EMOM</span><span class="act-r">' + (alternatingEmom(blk.note) ? m.rounds * 2 - 1 : m.rounds) + ' MIN</span></button>';
    else if (!st.emom.done) html = '<button type="button" class="act quiet hold-btn" data-hold="emom-end"><span class="act-l">Hold to end early</span><span class="act-r">' + st.rounds.length + '/' + m.rounds + '</span></button>';
    else html = nextBtn(true);
  } else {
    const tr = targetRounds(i);
    const n = st.rounds.length;
    if (n < tr) {
      const rungs = sRungs(i);
      const label = rungs ? 'Log rung · <b>' + rung(rungs, n) + '</b> reps' : 'Log round <b>' + (n + 1) + '</b>';
      html = '<button type="button" class="act' + (ui.swapAct ? ' swap' : '') + '" data-act="log-round"><span class="act-l">' + label + '</span><span class="act-r">' + (n + 1) + '/' + tr + '</span></button>';
    } else {
      html = nextBtn(true);
    }
  }
  ui.swapAct = false;
  $('#dock').innerHTML = html;
}

/* ---------- clock + timers, ticking ---------- */

function updateClock() {
  const c = $('#s-clock');
  if (!c || !S) return;
  c.textContent = clock(elapsed());
  const btn = c.parentElement;
  btn.classList.toggle('is-running', !!S.runSince);
  btn.classList.toggle('is-paused', !S.runSince && !!S.startedAt);
}

function tickTimers() {
  if (!S) return;
  const t = now();

  // movement countdown
  if (S.timer) {
    const left = S.timer.endsAt - t;
    const sec = Math.ceil(left / 1000);
    if (sec <= 3 && sec >= 1 && S.timer.beep !== sec) { S.timer.beep = sec; sfx.count(sec); }
    const btn = view === 'session' && S.timer.b === S.blockIndex ? $('#run-' + S.timer.ex) : null;
    if (btn) {
      btn.querySelector('b').textContent = countdown(Math.max(0, left));
      btn.querySelector('.fill').style.transform = 'scaleX(' + Math.max(0, left / S.timer.dur) + ')';
    }
    if (left <= 0) finishTimer();
  }

  // rest between rounds
  if (S.rest) {
    const left = S.rest.endsAt - t;
    const sec = Math.ceil(left / 1000);
    if (sec <= 3 && sec >= 1 && S.rest.beep !== sec) { S.rest.beep = sec; sfx.count(sec); buzz(30); }
    if (left <= 0 && !S.rest.over) {
      S.rest.over = true;
      sfx.go(); buzz([90, 60, 90, 60, 220]);
      save();
    }
    paintRest(left);
  }

  // EMOM
  const st = S.blocks[S.blockIndex];
  for (let bi = 0; bi < S.blocks.length; bi++) {
    const e = S.blocks[bi].emom;
    if (e && !e.done) tickEmom(bi);
  }
  if (st && st.emom && !st.emom.done && view === 'session') paintEmom(S.blockIndex);
}

function emomShape(bi) {
  const blk = sBlock(bi);
  const m = parseHeader(blk.header);
  const alt = alternatingEmom(blk.note);
  return { alt, rounds: m.rounds, total: alt ? m.rounds * 2 - 1 : m.rounds };
}

function tickEmom(bi) {
  const st = S.blocks[bi];
  const e = st.emom;
  const { alt, rounds, total } = emomShape(bi);
  const ms = now() - e.startAt;
  const minute = Math.floor(ms / 60000);
  const secLeft = 60 - Math.floor((ms % 60000) / 1000);

  // Every work minute that has fully passed is a logged round.
  const workDone = Math.min(rounds, alt ? Math.ceil(minute / 2) : minute);
  let changed = false;
  while (st.rounds.length < workDone) {
    st.rounds.push({ reps: st.draft.slice(), loads: st.loads.slice(), effort: null, at: elapsed() });
    syncRung(bi);
    ui.popPip = st.rounds.length - 1;
    changed = true;
  }

  if (minute >= total) {
    e.done = true;
    st.tEnd = elapsed();
    sfx.go(); buzz([90, 60, 220]);
    save();
    if (bi === S.blockIndex && view === 'session') { renderBlock(); renderStrip(); }
    return;
  }
  if (minute !== e.lastMin) {
    e.lastMin = minute;
    if (minute > 0) {
      const work = !alt || minute % 2 === 0;
      if (work) { sfx.go(); buzz([120, 50, 120]); } else { sfx.down(); buzz(80); }
    }
    changed = true;
  }
  if (secLeft <= 3 && e.beep !== minute + ':' + secLeft) { e.beep = minute + ':' + secLeft; sfx.count(secLeft); }
  if (changed) { save(); if (bi === S.blockIndex && view === 'session') renderBlock(); }
}

function paintEmom(bi) {
  const e = S.blocks[bi].emom;
  const { alt, total } = emomShape(bi);
  const ms = now() - e.startAt;
  const minute = Math.min(Math.floor(ms / 60000), total - 1);
  const secLeft = 60 - Math.floor((ms % 60000) / 1000);
  const work = !alt || minute % 2 === 0;
  const box = $('#emom');
  if (!box) return;
  box.classList.toggle('is-rest', !work);
  box.classList.remove('is-idle');
  $('#emom-min').textContent = pad(minute + 1);
  $('#emom-phase').textContent = work ? 'Work' : 'Rest';
  $('#emom-sec').textContent = secLeft;
  const marks = $('#emom-bar').children;
  for (let k = 0; k < marks.length; k++) {
    marks[k].classList.toggle('past', k < minute);
    marks[k].classList.toggle('now', k === minute);
  }
}

function startTimer(j) {
  const ex = sExs(S.blockIndex)[j];
  S.timer = { b: S.blockIndex, ex: j, endsAt: now() + ex.value * 1000, dur: ex.value * 1000, beep: null };
  ensureRunning();
  sfx.log(); buzz(25);
  save();
  renderBlock();
}

function finishTimer() {
  const { b, ex: j } = S.timer;
  S.timer = null;
  sfx.go(); buzz([90, 60, 160]);
  const m = parseHeader(sBlock(b).header);
  if (m.kind !== 'work') {
    const ex = sExs(b)[j];
    S.blocks[b].checks[j] = Math.min(passesNeeded(ex), S.blocks[b].checks[j] + 1);
  }
  save();
  if (view === 'session' && b === S.blockIndex) renderBlock();
}

/* ---------- rest sheet ---------- */

function startRest(bi, roundIdx) {
  const m = parseHeader(sBlock(bi).header);
  S.rest = { b: bi, r: roundIdx, endsAt: now() + m.rest * 1000, dur: m.rest * 1000, beep: null, over: false };
  save();
  openRest();
}

function openRest() {
  const sheet = $('#rest-sheet');
  renderRest();
  sheet.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('up')));
}

function closeRest() {
  const sheet = $('#rest-sheet');
  S.rest = null;
  save();
  sheet.classList.remove('up', 'final', 'over');
  setTimeout(() => { if (!S || !S.rest) sheet.hidden = true; }, reduceMotion ? 0 : 400);
}

function renderRest() {
  const { b, r } = S.rest;
  const blk = sBlock(b);
  const st = S.blocks[b];
  const exs = sExs(b);
  const round = st.rounds[r];
  const tr = targetRounds(b);
  const drop = dropTarget(blk.note);
  const unit = isLadder(b) ? 'rung' : 'round';
  let h = '<div class="rest-top"><span class="label">Rest</span><span class="label">' + esc(parseHeader(blk.header).label) + ' · ' + unit + ' ' + (r + 1) + ' of ' + tr + '</span></div>';
  h += '<div class="rest-digits" id="rest-digits">' + countdown(S.rest.endsAt - now()) + '</div>';
  h += '<div class="rest-bar"><i id="rest-fill"></i></div>';
  h += '<div class="rest-adj"><button type="button" class="btn press" data-act="rest-adj" data-d="-15">−15s</button><button type="button" class="btn press" data-act="rest-adj" data-d="15">+15s</button></div>';

  h += '<div class="effort"><span class="label">How did ' + unit + ' ' + (r + 1) + ' move?</span><div class="effort-row">' +
    ['easy', 'solid', 'grind'].map(v => '<button type="button" data-act="rest-effort" data-v="' + v + '" aria-pressed="' + (round && round.effort === v) + '">' + v + '</button>').join('') +
    '</div>';
  if (round && round.effort === 'grind') {
    const primary = exs[0];
    const cur = st.loads[0];
    const opts = [];
    if (drop && drop !== cur) opts.push('<button type="button" class="btn btn-ember press" data-act="rest-drop">Drop to ' + esc(loadText(drop)) + '</button>');
    else if (cur && parseLoad(cur) && !parseLoad(cur).bw && !parseLoad(cur).raw) opts.push('<button type="button" class="btn press" data-act="rest-down-load">−1 step load</button>');
    if (!primary.time && primary.value != null) opts.push('<button type="button" class="btn press" data-act="rest-down-rep">−1 rep</button>');
    if (opts.length) {
      h += '<div class="drop"><p>Grinding is off-plan. ' + (drop ? 'The block says <b>drop to ' + esc(loadText(drop)) + '</b>.' : 'Drop reps or load rather than grind.') + ' Applies to the remaining rounds.</p>' +
        '<div class="drop-row">' + opts.join('') + '</div></div>';
    }
  }
  h += '</div>';

  const rungs = parseHeader(blk.header).rungs;
  if (rungs && r + 1 < tr) {
    const swap = round && st.loads[0] !== round.loads[0];
    h += '<div class="up-next up-rung"><span class="label">Up next · rung ' + (r + 2) + ' of ' + tr + '</span>' +
      '<div class="next-rung"><b>' + rung(rungs, r + 1) + '</b><span>reps @ ' + esc(loadText(st.loads[0])) + '</span></div>' +
      (swap ? '<p class="swap-call">Swap bells: ' + esc(loadText(round.loads[0])) + ' → ' + esc(loadText(st.loads[0])) + '</p>' : '') +
      '<p class="next-moves">' + exs.map(ex => esc(ex.name.replace(/^KB /, ''))).join(' → ') + '</p></div>';
  } else if (r + 1 < tr) {
    h += '<div class="up-next"><span class="label">Up next · ' + unit + ' ' + (r + 2) + '</span><ul>' +
      exs.map((ex, j) => '<li><span>' + esc(ex.name) + '</span><span>' +
        (ex.time ? secsText(ex.value) + 's' : st.draft[j] + (ex.each ? ' ea' : '')) +
        (st.loads[j] ? ' @ ' + esc(loadText(st.loads[j])) : '') + '</span></li>').join('') +
      '</ul></div>';
  }

  h += '<div class="sheet-foot"><button type="button" class="act quiet" data-act="rest-done" id="rest-go"><span class="act-l">Skip rest</span><span class="act-r"></span></button></div>';
  $('#rest-sheet').innerHTML = h;
  paintRest(S.rest.endsAt - now());
}

function paintRest(left) {
  const digits = $('#rest-digits');
  if (!digits) return;
  const sheet = $('#rest-sheet');
  const over = left <= 0;
  digits.textContent = over ? '+' + clock(-left) : countdown(left);
  $('#rest-fill').style.transform = 'scaleX(' + (over ? 1 : left / S.rest.dur) + ')';
  sheet.classList.toggle('final', !over && left <= 3000);
  sheet.classList.toggle('over', over);
  const go = $('#rest-go');
  if (go) {
    const wantGo = over;
    if (go.classList.contains('quiet') === wantGo) {
      go.classList.toggle('quiet', !wantGo);
      go.querySelector('.act-l').textContent = wantGo ? 'Go' : 'Skip rest';
      go.classList.remove('swap'); void go.offsetWidth; go.classList.add('swap');
    }
  }
}

/* ---------- session flow ---------- */

function openSession(week, day, restore) {
  S = restore || newSession(week, day);
  ui = {};
  shutter(() => {
    show('session');
    renderSession();
    if (S.rest) openRest();
  });
  if (S.runSince) acquireWake();
}

function leaveSession() {
  save();
  const sheet = $('#rest-sheet');
  sheet.classList.remove('up');
  sheet.hidden = true;
  releaseWake();
  S = null;
  shutter(() => { renderHome(); show('home'); });
}

function logRound() {
  const i = S.blockIndex;
  const st = S.blocks[i];
  ensureRunning();
  st.rounds.push({ reps: st.draft.slice(), loads: st.loads.slice(), effort: null, at: elapsed() });
  syncRung(i);
  const n = st.rounds.length;
  const tr = targetRounds(i);
  ui.popPip = n - 1;
  ui.newRound = n - 1;
  ui.swapAct = true;
  ui.loadEdit = null;
  const willRest = n < tr && parseHeader(sBlock(i).header).rest > 0;
  if (willRest) sfx.down(); else sfx.log();
  buzz(35);
  if (n >= tr) st.tEnd = elapsed();
  save();
  renderBlock();
  renderStrip();
  const rest = parseHeader(sBlock(i).header).rest;
  if (n < tr && rest > 0) startRest(i, n - 1);
}

function goToBlock(next) {
  const cur = S.blocks[S.blockIndex];
  if (cur.tEnd == null && S.startedAt) cur.tEnd = elapsed();
  S.blockIndex = next;
  if (S.blocks[next].tStart == null && S.startedAt) S.blocks[next].tStart = elapsed();
  ui = {};
  save();
  shutter(() => { renderStrip(); renderBlock(); window.scrollTo(0, 0); });
}

function finishSession() {
  const d = sDay();
  const cur = S.blocks[S.blockIndex];
  if (cur.tEnd == null) cur.tEnd = elapsed();
  if (!S.startedAt) S.startedAt = now();
  pauseClock();
  const dur = S.acc;
  const entry = {
    id: 's' + S.startedAt,
    title: S.title, week: S.week, day: S.day, dayName: d.name,
    startedAt: S.startedAt, endedAt: now(), duration: dur,
    blocks: S.blocks.map((b, i) => ({
      header: d.blocks[i].header,
      rounds: b.rounds,
      checks: b.checks,
      time: b.tStart != null && b.tEnd != null ? b.tEnd - b.tStart : null
    })),
    notation: buildNotation(d, dur)
  };
  const prev = entriesFor(S.week, S.day)[0] || null;
  const h = history();
  h.push(entry);
  writeHistory(h);
  store.del(KEYS.session);
  releaseWake();
  const sheet = $('#rest-sheet'); sheet.classList.remove('up'); sheet.hidden = true;
  const done = S;
  S = null;
  sfx.finish(); buzz([60, 40, 60, 40, 260]);
  shutter(() => { renderSummary(entry, prev, d, done); show('summary'); });
}

/* The log, written back in the notation the program is written in. */
function buildNotation(d, dur) {
  const at = new Date(S.startedAt || now());
  const date = at.getFullYear() + '-' + pad(at.getMonth() + 1) + '-' + pad(at.getDate());
  const out = ['# ' + date + ' | ' + d.name, ''];
  d.blocks.forEach((blk, i) => {
    const m = parseHeader(blk.header);
    const st = S.blocks[i];
    const exs = blk.exercises.map(line => parseExercise(line, 0, m.rungs));
    if (m.kind !== 'work') {
      out.push(blk.header + ':');
      exs.forEach((ex, j) => out.push('  - ' + blk.exercises[j] + (st.checks[j] >= passesNeeded(ex) ? '' : '  # skipped')));
    } else {
      const n = st.rounds.length;
      const done = m.rungs ? st.rounds.map((r, ri) => rung(m.rungs, ri)).join('/') : n;
      out.push(done + m.letter + m.rest + 's:' + (n !== m.rounds ? '  # planned ' + (m.rungs ? m.rungs.join('/') : m.rounds) : ''));
      exs.forEach((ex, j) => {
        if (!n || ex.value == null) { out.push('  - ' + blk.exercises[j] + (n ? '' : '  # skipped')); return; }
        const vals = st.rounds.map(r => r.reps[j]);
        const reps = vals.every(v => v === vals[0]) ? String(vals[0]) : vals.join('/');
        const loads = st.rounds.map(r => r.loads[j]);
        const load = loads.every(l => l === loads[0]) ? loads[0] : loads.join('/');
        const onRung = m.rungs && !ex.time && vals.every((v, ri) => v === rung(m.rungs, ri));
        if (onRung) { out.push('  - ' + ex.name + ' @' + load); return; }
        out.push('  - ' + ex.name + ' ' + (ex.time ? ':' : '') + reps + (ex.each ? "'" : '') + (load ? '@' + load : ''));
      });
      const eff = st.rounds.map(r => (r.effort ? r.effort[0].toUpperCase() : '-')).join('');
      if (/[ESG]/.test(eff)) out.push('  # effort ' + eff + '  (E easy, S solid, G grind)');
    }
    out.push('');
  });
  out.push('# total ' + clock(dur));
  return out.join('\n');
}

/* ---------- SUMMARY ---------- */

function renderSummary(entry, prev, d, done) {
  let reps = 0, rounds = 0, grinds = 0;
  done.blocks.forEach((b, i) => {
    const exs = d.blocks[i].exercises.map(line => parseExercise(line, 0, parseHeader(d.blocks[i].header).rungs));
    b.rounds.forEach(r => {
      rounds++;
      if (r.effort === 'grind') grinds++;
      r.reps.forEach((v, j) => { if (!exs[j].time && !exs[j].isCarry && v) reps += v * (exs[j].each ? 2 : 1); });
    });
  });
  const held = heldStatus(entry, d);
  let delta = '';
  if (prev) {
    const diff = entry.duration - prev.duration;
    const cls = Math.abs(diff) < 5000 ? '' : diff < 0 ? ' faster' : ' slower';
    delta = '<p class="sum-delta' + cls + '">' + (diff < 0 ? '−' : '+') + clock(Math.abs(diff)) + ' vs last ' + esc(d.name) + '</p>';
  }

  // Header: the block strip charges segment by segment, then the time counts up.
  let h = '<div class="sum-head"><span class="label sum-done">Complete</span><span class="label">' + esc(shortDate(entry.endedAt)) + '</span></div>';
  h += '<div class="sum-strip" aria-hidden="true">' + d.blocks.map((blk, i) => {
    const m = parseHeader(blk.header);
    const st = done.blocks[i];
    const full = m.kind === 'work'
      ? st.rounds.length >= m.rounds
      : st.checks.every((c, j) => c >= passesNeeded(parseExercise(blk.exercises[j])));
    return '<i class="' + (full ? 'full' : 'part') + '" style="--d:' + (i * 0.09).toFixed(2) + 's">' + esc(m.letter) + '</i>';
  }).join('') + '</div>';
  h += '<h1 class="sum-name">' + esc(d.name) + '</h1>';
  h += '<div class="sum-time" id="sum-time" data-ms="' + entry.duration + '">' + clock(0) + '</div>' + delta;
  h += '<div class="stats">' +
    '<div class="stat ' + (held === 'held' ? 'go' : held === 'short' ? 'ember' : '') + '"><b>' + (held === 'held' ? 'HELD' : held === 'short' ? 'DROP' : '—') + '</b><span class="label">Primary</span></div>' +
    '<div class="stat"><b>' + rounds + '</b><span class="label">Rounds</span></div>' +
    '<div class="stat' + (grinds ? ' ember' : '') + '"><b>' + reps + '</b><span class="label">Reps' + (grinds ? ' · ' + grinds + ' grind' : '') + '</span></div></div>';

  h += '<div class="sec-head"><span class="label">Blocks</span></div><ul class="rows plate">';
  d.blocks.forEach((blk, i) => {
    const m = parseHeader(blk.header);
    const st = done.blocks[i];
    const t = entry.blocks[i].time;
    let sub;
    if (m.kind === 'work') sub = st.rounds.length + '/' + m.rounds + ' rounds';
    else sub = st.checks.filter((c, j) => c >= passesNeeded(parseExercise(blk.exercises[j]))).length + '/' + blk.exercises.length + ' done';
    h += '<li><span class="r-name">' + esc(m.label) + '</span><span class="r-sub">' + sub + '</span><span class="r-time">' + (t != null ? clock(t) : '—') + '</span></li>';
  });
  h += '</ul>';

  h += '<div class="sec-head"><span class="label">Written log</span></div>';
  h += '<pre class="notation">' + esc(entry.notation) + '</pre>';
  h += '<div class="btn-row"><button type="button" class="btn press" data-act="copy" data-id="' + esc(entry.id) + '">Copy</button>' +
    (navigator.share ? '<button type="button" class="btn press" data-act="share" data-id="' + esc(entry.id) + '">Share</button>' : '') + '</div>';
  h += '<div class="sec-head"></div><button type="button" class="act" data-act="summary-done"><span class="act-l">Done</span><span class="act-r"></span></button>';
  $('#view-summary').innerHTML = h;
  countUp($('#sum-time'));
}

// Odometer the total in, easing out, so it lands with the finish cue.
function countUp(node) {
  const target = +node.dataset.ms;
  if (reduceMotion) { node.textContent = clock(target); return; }
  const start = performance.now(), dur = 1100;
  const step = t => {
    const p = Math.min(1, (t - start) / dur);
    node.textContent = clock(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  setTimeout(() => requestAnimationFrame(step), 300);
}

/* ---------- history import / export / copy ---------- */

function copyText(text) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? 'Copied' : 'Copy blocked');
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => toast('Copied'), fallback);
  } else fallback();
}

function exportHistory() {
  const blob = new Blob([JSON.stringify({ app: 'ironlog', v: 1, history: history() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ironlog-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importHistory(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  file.text().then(txt => {
    const data = JSON.parse(txt);
    const incoming = Array.isArray(data) ? data : data.history;
    if (!Array.isArray(incoming)) throw new Error('bad file');
    const h = history();
    const ids = new Set(h.map(x => x.id));
    let added = 0;
    incoming.forEach(x => { if (x && x.id && !ids.has(x.id)) { h.push(x); added++; } });
    writeHistory(h);
    toast(added + ' sessions imported');
    renderLog();
  }).catch(() => toast('Not an Iron Log backup'));
}

/* =========================================================
   INPUT
   ========================================================= */

const ACTIONS = {
  tab(t) {
    const v = t.dataset.view;
    if (v === view) return;
    if (v === 'log') renderLog(); else renderHome();
    show(v);
  },
  sound() {
    soundOn = !soundOn;
    store.set(KEYS.sound, soundOn ? '1' : '0');
    wakeAudio();
    if (soundOn) sfx.go();
    renderHome();
  },
  week(t) { homeWeek = t.dataset.week; renderHome(); },
  'open-day'(t) {
    const day = +t.dataset.day;
    const saved = loadSaved();
    if (saved && saved.day === day && saved.week === homeWeek) { openSession(saved.week, saved.day, saved); return; }
    if (saved && !confirm('A session is still in progress. Discard it and start ' + getDay(homeWeek, day).name + '?')) return;
    store.del(KEYS.session);
    openSession(homeWeek, day);
  },
  resume() { const s = loadSaved(); if (s) openSession(s.week, s.day, s); },
  close() { leaveSession(); },
  clock() {
    if (!S.startedAt) { ensureRunning(); }
    else if (S.runSince) { pauseClock(); toast('Clock paused'); }
    else { ensureRunning(); }
    save(); updateClock();
  },
  jump(t) { const i = +t.dataset.i; if (i !== S.blockIndex) goToBlock(i); },
  note() { ui.noteOpen = !ui.noteOpen; $('.block-note').classList.toggle('open', ui.noteOpen); },
  inc(t) { stepDraft(+t.dataset.ex, 1); },
  dec(t) { stepDraft(+t.dataset.ex, -1); },
  load(t) { const j = +t.dataset.ex; ui.loadEdit = ui.loadEdit === j ? null : j; renderBlock(); },
  'load-step'(t) {
    const j = +t.dataset.ex, st = S.blocks[S.blockIndex];
    st.loads[j] = stepLoad(st.loads[j], +t.dataset.d);
    save(); renderBlock();
  },
  'rung-load'(t) {
    const st = S.blocks[S.blockIndex];
    st.loads = st.loads.map(l => stepLoad(l, +t.dataset.d));
    save(); renderBlock();
  },
  'rung-load-reset'() {
    S.blocks[S.blockIndex].loads = sExs(S.blockIndex).map(ex => ex.load);
    save(); renderBlock();
  },
  'load-reset'(t) {
    const j = +t.dataset.ex;
    S.blocks[S.blockIndex].loads[j] = sExs(S.blockIndex)[j].load;
    ui.loadEdit = null; save(); renderBlock();
  },
  timer(t) {
    const j = +t.dataset.ex;
    if (S.timer && S.timer.b === S.blockIndex && S.timer.ex === j) { S.timer = null; save(); renderBlock(); return; }
    startTimer(j);
  },
  check(t) {
    const j = +t.dataset.ex, st = S.blocks[S.blockIndex];
    const ex = sExs(S.blockIndex)[j];
    const need = passesNeeded(ex);
    ensureRunning();
    st.checks[j] = st.checks[j] >= need ? 0 : need;
    if (S.timer && S.timer.b === S.blockIndex && S.timer.ex === j) S.timer = null;
    if (st.checks[j]) { sfx.log(); buzz(20); }
    save(); renderBlock();
  },
  'log-round'() { logRound(); },
  'next-block'() { goToBlock(S.blockIndex + 1); },
  'extra-round'() {
    S.blocks[S.blockIndex].extra++;
    S.blocks[S.blockIndex].tEnd = null;
    save(); ui.swapAct = true; renderBlock(); renderStrip();
  },
  'undo-round'() {
    const st = S.blocks[S.blockIndex];
    if (st.emom && !st.emom.done) { toast('EMOM is logging rounds'); return; }
    st.rounds.pop();
    syncRung(S.blockIndex);
    st.tEnd = null;
    if (S.rest && S.rest.b === S.blockIndex) closeRest();
    save(); renderBlock(); renderStrip();
  },
  'effort-cycle'(t) {
    const r = S.blocks[S.blockIndex].rounds[+t.dataset.r];
    const order = [null, 'easy', 'solid', 'grind'];
    r.effort = order[(order.indexOf(r.effort || null) + 1) % order.length];
    save(); renderBlock();
  },
  'emom-start'() {
    const st = S.blocks[S.blockIndex];
    ensureRunning();
    st.emom = { startAt: now(), lastMin: 0, beep: null, done: false };
    sfx.go(); buzz([120, 50, 120]);
    save(); renderBlock();
  },
  'rest-adj'(t) {
    S.rest.endsAt += +t.dataset.d * 1000;
    S.rest.dur = Math.max(1000, S.rest.dur + +t.dataset.d * 1000);
    if (S.rest.endsAt > now()) S.rest.over = false;
    S.rest.beep = null;
    save(); paintRest(S.rest.endsAt - now());
  },
  'rest-effort'(t) {
    const r = S.blocks[S.rest.b].rounds[S.rest.r];
    if (!r) return;
    r.effort = r.effort === t.dataset.v ? null : t.dataset.v;
    if (r.effort === 'grind') buzz(40);
    save(); renderRest();
    if (S.rest.b === S.blockIndex) renderBlock();
  },
  'rest-drop'() {
    const st = S.blocks[S.rest.b];
    st.loads[0] = dropTarget(sBlock(S.rest.b).note);
    toast('Load dropped'); save(); renderRest(); renderBlock();
  },
  'rest-down-load'() {
    const st = S.blocks[S.rest.b];
    st.loads[0] = stepLoad(st.loads[0], -1);
    toast('Load down a step'); save(); renderRest(); renderBlock();
  },
  'rest-down-rep'() {
    const st = S.blocks[S.rest.b];
    st.draft[0] = Math.max(0, st.draft[0] - 1);
    toast('One rep fewer'); save(); renderRest(); renderBlock();
  },
  'rest-done'() { closeRest(); },
  copy(t) { const e = history().find(x => x.id === t.dataset.id); if (e) copyText(e.notation); },
  share(t) {
    const e = history().find(x => x.id === t.dataset.id);
    if (e && navigator.share) navigator.share({ title: e.dayName, text: e.notation }).catch(() => {});
  },
  export() { exportHistory(); },
  'summary-done'() { shutter(() => { renderHome(); show('home'); }); }
};

function stepDraft(j, dir) {
  const st = S.blocks[S.blockIndex];
  const ex = sExs(S.blockIndex)[j];
  const step = ex.isCarry ? 10 : 1;
  st.draft[j] = Math.max(0, st.draft[j] + dir * step);
  save();
  const out = $('#out-' + j);
  if (!out) return;
  out.querySelector('span').textContent = st.draft[j];
  out.classList.toggle('off', st.draft[j] < ex.value);
  out.classList.remove('up', 'down'); void out.offsetWidth;
  out.classList.add(dir > 0 ? 'up' : 'down');
}

const HOLDS = {
  finish() { finishSession(); },
  discard() { store.del(KEYS.session); toast('Session discarded'); renderHome(); },
  delete(t) {
    writeHistory(history().filter(x => x.id !== t.dataset.id));
    toast('Deleted'); renderLog();
  },
  'emom-end'() {
    const st = S.blocks[S.blockIndex];
    st.emom.done = true;
    st.tEnd = elapsed();
    save(); renderBlock(); renderStrip();
  }
};

// A completed hold is followed by the finger lifting; that click must not
// land on whatever the hold just put under it.
let swallowClick = false;

document.addEventListener('click', e => {
  if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); return; }
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  wakeAudio();
  sfx.tap();
  const fn = ACTIONS[t.dataset.act];
  if (fn) fn(t, e);
});

// Hold-to-confirm: destructive or final actions need a deliberate press.
let holdTimer = null, holdEl = null;
function holdCancel() {
  clearTimeout(holdTimer); holdTimer = null;
  if (holdEl) holdEl.classList.remove('holding');
  holdEl = null;
}
document.addEventListener('pointerdown', e => {
  swallowClick = false;
  const t = e.target.closest('[data-hold]');
  if (!t) return;
  wakeAudio();
  holdEl = t;
  t.classList.add('holding');
  buzz(10);
  const ms = parseFloat(getComputedStyle(t).getPropertyValue('--hold')) * 1000 || 900;
  holdTimer = setTimeout(() => {
    const fn = HOLDS[t.dataset.hold];
    holdCancel();
    swallowClick = true;
    buzz(50);
    if (fn) fn(t);
  }, ms);
});
document.addEventListener('pointerup', holdCancel, true);
document.addEventListener('pointercancel', holdCancel, true);
// pointerleave doesn't bubble but does reach capture listeners for every
// child, so only the held element itself leaving counts.
document.addEventListener('pointerleave', e => { if (e.target === holdEl) holdCancel(); }, true);
document.addEventListener('contextmenu', e => { if (e.target.closest('[data-hold]')) e.preventDefault(); });

/* =========================================================
   LIFECYCLE
   ========================================================= */

setInterval(() => {
  if (!S) return;
  if (view === 'session') updateClock();
  tickTimers();
}, 100);

// Write the session every few seconds while the clock runs, and on hide.
setInterval(() => { if (S && S.runSince) save(); }, 5000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save();
  else if (S && S.runSince) acquireWake();
});
window.addEventListener('pagehide', save);

fetch('current.json', { cache: 'no-cache' })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(data => {
    program = data.program;
    progMeta = readProgramMeta();
    document.title = program.title + ' · Iron Log';
    const saved = loadSaved();
    homeWeek = saved ? saved.week : progMeta.weeks[0];
    renderHome();
    show('home');
  })
  .catch(err => {
    console.error(err);
    $('#view-home').innerHTML = '<div class="empty plate"><b>No program loaded</b>Could not read current.json. It needs to sit beside index.html and be valid JSON.</div>';
  });
