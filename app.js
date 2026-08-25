/* =========================================================
   FIELD LOG
   Data -> current.json (see json_schema_docs.md)
   Notation -> ProgrammingNotation.md
   ========================================================= */

var program = null;
var selectedWeek = null;
var selectedDay = null;
var currentBlockIndex = 0;
var blockTimes = [];

var el = function (id) { return document.getElementById(id); };

var reduceMotion = window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var hasGsap = typeof gsap !== 'undefined';

/* =========================================================
   NOTATION PARSING
   The DSL is decoded for display so a block header reads as
   "5 rounds / 120s rest" rather than "5A120s".
   ========================================================= */

function parseBlockHeader(header) {
  if (header === 'WU') return { kind: 'wu', label: 'Warm-up' };
  if (header === 'FIN') return { kind: 'fin', label: 'Finisher' };
  var m = /^(\d+)([A-Z])(\d+)s$/.exec(header);
  if (m) {
    return {
      kind: 'work',
      label: 'Block ' + m[2],
      rounds: parseInt(m[1], 10),
      rest: parseInt(m[3], 10)
    };
  }
  return { kind: 'work', label: header };
}

function parseExercise(line) {
  var at = line.lastIndexOf('@');
  var body = at > -1 ? line.slice(0, at) : line;
  var load = at > -1 ? line.slice(at + 1) : null;
  var m = /^(.*?)\s+(:?\d+(?:-\d+)?'?)$/.exec(body);
  if (m) return { name: m[1], dose: m[2], load: load };
  return { name: body.trim(), dose: null, load: load };
}

/* Compact display forms. The raw notation (":120", "8'", "@16") is precise
   but slow to read one-handed mid-set, so it is expanded just enough to
   scan: ":120" -> "120s", "8'" -> "8 ea", "16" -> "16kg". */
function showDose(dose) {
  if (!dose) return '';
  var each = dose.charAt(dose.length - 1) === "'";
  var core = each ? dose.slice(0, -1) : dose;
  var text = core.charAt(0) === ':' ? core.slice(1) + 's' : core;
  return text + (each ? ' ea' : '');
}

function showLoad(load) {
  if (!load) return '';
  if (load === 'BW') return 'BW';
  if (/lbs$/.test(load)) return load.replace(/lbs$/, 'lb');
  return load + 'kg';
}

// Spoken form, used for the screen-reader label only.
function readDose(dose) {
  if (!dose) return '';
  var each = dose.charAt(dose.length - 1) === "'";
  var core = each ? dose.slice(0, -1) : dose;
  var text = core.charAt(0) === ':'
    ? core.slice(1) + ' seconds'
    : core + ' reps';
  return text + (each ? ' each side' : '');
}

function readLoad(load) {
  if (!load) return '';
  if (load === 'BW') return 'bodyweight';
  var unit = function (v) {
    return /lbs$/.test(v) ? v.replace(/lbs$/, ' pounds') : v + ' kilos';
  };
  if (load.charAt(0) === '+') return 'weighted plus ' + unit(load.slice(1));
  if (load.charAt(0) === '-') return 'assisted minus ' + unit(load.slice(1));
  if (load.indexOf('+') > -1) return 'double, ' + load.split('+').map(unit).join(' and ');
  return unit(load);
}

function plural(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* =========================================================
   DATA LOAD
   ========================================================= */

function loadData() {
  fetch('current.json')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      program = data.program;

      el('program-title').textContent = program.title;
      el('program-subtitle').textContent = program.subtitle || '';
      document.title = program.title + ' — Field Log';

      // Programme notes are optional.
      var notes = el('program-notes');
      if (program.notes) {
        el('program-notes-body').textContent = program.notes;
        notes.hidden = false;
      } else {
        notes.hidden = true;
      }

      selectedWeek = Object.keys(program.weeks)[0];
      renderWeekButtons();
      updatePhaseInfo();
      renderDayGrid();
    })
    .catch(function (error) {
      console.error('Error loading workout data:', error);
      el('day-grid').innerHTML =
        '<div class="panel panel-notes"><span class="panel-tab">Error</span>' +
        '<p class="notes-body">Could not load <code>current.json</code>. ' +
        'Check that it sits beside <code>index.html</code> and is valid JSON.</p></div>';
    });
}

