/* =========================================================
   TUNES
   A YouTube queue that plays inside Iron Log, so you never
   leave the app between sets. Paste a share link, line up a
   few, and they play one after another.

   Uses YouTube's official IFrame Player API. YouTube's terms
   say an embedded player must stay visible, uncovered and at
   least 200x200 while it plays. So while it plays, the player
   sits in a strip docked just above whatever owns the bottom
   of the screen (tab bar, session dock, or the rest sheet's
   button), and the page makes room for it, so it covers
   nothing and nothing covers it. Collapsing to the slim bar
   pauses playback.

   State (queue, position) lives in localStorage, so a reload
   or tomorrow picks up where you left off, paused.
   ========================================================= */
(function () {
  'use strict';

  const KEY = 'ironlog.tunes.v1';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const say = msg => { if (typeof window.toast === 'function') window.toast(msg); };

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  const saved = read();
  const st = {
    queue: Array.isArray(saved.queue) ? saved.queue : [], // [{ id, start, title }]; queue[0] is current
    pos: saved.pos || 0,                                  // seconds into queue[0]
    mode: 'off'                                           // off | bar | strip | deck
  };
  st.mode = st.queue.length ? 'bar' : 'off'; // never autoplay on load

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ queue: st.queue, pos: st.pos })); } catch (e) { /* ignore */ }
  }

  /* ---------- links ---------- */

  // youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /live/ID, /embed/ID,
  // m. and music. hosts, share links with ?si=..., and an optional t= start.
  function parseLink(text) {
    const s = String(text || '').trim();
    let m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|live\/|embed\/))([A-Za-z0-9_-]{11})/.exec(s);
    if (!m && /^[A-Za-z0-9_-]{11}$/.test(s)) m = [s, s];
    if (!m) return null;
    const t = /[?&]t=(?:(\d+)h)?(?:(\d+)m)?(\d+)?s?/.exec(s);
    const start = t ? (+t[1] || 0) * 3600 + (+t[2] || 0) * 60 + (+t[3] || 0) : 0;
    return { id: m[1], start };
  }

  // Best effort; the player fills the title in once a video loads anyway.
  function fetchTitle(item) {
    fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + item.id))
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && d.title && !item.title) { item.title = d.title; save(); render(); } })
      .catch(() => {});
  }

  /* ---------- player ---------- */

  let player = null, ready = false, playing = false, buffering = false, wantPlay = false, apiLoading = null;
  let duration = 0, current = 0;

  function api() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (apiLoading) return apiLoading;
    apiLoading = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
      const sc = document.createElement('script');
      sc.src = 'https://www.youtube.com/iframe_api';
      sc.onerror = () => { apiLoading = null; reject(new Error('api')); };
      document.head.appendChild(sc);
    });
    return apiLoading;
  }

  function ensurePlayer() {
    const cur = st.queue[0];
    if (!cur || player) return;
    api().then(() => {
      if (player) return;
      player = new YT.Player('yt-player', {
        width: 200, height: 200, videoId: cur.id,
        playerVars: { playsinline: 1, rel: 0, start: Math.floor(st.pos || cur.start || 0) },
        events: {
          onReady() {
            ready = true;
            if (wantPlay) player.playVideo();
            tick();
            render();
          },
          onStateChange(e) {
            playing = e.data === YT.PlayerState.PLAYING;
            buffering = e.data === YT.PlayerState.BUFFERING;
            if (playing) {
              // Started from somewhere else (a headset button): show the player, it has to be visible.
              if (st.mode === 'bar' || st.mode === 'off') st.mode = 'strip';
              const d = player.getVideoData && player.getVideoData();
              const item = st.queue[0];
              if (item && d && d.title && item.title !== d.title) { item.title = d.title; save(); }
            }
            if (e.data === YT.PlayerState.ENDED) { next(true); return; }
            tick();
            render();
          },
          onError(e) {
            // 2 bad id, 5 HTML5 error, 100 gone or private, 101/150 embedding off.
            const item = st.queue[0];
            console.warn('Tunes: YouTube error', e.data, item && item.id);
            say(e.data === 101 || e.data === 150 ? 'Owner blocks playing it here. Skipped.' : "Can't play that one. Skipped.");
            next(true);
          }
        }
      });
    }).catch(() => { wantPlay = false; say("Couldn't reach YouTube"); render(); });
  }

  function play() {
    if (!st.queue.length) return;
    if (st.mode !== 'deck') st.mode = 'strip';
    wantPlay = true;
    render();
    if (player && ready) player.playVideo();
    else ensurePlayer();
  }

  function pause() {
    wantPlay = false;
    if (player && ready) player.pauseVideo();
    render();
  }

  function load(item, autoplay) {
    st.pos = item.start || 0;
    if (!player || !ready) return;
    const args = { videoId: item.id, startSeconds: item.start || 0 };
    if (autoplay) player.loadVideoById(args); else player.cueVideoById(args);
  }

  // Drop the current video and move to the next; keeps playing if it was.
  function next(auto) {
    const keepGoing = auto || playing || wantPlay;
    st.queue.shift();
    st.pos = 0;
    duration = current = 0;
    save();
    if (!st.queue.length) {
      if (player && ready) player.stopVideo();
      playing = false; wantPlay = false;
      if (st.mode !== 'deck') st.mode = 'off';
      if (auto) say('Queue finished');
      render();
      return;
    }
    wantPlay = keepGoing;
    load(st.queue[0], keepGoing);
    render();
  }

  function add(text) {
    const v = parseLink(text);
    if (!v) { say("That's not a YouTube link"); return false; }
    if (st.queue.some(q => q.id === v.id)) { say('Already in the queue'); return false; }
    const item = { id: v.id, start: v.start, title: null };
    st.queue.push(item);
    if (st.queue.length === 1) { load(item, false); ensurePlayer(); }
    save();
    fetchTitle(item);
    if (st.mode === 'off') st.mode = 'deck';
    render();
    say(st.queue.length === 1 ? 'Added. Tap play.' : 'Added · ' + (st.queue.length - 1) + ' up next');
    return true;
  }

  function remove(k) {
    if (k === 0) { next(false); return; }
    st.queue.splice(k, 1);
    save(); render();
  }

  function moveUp(k) {
    if (k <= 1) return; // the current video stays put
    const [item] = st.queue.splice(k, 1);
    st.queue.splice(k - 1, 0, item);
    save(); render();
  }

  // The app's cues (countdown, go, log) play over the video: dip the video for a moment.
  let ducked = false, duckTimer = null, fullVolume = 100;
  function duck() {
    if (!player || !ready || !playing || !player.getVolume) return;
    if (!ducked) { fullVolume = player.getVolume(); player.setVolume(Math.round(fullVolume * 0.3)); ducked = true; }
    clearTimeout(duckTimer);
    duckTimer = setTimeout(() => { if (player && ready) player.setVolume(fullVolume); ducked = false; }, 1600);
  }

  /* ---------- view ---------- */

  const clock = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
  const thumb = id => 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
  const title = item => (item && item.title) || 'YouTube video';
  const icon = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4l10 8-10 8zM16 4h3v16h-3z"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.4 8 12 14.6 18.6 8 20 9.4l-8 8-8-8z"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h13v2H3zM3 11h13v2H3zM3 16h8v2H3zM18 13h2v3h3v2h-3v3h-2v-3h-3v-2h3z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.6 4.2 12 10.6l6.4-6.4 1.4 1.4-6.4 6.4 6.4 6.4-1.4 1.4-6.4-6.4-6.4 6.4-1.4-1.4 6.4-6.4-6.4-6.4z"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 7-1.4 1.4-4.6-4.6V19h-2V8.8l-4.6 4.6L5 12z"/></svg>'
  };
  const btn = (act, svg, label, cls = '', attrs = '') =>
    '<button type="button" class="t-btn' + cls + '" data-tune="' + act + '" aria-label="' + esc(label) + '"' + attrs + '>' + svg + '</button>';

  const isOn = () => playing || wantPlay;

  // One short status line: what the player is doing, or how long is left.
  function status() {
    if (wantPlay && !playing && (!ready || buffering)) return 'Loading…';
    if (!duration) return isOn() ? '' : 'Paused';
    const left = clock(duration - current) + ' left';
    return isOn() ? left : 'Paused · ' + left;
  }
  const progress = () => (duration ? Math.min(1, current / duration) : 0);

  let lastMode = null;

  function render() {
    const root = $('#tunes');
    if (!root) return;
    const cur = st.queue[0];
    const on = isOn();
    root.hidden = st.mode === 'off';
    root.dataset.mode = st.mode;
    root.dataset.state = !cur ? 'empty' : on ? 'on' : 'paused';
    document.body.classList.toggle('tunes-deck', st.mode === 'deck');
    const playBtn = btn(on ? 'pause' : 'play', on ? icon.pause : icon.play, on ? 'Pause' : 'Play', ' t-main');
    const upNext = st.queue[1];

    let bar = '';
    if (st.mode === 'bar' && cur) {
      // Paused and slim: the player is tucked away, nothing plays.
      bar = '<button type="button" class="t-resume" data-tune="play" aria-label="Play ' + esc(title(cur)) + '">' +
        '<img src="' + thumb(cur.id) + '" alt="" width="64" height="36">' +
        '<span class="t-resume-text"><b>' + esc(title(cur)) + '</b><small id="t-time">' + esc(status()) + (upNext ? ' · ' + (st.queue.length - 1) + ' next' : '') + '</small></span>' +
        '<span class="t-resume-go">' + icon.play + '</span></button>' +
        btn('deck', icon.list, 'Open queue');
    } else if (cur) {
      bar = '<div class="t-meta"><span class="label">' + (st.queue.length > 1 ? '1 of ' + st.queue.length : 'Now') + '</span>' +
        (st.mode === 'strip' ? btn('deck', icon.list, 'Queue and add videos') : '') +
        btn('bar', icon.down, 'Pause and shrink') + '</div>' +
        '<b class="t-title">' + esc(title(cur)) + '</b>' +
        '<div class="t-prog" aria-hidden="true"><i id="t-prog" style="transform:scaleX(' + progress() + ')"></i></div>' +
        '<small class="t-status" id="t-time">' + esc(status()) + '</small>' +
        '<div class="t-ctrls">' + playBtn + btn('next', icon.next, upNext ? 'Skip to ' + title(upNext) : 'Skip and end the queue') + '</div>' +
        '<small class="t-upnext">' + (upNext ? 'Next · ' + esc(title(upNext)) : 'Last in queue') + '</small>';
    }
    $('#tunes-bar').innerHTML = bar;

    let top = '', body = '';
    if (st.mode === 'deck') {
      const canPaste = !!(navigator.clipboard && navigator.clipboard.readText);
      top += '<div class="t-head"><h2 class="label" id="t-heading">Tunes' + (st.queue.length ? ' · ' + st.queue.length + ' queued' : '') + '</h2>' + btn('close', icon.close, 'Close queue') + '</div>';
      if (canPaste) top += '<button type="button" class="btn btn-go press t-paste" data-tune="paste">Paste YouTube link</button>';
      top += '<form class="t-add' + (canPaste ? ' quiet' : '') + '" data-tune-form>' +
        '<input type="url" inputmode="url" id="t-link" placeholder="' + (canPaste ? 'or type one here' : 'Paste a YouTube link') + '" aria-label="YouTube link" autocomplete="off" enterkeyhint="go">' +
        '<button type="submit" class="btn press">Add</button></form>';
      if (st.queue.length) {
        body += '<div class="t-label"><span class="label">Queue</span><button type="button" class="t-clear" data-tune="clear">Clear all</button></div>' +
          '<ol class="t-queue">' + st.queue.map((q, k) =>
            '<li' + (k === 0 ? ' class="now"' : '') + '><img src="' + thumb(q.id) + '" alt="" width="64" height="36">' +
            '<span><small>' + (k === 0 ? (on ? 'Playing' : 'Now') : 'Up ' + (k === 1 ? 'next' : k)) + '</small>' + esc(title(q)) + '</span>' +
            (k > 1 ? btn('up', icon.up, 'Play ' + title(q) + ' sooner', '', ' data-k="' + k + '"') : '<i></i>') +
            btn('remove', icon.close, (k === 0 ? 'Skip ' : 'Remove ') + title(q), '', ' data-k="' + k + '"') + '</li>').join('') + '</ol>';
      } else {
        body += '<ol class="t-how">' +
          '<li><b>1</b><span>In YouTube, tap <em>Share</em>, then <em>Copy link</em>.</span></li>' +
          '<li><b>2</b><span>Come back here and tap <em>Paste</em>. Line up two or three.</span></li>' +
          '<li><b>3</b><span>Press play. They run one after another.</span></li></ol>';
      }
      body += '<p class="t-fine">Plays through YouTube, ads included. The player has to stay on screen while it plays; shrink it to pause.</p>';
    }
    // Keep a half-typed link when the panel re-renders.
    const typed = $('#t-link') ? $('#t-link').value : '';
    $('#tunes-top').innerHTML = top;
    if (typed && $('#t-link')) $('#t-link').value = typed;
    $('#tunes-body').innerHTML = body;

    if (st.mode !== lastMode) {
      root.classList.remove('t-enter'); void root.offsetWidth; root.classList.add('t-enter');
      // Focus a button, not the text box: a keyboard popping up would hide half the panel.
      if (st.mode === 'deck') setTimeout(() => { const f = $('.t-paste') || $('[data-tune="close"]'); if (f) f.focus({ preventScroll: true }); }, 60);
      lastMode = st.mode;
    }
    place();
  }

  /* ---------- placement ----------
     The strip docks on top of whatever holds the bottom edge: the rest
     sheet's button, the session dock, or the tab bar. Two CSS variables
     tell the page how high it sits and how much room to leave. */

  let placeQueued = false;
  function place() {
    if (placeQueued) return;
    placeQueued = true;
    requestAnimationFrame(() => {
      placeQueued = false;
      const root = $('#tunes');
      const html = document.documentElement;
      let lift = 0;
      const sheet = $('#rest-sheet'), go = $('#rest-go');
      if (sheet && !sheet.hidden && go) lift = parseFloat(getComputedStyle(sheet).paddingBottom) + go.offsetHeight + 8;
      else {
        const dock = $('#view-session:not([hidden]) .dock'), tabbar = $('#tabbar');
        lift = Math.max(dock ? dock.offsetHeight : 0, tabbar ? tabbar.offsetHeight : 0);
      }
      let room = 0;
      if (root && !root.hidden) {
        if (st.mode === 'deck') {
          const frame = root.querySelector('.tunes-frame');
          room = st.queue.length && frame ? root.getBoundingClientRect().bottom - frame.getBoundingClientRect().top + 8 : 0;
        } else room = root.offsetHeight;
      }
      html.style.setProperty('--tunes-lift', lift + 'px');
      html.style.setProperty('--tunes-room', Math.round(room) + 'px');
      document.body.classList.toggle('tunes-docked', room > 0);
    });
  }
  // The app re-renders its dock and sheets freely; follow along.
  new MutationObserver(place).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  window.addEventListener('resize', place);

  function tick() {
    if (!player || !ready || !player.getCurrentTime) return;
    current = player.getCurrentTime() || 0;
    duration = player.getDuration() || 0;
    if (playing) st.pos = current;
    const t = $('#t-time');
    if (t && st.mode !== 'bar') t.textContent = status();
    const p = $('#t-prog');
    if (p) p.style.transform = 'scaleX(' + progress() + ')';
  }
  setInterval(tick, 1000);
  setInterval(() => { if (playing) save(); }, 5000);
  window.addEventListener('pagehide', () => { tick(); save(); });

  /* ---------- input ---------- */

  const ACTIONS = {
    play, pause,
    next() { next(false); },
    bar() { pause(); st.mode = 'bar'; render(); },
    deck() { st.mode = 'deck'; render(); },
    close() {
      st.mode = !st.queue.length ? 'off' : isOn() ? 'strip' : 'bar';
      render();
    },
    clear() {
      if (!confirm('Clear all ' + st.queue.length + ' videos from the queue?')) return;
      if (player && ready) player.stopVideo();
      st.queue = []; st.pos = 0; playing = wantPlay = false; duration = current = 0;
      save(); render();
    },
    remove(t) { remove(+t.dataset.k); },
    up(t) { moveUp(+t.dataset.k); },
    paste() {
      navigator.clipboard.readText()
        .then(text => add(text))
        .catch(() => { say('Long-press the box to paste'); const i = $('#t-link'); if (i) i.focus(); });
    }
  };

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tune]');
    if (!t) return;
    const fn = ACTIONS[t.dataset.tune];
    if (fn) fn(t);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && st.mode === 'deck') ACTIONS.close();
  });
  document.addEventListener('submit', e => {
    if (!e.target.matches('[data-tune-form]')) return;
    e.preventDefault();
    const input = $('#t-link');
    // add() re-renders the panel, so clear the fresh input, not the old one.
    if (input && add(input.value) && $('#t-link')) $('#t-link').value = '';
  });
  // Pasting into the box adds the link straight away.
  document.addEventListener('paste', e => {
    if (!e.target.matches || !e.target.matches('#t-link')) return;
    setTimeout(() => {
      const input = $('#t-link');
      if (input && parseLink(input.value) && add(input.value) && $('#t-link')) $('#t-link').value = '';
    }, 0);
  });

  // Shared from YouTube's Share menu (Android, with Iron Log installed): Android opens
  // the app with the shared text in the address (manifest.webmanifest share_target).
  function takeShared() {
    const q = new URLSearchParams(location.search);
    if (!q.has('text') && !q.has('url') && !q.has('title')) return;
    const shared = ['url', 'text', 'title'].map(k => q.get(k) || '').join(' ');
    // window.history: app.js defines its own history() for the training log.
    window.history.replaceState(null, '', location.pathname); // a reload must not add it again
    if (!parseLink(shared)) { say("That share didn't include a YouTube link"); return; }
    add(shared);
    st.mode = 'deck';
  }

  takeShared();
  // If a video is queued, get the player ready (paused) so play is instant.
  if (st.queue.length) ensurePlayer();
  render();

  window.Tunes = {
    open() { st.mode = 'deck'; render(); },
    duck,
    parseLink
  };
})();