/* =========================================================
   SELECTION VIEW
   ========================================================= */

function renderWeekButtons() {
  var host = el('week-buttons');
  host.innerHTML = '';

  Object.keys(program.weeks).forEach(function (week) {
    var btn = document.createElement('button');
    btn.className = 'week-btn';
    btn.type = 'button';
    btn.dataset.week = week;
    btn.setAttribute('aria-current', week === selectedWeek ? 'true' : 'false');
    btn.innerHTML =
      '<span class="week-label">Week</span>' +
      '<span class="week-num">' + escapeHtml(week) + '</span>';
    btn.addEventListener('click', function () { selectWeek(week); });
    host.appendChild(btn);
  });
}

function selectWeek(week) {
  selectedWeek = week;
  Array.prototype.forEach.call(
    document.querySelectorAll('.week-btn'),
    function (btn) {
      btn.setAttribute('aria-current', btn.dataset.week === week ? 'true' : 'false');
    }
  );
  updatePhaseInfo();
  renderDayGrid();
}

function updatePhaseInfo() {
  var week = program.weeks[selectedWeek];
  el('phase-title').textContent = week.phase;
  el('phase-goal').textContent = week.goal;
}

function renderDayGrid() {
  var grid = el('day-grid');
  grid.innerHTML = '';

  program.weeks[selectedWeek].days.forEach(function (day) {
    var work = day.blocks.filter(function (b) {
      return parseBlockHeader(b.header).kind === 'work';
    }).length;

    var card = document.createElement('button');
    card.className = 'panel day-card';
    card.type = 'button';
    card.innerHTML =
      '<span class="panel-tab">Day ' + escapeHtml(day.day) + '</span>' +
      '<span class="day-name">' + escapeHtml(day.name) + '</span>' +
      '<span class="day-meta">' +
        '<span class="badge badge-pending">' + plural(day.blocks.length, 'block') + '</span>' +
        '<span class="badge badge-pending">' + work + ' working</span>' +
      '</span>';
    card.addEventListener('click', function () { openWorkout(day.day); });
    grid.appendChild(card);
  });
}

/* =========================================================
   WORKOUT VIEW
   ========================================================= */

function currentDay() {
  return program.weeks[selectedWeek].days.filter(function (d) {
    return d.day === selectedDay;
  })[0];
}

function openWorkout(day) {
  selectedDay = day;
  currentBlockIndex = 0;
  blockTimes = [];
  swReset();

  var dayData = currentDay();
  setSessionChrome(true);
  el('workout-label').textContent = 'Week ' + selectedWeek + ' · Day ' + day;
  el('workout-title').textContent = dayData.name;

  renderCurrentBlock();

  el('selection-view').hidden = true;
  el('workout-view').hidden = false;
  el('action-bar').hidden = false;
  document.body.classList.add('session-open');
  window.scrollTo(0, 0);
}

function renderProgressRail(total) {
  var rail = el('progress-rail');
  rail.innerHTML = '';
  for (var i = 0; i < total; i++) {
    var li = document.createElement('li');
    if (i < currentBlockIndex) li.className = 'done';
    else if (i === currentBlockIndex) li.className = 'current';
    rail.appendChild(li);
  }
}

function renderCurrentBlock() {
  var dayData = currentDay();
  var blocks = dayData.blocks;
  var block = blocks[currentBlockIndex];
  var meta = parseBlockHeader(block.header);
  var isLast = currentBlockIndex === blocks.length - 1;

  renderProgressRail(blocks.length);

  el('sw-plate-label').textContent =
    'Block ' + (currentBlockIndex + 1) + ' of ' + blocks.length +
    ' — ' + (block.label || meta.label);

  el('advance-btn').textContent = isLast ? 'Finish session' : 'Next block';

  var html = '';
  html += '<div class="panel block-panel is-' + meta.kind + '">';
  html += '<span class="panel-tab">' + escapeHtml(block.label || meta.label) + '</span>';

  html += '<div class="block-meta">';
  if (meta.rounds) {
    html += '<span class="badge badge-active">' + plural(meta.rounds, 'round') + '</span>';
  }
  if (meta.rest) {
    html += '<span class="badge badge-pending">' + meta.rest + 's rest</span>';
  }
  html += '<span class="badge badge-pending">' + plural(block.exercises.length, 'movement') + '</span>';
  html += '</div>';

  if (block.note) {
    html += '<p class="block-note">' + escapeHtml(block.note) + '</p>';
  }

  html += '<ul class="exercise-list">';
  block.exercises.forEach(function (line) {
    var ex = parseExercise(line);
    var isRest = /^rest$/i.test(ex.name);
    var spoken = ex.name + ' ' + readDose(ex.dose) +
      (ex.load ? ', ' + readLoad(ex.load) : '');

    html += '<li class="exercise-item' + (isRest ? ' is-rest' : '') + '"' +
      ' aria-label="' + escapeHtml(spoken) + '">';
    html += '<span class="ex-name" aria-hidden="true">' + escapeHtml(ex.name) + '</span>';
    html += '<span aria-hidden="true">';
    if (ex.dose) html += '<span class="ex-dose">' + escapeHtml(showDose(ex.dose)) + '</span>';
    if (ex.load) html += '<span class="ex-load">' + escapeHtml(showLoad(ex.load)) + '</span>';
    html += '</span>';
    html += '</li>';
  });
  html += '</ul>';
  html += '</div>';

  // Times banked so far this session.
  if (blockTimes.length) {
    html += '<div class="rounds-wrap"><p class="field-label">Blocks filed</p><div class="timer-list">';
    blockTimes.forEach(function (t, i) {
      var b = blocks[i];
      html += '<div class="timer-list-row">' +
        '<span class="timer-list-label">' + escapeHtml(b.label || parseBlockHeader(b.header).label) + '</span>' +
        '<span class="timer-list-time">' + clockText(t) + '</span>' +
        '</div>';
    });
    html += '</div></div>';
  }

  el('workout-blocks').innerHTML = html;

  // Round targets come from the block header, so the label can be exact.
  el('rounds-label').textContent = meta.rounds ? 'Rounds (target ' + meta.rounds + ')' : 'Rounds';
}

function advanceBlock() {
  var blocks = currentDay().blocks;
  blockTimes.push(currentElapsed());

  if (currentBlockIndex === blocks.length - 1) {
    swStop();
    showSummary();
    return;
  }

  currentBlockIndex++;
  var wasRunning = running;
  swZero();            // new block, clock back to zero
  if (wasRunning) swStart();
  renderCurrentBlock();
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}

// The instrument, its controls and the progress rail are session furniture.
// They come down once the session is filed, and go back up on the next one.
function setSessionChrome(visible) {
  ['sw-panel', 'sw-controls', 'progress-rail', 'workout-head'].forEach(function (id) {
    el(id).hidden = !visible;
  });
  if (!visible) el('rounds-wrap').hidden = true;
}

function showSummary() {
  var dayData = currentDay();
  var total = blockTimes.reduce(function (a, b) { return a + b; }, 0);

  var html = '<div class="summary">';
  html += '<div class="summary-stamp">CASE<br>CLOSED</div>';
  html += '<h2>Session filed</h2>';
  html += '<p class="lead" style="margin:0 auto;">' + escapeHtml(dayData.name) + '</p>';
  html += '<p class="summary-total">' + clockText(total) + '</p>';
  html += '<p class="eyebrow">Total elapsed</p>';

  html += '<div class="panel"><span class="panel-tab">Block times</span><div class="timer-list">';
  blockTimes.forEach(function (t, i) {
    var b = dayData.blocks[i];
    html += '<div class="timer-list-row">' +
      '<span class="timer-list-label">' + escapeHtml(b.label || parseBlockHeader(b.header).label) + '</span>' +
      '<span class="timer-list-time">' + clockText(t) + '</span>' +
      '</div>';
  });
  html += '</div></div>';
  html += '<button class="btn btn-primary summary-back" type="button" id="summary-back">' +
          'Back to sessions</button>';
  html += '</div>';

  el('workout-blocks').innerHTML = html;
  el('summary-back').addEventListener('click', closeWorkout);

  setSessionChrome(false);
  el('action-bar').hidden = true;
  document.body.classList.remove('session-open');
  window.scrollTo(0, 0);
}

function closeWorkout() {
  selectedDay = null;
  currentBlockIndex = 0;
  blockTimes = [];
  swReset();

  el('selection-view').hidden = false;
  el('workout-view').hidden = true;
  el('action-bar').hidden = true;
  document.body.classList.remove('session-open');
  window.scrollTo(0, 0);
}

/* =========================================================
   SPLIT-FLAP STOPWATCH
   ========================================================= */

/* -- synthesized mechanical clack -- */
var audioCtx = null;
var soundOn = true;

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playClack() {
  if (!soundOn || !audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  var t = audioCtx.currentTime;
  var size = Math.floor(audioCtx.sampleRate * 0.035);
  var buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  var data = buffer.getChannelData(0);
  for (var i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / size, 2);
  var noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  var filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 1500; filter.Q.value = 0.9;
  var gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
  noise.start(t); noise.stop(t + 0.05);
}

/* -- split-flap digit -- */
function FlipDigit(node) {
  this.el = node;
  this.top = node.querySelector('.fd-top span');
  this.bottom = node.querySelector('.fd-bottom span');
  this.frontEl = node.querySelector('.fd-leaf-front');
  this.front = this.frontEl.querySelector('span');
  this.frontShade = this.frontEl.querySelector('.fd-shade');
  this.backEl = node.querySelector('.fd-leaf-back');
  this.back = this.backEl.querySelector('span');
  this.backShade = this.backEl.querySelector('.fd-shade');
  this.current = '0';
  [this.top, this.bottom, this.front, this.back].forEach(function (s) { s.textContent = '0'; });
  if (hasGsap) {
    gsap.set(this.frontEl, { rotateX: 0 });
    gsap.set(this.backEl, { rotateX: 90 });
    gsap.set([this.frontShade, this.backShade], { opacity: 0 });
  }
}

FlipDigit.prototype.set = function (value, delay) {
  value = String(value);
  if (value === this.current) return;
  this.current = value;

  // No GSAP (offline) or reduced motion: land the digit without the turn.
  if (!hasGsap || reduceMotion) {
    this.top.textContent = value;
    this.bottom.textContent = value;
    this.front.textContent = value;
    this.back.textContent = value;
    return;
  }

  delay = delay || 0;
  var old = this.top.textContent;  // top/bottom stay on the OLD value until their leaf reveals the new one
  this.front.textContent = old;    // the falling leaf carries the old digit as it covers
  this.back.textContent = value;   // the rising leaf carries the new digit as it lands
  gsap.set(this.frontEl, { rotateX: 0 });
  gsap.set(this.backEl, { rotateX: 90 });
  gsap.set([this.frontShade, this.backShade], { opacity: 0 });

  var self = this;
  gsap.timeline({ delay: delay })
    // front leaf falls away, darkening as it turns edge-on to the light
    .to(this.frontEl, { rotateX: -90, duration: 0.16, ease: 'power2.in' })
    .to(this.frontShade, { opacity: 0.42, duration: 0.16, ease: 'power2.in' }, '<')
    // the whole card dips fractionally at the moment of impact
    .to(this.el, { y: 1.5, duration: 0.05, ease: 'power1.in' }, '-=0.03')
    .call(function () {
      self.top.textContent = value; // top half only shows the new digit once its leaf has actually cleared it
      playClack();
    })
    // back leaf lands and settles into the light
    .to(this.backEl, { rotateX: 0, duration: 0.19, ease: 'power3.out' })
    .to(this.backShade, { opacity: 0, duration: 0.19, ease: 'power3.out' }, '<')
    .to(this.el, { y: 0, duration: 0.24, ease: 'elastic.out(1, 0.55)' }, '-=0.17')
    .call(function () {
      self.bottom.textContent = value; // bottom half swaps only once its leaf is flush and already covering it
    });
};

/* -- stopwatch -- */
var digits = {};
Array.prototype.forEach.call(document.querySelectorAll('.flip-digit'), function (node) {
  digits[node.dataset.role] = new FlipDigit(node);
});

var csEl = el('sw-cs');
var toggleBtn = el('sw-toggle');
var lapBtn = el('sw-lap');
var resetBtn = el('sw-reset');
var soundBtn = el('sw-sound');
var lapsEl = el('sw-laps');
var roundsWrap = el('rounds-wrap');
var barTime = el('bar-time');
var barChip = el('bar-chip');
var a11yEl = el('sw-a11y');

var running = false, startTs = 0, accumulated = 0, laps = [], rafId = null;
var lastWholeSecond = -1;
var STAGGER = 0.045; // seconds between each digit's flip when several change together

function format(ms) {
  var totalCs = Math.floor(ms / 10);
  var cs = totalCs % 100;
  var totalSec = Math.floor(totalCs / 100);
  var ss = totalSec % 60;
  var mm = Math.floor(totalSec / 60) % 100;
  return { mm: mm, ss: ss, cs: cs };
}

function pad(n) { return String(n).padStart(2, '0'); }

function clockText(ms) {
  var t = format(ms);
  return pad(t.mm) + ':' + pad(t.ss);
}

function currentElapsed() {
  return accumulated + (running ? performance.now() - startTs : 0);
}

function render() {
  var ms = currentElapsed();
  var t = format(ms);
  digits.m1.set(Math.floor(t.mm / 10), 0 * STAGGER);
  digits.m2.set(t.mm % 10, 1 * STAGGER);
  digits.s1.set(Math.floor(t.ss / 10), 2 * STAGGER);
  digits.s2.set(t.ss % 10, 3 * STAGGER);
  csEl.textContent = pad(t.cs);

  // Mirror into the action bar and the screen-reader label once per second,
  // not once per frame.
  var whole = t.mm * 60 + t.ss;
  if (whole !== lastWholeSecond) {
    lastWholeSecond = whole;
    barTime.textContent = pad(t.mm) + ':' + pad(t.ss);
    a11yEl.textContent = t.mm + ' minutes ' + t.ss + ' seconds';
  }
}

function loop() {
  render();
  if (running) rafId = requestAnimationFrame(loop);
}

function renderLaps() {
  if (!laps.length) {
    roundsWrap.hidden = true;
    lapsEl.innerHTML = '';
    return;
  }
  roundsWrap.hidden = false;
  lapsEl.innerHTML = laps.slice().reverse().map(function (lap, i) {
    var n = laps.length - i;
    var t = format(lap);
    var label = pad(t.mm) + ':' + pad(t.ss) + '.' + pad(t.cs);
    return '<div class="timer-list-row">' +
      '<span class="timer-list-label">Round ' + n + '</span>' +
      '<span class="timer-list-time">' + label + '</span>' +
      '</div>';
  }).join('');
}

function setRunningUi(isRunning) {
  toggleBtn.textContent = isRunning ? 'Stop' : 'Start';
  toggleBtn.classList.toggle('btn-danger', isRunning);
  toggleBtn.classList.toggle('btn-primary', !isRunning);
  barChip.classList.toggle('is-running', isRunning);
  if (isRunning) lapBtn.removeAttribute('disabled');
  else lapBtn.setAttribute('disabled', 'true');
}

function swStart() {
  if (running) return;
  ensureAudio();
  running = true;
  startTs = performance.now();
  setRunningUi(true);
  loop();
}

function swStop() {
  if (!running) return;
  running = false;
  accumulated += performance.now() - startTs;
  cancelAnimationFrame(rafId);
  setRunningUi(false);
  render();
}

// Clock back to zero, laps cleared, running state untouched.
function swZero() {
  running = false;
  cancelAnimationFrame(rafId);
  accumulated = 0;
  laps = [];
  setRunningUi(false);
  render();
  renderLaps();
}

function swReset() {
  swZero();
}

toggleBtn.addEventListener('click', function () {
  if (!running) swStart();
  else swStop();
});

lapBtn.addEventListener('click', function () {
  if (!running) return;
  laps.push(currentElapsed());
  renderLaps();
});

resetBtn.addEventListener('click', swReset);

soundBtn.addEventListener('click', function () {
  soundOn = !soundOn;
  soundBtn.querySelector('span').textContent = soundOn ? 'Sound on' : 'Sound off';
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  soundBtn.setAttribute('aria-label', soundOn ? 'Mechanical sound on' : 'Mechanical sound off');
});

/* =========================================================
   WIRING
   ========================================================= */

el('back-btn').addEventListener('click', closeWorkout);
el('advance-btn').addEventListener('click', advanceBlock);

render();
renderLaps();
loadData();
