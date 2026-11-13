(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Light and dark theme ---------- */
  var themeBtn = document.getElementById('theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      themeBtn.setAttribute('aria-pressed', String(next === 'dark'));
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
    });
    themeBtn.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  }

  /* ---------- Scroll progress line ---------- */
  var bar = document.querySelector('.progress');
  if (bar) {
    var ticking = false;
    var update = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? clamp(window.scrollY / max, 0, 1) : 0) + ')';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- Rolling numbers: each digit rolls up to its value ---------- */
  var ROLL_H = 1;
  function setupRoll(node) {
    var text = node.textContent, n = 0;
    var html = '<span class="sr">' + text + '</span>';
    text.split(/(\d)/).forEach(function (part) {
      if (part === '') return;
      if (/\d/.test(part)) {
        html += '<span class="rollpart" aria-hidden="true"><span data-d="' + part + '" style="--rd:' + (n++ * 0.12).toFixed(2) + 's"><i>0</i><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i><i>6</i><i>7</i><i>8</i><i>9</i></span></span>';
      } else {
        html += '<span class="rollpart" aria-hidden="true">' + part + '</span>';
      }
    });
    node.innerHTML = html;
    node.setAttribute('data-roll', '');
    node.rollText = text;
    if (reduce) playRoll(node);
  }
  function playRoll(node) {
    node.querySelectorAll('[data-d]').forEach(function (reel) {
      reel.style.transform = 'translateY(-' + (parseInt(reel.dataset.d, 10) * ROLL_H).toFixed(2) + 'em)';
    });
    // Once the digits have settled, go back to plain text so the spacing is natural.
    setTimeout(function () { node.textContent = node.rollText; }, reduce ? 0 : 2200);
  }
  document.querySelectorAll('.results [data-count], .outcome strong, .bigresult, .minor strong').forEach(setupRoll);

  /* ---------- 3D illustrations on canvas (all made-up data) ----------
     make3d() handles sizing, turning, dragging and colours; each scene only draws. */
  function seeded(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }

  function make3d(canvas, scene) {
    var ctx = canvas.getContext('2d');
    var st = { w: 0, h: 0, rotY: scene.rotY, rotX: scene.rotX, dragY: 0 };
    var dragging = false, lastX = 0, lastY = 0, started = null, visible = false, raf = null;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      st.w = canvas.clientWidth; st.h = canvas.clientHeight;
      canvas.width = Math.round(st.w * dpr); canvas.height = Math.round(st.h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // Turn a point around the vertical axis, then tilt it, then apply perspective.
    st.project = function (p) {
      var cy = Math.cos(st.rotY), sy = Math.sin(st.rotY), cx = Math.cos(st.rotX), sx = Math.sin(st.rotX);
      var x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy;
      var y = p[1] * cx - z * sx; z = p[1] * sx + z * cx;
      var s = 1 / (1 + z * 0.26), R = Math.min(st.w, st.h * (scene.aspect || 1)) * scene.scale;
      return { x: st.w * (scene.centerX || 0.5) + x * R * s, y: st.h * (scene.centerY || 0.5) + y * R * s, z: z, s: s };
    };
    function draw(now) {
      raf = null;
      if (started === null) started = now;
      var t = reduce ? scene.still : (now - started) / 1000;
      var cs = getComputedStyle(canvas);
      var c = {
        node: cs.getPropertyValue('--blue').trim(), amber: cs.getPropertyValue('--amber').trim(),
        dot: cs.getPropertyValue('--dot').trim(), amberInk: cs.getPropertyValue('--amber-ink').trim(),
        ink: cs.getPropertyValue('--ink').trim(), muted: cs.getPropertyValue('--muted').trim(),
        rule: cs.getPropertyValue('--rule').trim(), tint: cs.getPropertyValue('--tint').trim(),
        bg: getComputedStyle(canvas.parentNode).backgroundColor
      };
      if (scene.sway) st.rotY = scene.rotY + st.dragY + (reduce ? 0 : Math.sin(t * 0.5) * scene.sway);
      ctx.clearRect(0, 0, st.w, st.h);
      ctx.globalAlpha = 1;
      scene.draw(ctx, st, t, c);
      if (!scene.sway && !dragging && !reduce) st.rotY += 0.0032;
      if (visible && (!reduce || dragging)) schedule();
    }
    function schedule() { if (raf === null) raf = requestAnimationFrame(draw); }

    canvas.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId); schedule();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = (e.clientX - lastX) * 0.008;
      if (scene.sway) st.dragY = clamp(st.dragY + dx, -1.1, 1.1); else st.rotY += dx;
      st.rotX = clamp(st.rotX + (e.clientY - lastY) * 0.008, scene.minX, scene.maxX);
      lastX = e.clientX; lastY = e.clientY;
      schedule();
    });
    var release = function () { dragging = false; };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    window.addEventListener('resize', function () { resize(); schedule(); });
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#theme')) schedule(); });

    resize();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) { resize(); schedule(); }
      }, { threshold: 0.15 }).observe(canvas);
    } else { visible = true; schedule(); }
  }

  function line(ctx, a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  function dot(ctx, p, r) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); }

  /* Group trading: traders as points on a slowly turning globe; a few pairs stand out. */
  function globeScene() {
    var COUNT = 16, pts = [], i;
    for (i = 0; i < COUNT; i++) {
      var yy = 1 - 2 * (i + 0.5) / COUNT, rr = Math.sqrt(1 - yy * yy), ang = i * 2.399963;
      pts.push([Math.cos(ang) * rr, yy, Math.sin(ang) * rr]);
    }
    var hot = [[1, 6, 91], [3, 11, 84], [8, 14, 77]];
    return {
      rotY: 0.5, rotX: -0.28, minX: -1.2, maxX: 1.2, scale: 0.4, still: 99,
      draw: function (ctx, st, t, c) {
        var P = pts.map(st.project), a, b;
        var fade = clamp((t - 0.4) / 0.8, 0, 1);
        ctx.lineWidth = 1; ctx.strokeStyle = c.dot;
        for (a = 0; a < COUNT; a++) for (b = a + 1; b < COUNT; b++) {
          ctx.globalAlpha = fade * clamp(0.3 - (P[a].z + P[b].z) * 0.11, 0.04, 0.5);
          line(ctx, P[a], P[b]);
        }
        var flagged = {}, done = [];
        hot.forEach(function (hp, k) {
          var prog = clamp((t - 1.2 - k * 0.45) / 0.7, 0, 1);
          if (prog <= 0) return;
          var p = P[hp[0]], q = P[hp[1]];
          ctx.globalAlpha = 1; ctx.strokeStyle = c.amber; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
          line(ctx, p, { x: p.x + (q.x - p.x) * prog, y: p.y + (q.y - p.y) * prog });
          if (prog >= 1) { flagged[hp[0]] = flagged[hp[1]] = true; done.push(hp); }
        });
        P.map(function (p, idx) { return { p: p, idx: idx }; }).sort(function (m, n) { return n.p.z - m.p.z; }).forEach(function (o) {
          var grow = clamp((t - o.idx * 0.04) / 0.4, 0, 1);
          ctx.globalAlpha = clamp(0.95 - o.p.z * 0.4, 0.35, 1);
          ctx.fillStyle = flagged[o.idx] ? c.amber : c.node;
          dot(ctx, o.p, (flagged[o.idx] ? 7.5 : 6) * o.p.s * grow);
        });
        ctx.globalAlpha = 1; ctx.font = '700 12px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        done.forEach(function (hp) {
          var mx = (P[hp[0]].x + P[hp[1]].x) / 2, my = (P[hp[0]].y + P[hp[1]].y) / 2;
          ctx.lineWidth = 4; ctx.strokeStyle = c.bg; ctx.strokeText(hp[2], mx, my);
          ctx.fillStyle = c.amberInk; ctx.fillText(hp[2], mx, my);
        });
      }
    };
  }

  /* Linked accounts: accounts on an upper layer; lines drop to a lower layer,
     and the accounts that land on the same point below turn out to be linked. */
  function layersScene() {
    var rand = seeded(29), TOP = -0.42, LOW = 0.52, HALF = 0.95;
    var accounts = [], i;
    for (i = 0; i < 16; i++) {
      accounts.push({
        x: -0.68 + (i % 4) * 0.45 + (rand() - 0.5) * 0.2,
        z: -0.68 + Math.floor(i / 4) * 0.45 + (rand() - 0.5) * 0.2,
        group: -1
      });
    }
    var groups = [[1, 5, 6], [3, 7], [8, 9, 13]];
    var hubs = groups.map(function (g, k) {
      var hx = 0, hz = 0;
      g.forEach(function (idx) { accounts[idx].group = k; hx += accounts[idx].x; hz += accounts[idx].z; });
      return { x: hx / g.length, z: hz / g.length };
    });
    function plane(ctx, st, y, c, alpha) {
      var q = [[-HALF, y, -HALF], [HALF, y, -HALF], [HALF, y, HALF], [-HALF, y, HALF]].map(st.project);
      ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y);
      for (var k = 1; k < 4; k++) ctx.lineTo(q[k].x, q[k].y);
      ctx.closePath();
      ctx.globalAlpha = alpha; ctx.fillStyle = c.tint; ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = c.rule; ctx.lineWidth = 1.2; ctx.stroke();
    }
    return {
      rotY: 0.6, rotX: -0.5, minX: -1.1, maxX: -0.12, scale: 0.43, still: 99, centerY: 0.5,
      draw: function (ctx, st, t, c) {
        plane(ctx, st, LOW, c, 0.75);
        // Lines dropping from each account.
        accounts.forEach(function (a, idx) {
          var drop = clamp((t - 0.7 - idx * 0.04) / 0.7, 0, 1);
          if (drop <= 0) return;
          var top = st.project([a.x, TOP, a.z]);
          var linked = a.group >= 0, lit = linked && t > 2.0 + a.group * 0.5;
          var end = linked ? hubs[a.group] : a;
          var low = st.project([a.x + (end.x - a.x) * drop, TOP + (LOW - TOP) * drop, a.z + (end.z - a.z) * drop]);
          ctx.globalAlpha = lit ? 1 : 0.55;
          ctx.strokeStyle = lit ? c.amber : c.dot; ctx.lineWidth = lit ? 2.4 : 1.1; ctx.lineCap = 'round';
          line(ctx, top, low);
          if (!linked && drop >= 1) { ctx.fillStyle = c.dot; ctx.globalAlpha = 0.8; dot(ctx, low, 2.6 * low.s); }
        });
        // Shared points on the lower layer.
        hubs.forEach(function (hb, k) {
          var on = clamp((t - 2.0 - k * 0.5) / 0.35, 0, 1);
          if (on <= 0) return;
          var p = st.project([hb.x, LOW, hb.z]);
          ctx.globalAlpha = 0.25 * on; ctx.fillStyle = c.amber; dot(ctx, p, 15 * p.s * on);
          ctx.globalAlpha = 1; dot(ctx, p, 6.5 * p.s * on);
        });
        plane(ctx, st, TOP, c, 0.45);
        // Accounts on the upper layer.
        accounts.map(function (a, idx) { return { a: a, idx: idx, p: st.project([a.x, TOP, a.z]) }; })
          .sort(function (m, n) { return n.p.z - m.p.z; }).forEach(function (o) {
            var grow = clamp((t - o.idx * 0.035) / 0.4, 0, 1);
            var lit = o.a.group >= 0 && t > 2.0 + o.a.group * 0.5;
            ctx.globalAlpha = 1; ctx.fillStyle = lit ? c.amber : c.node;
            dot(ctx, o.p, (lit ? 7.5 : 6) * o.p.s * grow);
          });
      }
    };
  }

  var SCENES = { globe: globeScene, layers: layersScene };
  document.querySelectorAll('canvas[data-scene]').forEach(function (canvas) {
    var build = SCENES[canvas.dataset.scene];
    if (build) make3d(canvas, build());
  });

  /* ---------- The race: manual review against automated review of the same account ---------- */
  document.querySelectorAll('[data-race]').forEach(function (root) {
    var manual = root.querySelector('.lane.manual'), auto = root.querySelector('.lane.auto');
    var result = root.querySelector('.race-result');
    var MARGIN = 5, timers = [], run = 0, visible = false, playing = false;
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function fmt(sec) { var m = Math.floor(sec / 60), s = Math.floor(sec % 60); return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
    function items(lane) { return lane.querySelectorAll('.checks li'); }
    function setLane(lane, seconds, part) {
      lane.querySelector('.clock').textContent = fmt(seconds);
      lane.querySelector('.lane-bar i').style.transform = 'scaleX(' + part + ')';
    }
    function reset() {
      timers.forEach(clearTimeout); timers = []; run++;
      [manual, auto].forEach(function (lane) {
        lane.classList.remove('done');
        items(lane).forEach(function (li) { li.className = ''; });
        setLane(lane, 0, 0);
      });
      result.classList.remove('show');
    }
    // Run one lane: each rule is checked in turn while the clock counts up to `seconds`.
    function runLane(lane, seconds, ms, marginState) {
      var mine = run, start = performance.now(), list = items(lane), step = ms / list.length;
      list.forEach(function (li, i) {
        at(i * step, function () { li.className = 'checking'; });
        at((i + 1) * step, function () { li.className = i === MARGIN ? marginState : 'ok'; });
      });
      (function tick(now) {
        if (mine !== run) return;
        var part = clamp((now - start) / ms, 0, 1);
        setLane(lane, seconds * part, part);
        if (part < 1) requestAnimationFrame(tick); else lane.classList.add('done');
      })(start);
    }
    function showEnd() {
      items(manual)[MARGIN].className = 'missed';
      result.classList.add('show');
    }
    function play() {
      playing = true;
      reset();
      at(500, function () {
        runLane(auto, 120, 600, 'flag');      // about 2 minutes
        runLane(manual, 1200, 6000, 'ok');    // about 20 minutes, and the margin breach goes through
      });
      at(7100, showEnd);
      at(11500, function () { playing = false; if (visible) play(); });
    }
    function still() {
      [[manual, 1200, 'missed'], [auto, 120, 'flag']].forEach(function (cfg) {
        items(cfg[0]).forEach(function (li, i) { li.className = i === MARGIN ? cfg[2] : 'ok'; });
        setLane(cfg[0], cfg[1], 1);
        cfg[0].classList.add('done');
      });
      result.classList.add('show');
    }
    if (reduce || !('IntersectionObserver' in window)) { still(); return; }
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !playing) play();
    }, { threshold: 0.35 }).observe(root);
  });

  /* ---------- Reveal on scroll, and start charts when they come into view ---------- */
  var watched = document.querySelectorAll('[data-reveal], [data-roll]');
  function activate(node) {
    node.classList.add('in');
    if (node.hasAttribute('data-roll') && !reduce) setTimeout(function () { playRoll(node); }, 350);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        activate(entry.target);
      });
    }, { threshold: 0.08 });
    watched.forEach(function (node) { io.observe(node); });
  } else {
    watched.forEach(activate);
  }

  /* ---------- Project screenshot switcher ---------- */
  document.querySelectorAll('[data-viewer]').forEach(function (viewer) {
    var img = viewer.querySelector('.stage img');
    var buttons = viewer.querySelectorAll('.tabs button');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('aria-pressed') === 'true') return;
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        btn.setAttribute('aria-pressed', 'true');
        img.classList.add('swap');
        var next = new Image();
        next.onload = next.onerror = function () {
          img.src = btn.dataset.src;
          img.alt = btn.dataset.alt;
          img.classList.remove('swap');
        };
        next.src = btn.dataset.src;
      });
    });
  });

  /* ---------- Section dots on the home page ---------- */
  var dots = document.querySelector('.dots');
  var screens = document.querySelectorAll('.screen[id]');
  if (dots && screens.length && 'IntersectionObserver' in window) {
    var links = {};
    screens.forEach(function (s) {
      var a = document.createElement('a');
      a.href = '#' + s.id;
      a.title = s.dataset.label || s.id;
      a.setAttribute('aria-label', a.title);
      dots.appendChild(a);
      links[s.id] = a;
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        for (var k in links) links[k].classList.toggle('on', k === entry.target.id);
        screens.forEach(function (s) { s.classList.toggle('active', s === entry.target); });
      });
    }, { threshold: 0.5 });
    screens.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- Full-screen mode: one scroll step moves one full section ---------- */
  if (root.classList.contains('home') && screens.length) {
    var HEADER = 62, PAD = 40, MIN_ZOOM = 0.7, lockedUntil = 0, lastWheel = 0;
    screens[0].classList.add('active');

    // Turn the mode on when the window is big enough, and shrink any section that is
    // slightly too tall so it still fits on one screen.
    var fit = function () {
      var on = window.innerWidth >= 1024 && window.innerHeight >= 480;
      var shells = Array.prototype.map.call(screens, function (s) { return s.firstElementChild; });
      shells.forEach(function (sh) { sh.style.zoom = ''; });
      root.classList.toggle('snap', on);
      if (!on) return;
      var avail = window.innerHeight - HEADER - PAD;
      var zooms = shells.map(function (sh) { return Math.min(1, avail / sh.offsetHeight); });
      if (Math.min.apply(null, zooms) < MIN_ZOOM) { root.classList.remove('snap'); return; }
      shells.forEach(function (sh, i) { if (zooms[i] < 1) sh.style.zoom = zooms[i].toFixed(3); });
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('load', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

    var snapping = function () { return root.classList.contains('snap'); };
    var tops = function () { return Array.prototype.map.call(screens, function (s) { return s.offsetTop - HEADER; }); };
    var currentIndex = function () {
      var t = tops(), best = 0;
      for (var i = 0; i < t.length; i++) if (Math.abs(t[i] - window.scrollY) < Math.abs(t[best] - window.scrollY)) best = i;
      return best;
    };
    var go = function (dir) {
      var t = tops(), i = currentIndex(), maxY = document.documentElement.scrollHeight - window.innerHeight;
      var atFooter = window.scrollY > t[t.length - 1] + 8;
      var target;
      if (dir > 0) target = (i === t.length - 1) ? maxY : t[i + 1];
      else target = atFooter ? t[t.length - 1] : t[Math.max(0, i - 1)];
      if (Math.abs(target - window.scrollY) < 2) return;
      lockedUntil = Date.now() + 750;
      window.scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
    };
    window.addEventListener('wheel', function (e) {
      if (!snapping() || e.ctrlKey) return;
      e.preventDefault();
      var now = Date.now(), quiet = now - lastWheel > 140;
      lastWheel = now;
      // Ignore the tail of a trackpad swipe; act once per gesture.
      if (now < lockedUntil || (!quiet && now < lockedUntil + 400)) return;
      if (Math.abs(e.deltaY) < 4) return;
      go(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    window.addEventListener('keydown', function (e) {
      if (!snapping() || e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      var dir = 0;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey && tag !== 'button' && tag !== 'a')) dir = 1;
      if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) dir = -1;
      if (!dir) return;
      e.preventDefault();
      if (Date.now() >= lockedUntil) go(dir);
    });
  }

  /* ---------- Headline: words arrive one after another; the last word starts covered ---------- */
  var headline = document.getElementById('headline');
  if (headline && !reduce) {
    var label = headline.textContent;
    var words = label.split(' ');
    headline.setAttribute('aria-label', label);
    headline.innerHTML = words.map(function (w, i) {
      var cls = i === words.length - 1 ? 'w redact' : 'w';
      return '<span class="' + cls + '" aria-hidden="true" style="animation-delay:' + (0.15 + i * 0.07).toFixed(2) + 's">' + w + '</span>';
    }).join(' ');
  }

  /* ---------- Role line: flips from one role to the next ---------- */
  var roles = document.getElementById('roles');
  if (roles && !reduce) {
    var roleList = ['Data analyst', 'Risk analyst', 'Trading operations'], roleAt = 0;
    var word = roles.querySelector('.roles-word');
    setInterval(function () {
      if (document.hidden) return;
      word.classList.add('out');
      setTimeout(function () {
        roleAt = (roleAt + 1) % roleList.length;
        word.textContent = roleList[roleAt];
        word.classList.remove('out');
        word.classList.add('pre');
        word.getBoundingClientRect();
        word.classList.remove('pre');
      }, 480);
    }, 2600);
  }

  /* ---------- Risk desk: a simulated price chart with trades, flags and live counters ---------- */
  var svg = document.getElementById('candles');
  if (!svg) return;

  var W = 560, H = 270, PADR = 44, TOP = 26, BOT = 26;
  var N = 40, STEP = (W - PADR) / N, BW = STEP * 0.62;
  var lo = 1.0740, hi = 1.0860;
  function py(p) { return TOP + (1 - (p - lo) / (hi - lo)) * (H - TOP - BOT); }

  var candles = [], price = 1.0790, serial = 0;
  var stats = { trades: 0, flags: 0, rules: [0, 0, 0] };

  function nextCandle() {
    var o = price;
    var c = o + (1.0800 - price) * 0.12 + (Math.random() - 0.5) * 0.0042;
    c = clamp(c, lo + 0.0022, hi - 0.0022);
    var k = {
      id: serial++, o: o, c: c,
      h: Math.max(o, c) + Math.random() * 0.0012,
      l: Math.min(o, c) - Math.random() * 0.0012,
      trade: null
    };
    price = c;
    if (Math.random() < 0.3) {
      k.trade = { buy: Math.random() < 0.5, flag: Math.random() < 0.3 };
      stats.trades += 1 + Math.floor(Math.random() * 6);
      if (k.trade.flag) { k.trade.rule = Math.floor(Math.random() * 3); stats.flags++; stats.rules[k.trade.rule]++; }
    }
    return k;
  }

  var gGrid = el('g', {}), gRoll = el('g', { 'class': 'roll' }), gCross = el('g', {});
  svg.appendChild(gGrid); svg.appendChild(gRoll); svg.appendChild(gCross);
  for (var g = 0; g < 5; g++) {
    var level = lo + (hi - lo) * (g + 0.5) / 5;
    gGrid.appendChild(el('line', { 'class': 'gridline', x1: 0, x2: W - PADR + 6, y1: py(level), y2: py(level) }));
    var txt = el('text', { 'class': 'price', x: W - 2, y: py(level) + 3, 'text-anchor': 'end' });
    txt.textContent = level.toFixed(4);
    gGrid.appendChild(txt);
  }

  function drawCandle(k, i, delay) {
    var x = i * STEP + STEP / 2;
    var body = el('g', { 'class': 'c ' + (k.c >= k.o ? 'up' : 'dn') });
    if (delay == null) body.style.animation = 'none'; else body.style.animationDelay = delay + 's';
    body.appendChild(el('line', { 'class': 'wick', x1: x, x2: x, y1: py(k.h), y2: py(k.l) }));
    body.appendChild(el('rect', { x: x - BW / 2, width: BW, y: py(Math.max(k.o, k.c)), height: Math.max(1.5, Math.abs(py(k.o) - py(k.c))), rx: 1.5 }));
    gRoll.appendChild(body);
    if (!k.trade) return;
    var my = k.trade.buy ? py(k.l) + 11 : py(k.h) - 11;
    var d = k.trade.buy ? 'M' + x + ',' + (my - 5) + ' l5,8 l-10,0z' : 'M' + x + ',' + (my + 5) + ' l5,-8 l-10,0z';
    var mark = el('path', { 'class': 'mark' + (k.trade.flag ? ' flag' : ''), d: d });
    if (delay != null && !reduce) {
      mark.style.opacity = 0;
      setTimeout(function () { mark.style.opacity = 1; }, delay * 1000 + 300);
    }
    gRoll.appendChild(mark);
    if (k.trade.flag) {
      var ring = el('circle', { 'class': 'ring', cx: x, cy: my, r: 10 });
      if (delay == null) ring.style.animation = 'none'; else ring.style.animationDelay = (delay + 0.35) + 's';
      gRoll.appendChild(ring);
    }
  }

  function render(firstLoad) {
    while (gRoll.firstChild) gRoll.removeChild(gRoll.firstChild);
    candles.forEach(function (k, i) {
      var delay = null;
      if (!reduce) delay = firstLoad ? i * 0.035 : (i === candles.length - 1 ? 0 : null);
      drawCandle(k, i, delay);
    });
  }

  function setText(id, v) { document.getElementById(id).textContent = v; }
  function showStats() {
    setText('k-trades', stats.trades);
    setText('k-flags', stats.flags);
    setText('k-rate', (stats.trades ? stats.flags / stats.trades * 100 : 0).toFixed(1) + '%');
    var max = Math.max(1, Math.max.apply(null, stats.rules));
    stats.rules.forEach(function (n, i) {
      setText('n' + i, n);
      document.getElementById('b' + i).style.transform = 'scaleX(' + (n / max) + ')';
    });
  }

  // First load: draw the history candle by candle, then go live.
  for (var i = 0; i < N; i++) candles.push(nextCandle());
  render(true);
  setTimeout(showStats, reduce ? 0 : 1500);

  // A small label floats above the desk each time a new flag is raised.
  var toast = document.getElementById('flagtoast'), toastTimer = null;
  var RULES = ['Risk per trade', 'Hedging', 'Copy trading'];
  function announce(rule) {
    if (!toast) return;
    toast.textContent = 'Flagged: ' + RULES[rule];
    toast.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('on'); }, 1900);
  }

  // The desk leans a few degrees toward the pointer.
  var desk = svg.closest('.desk'), stage = svg.closest('.screen') || document.body;
  if (desk && !reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    stage.addEventListener('mousemove', function (e) {
      var r = stage.getBoundingClientRect();
      desk.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 9).toFixed(2) + 'deg');
      desk.style.setProperty('--rx', (((e.clientY - r.top) / r.height - 0.5) * -7).toFixed(2) + 'deg');
    });
    stage.addEventListener('mouseleave', function () {
      desk.style.setProperty('--ry', '0deg');
      desk.style.setProperty('--rx', '0deg');
    });
  }

  var visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(svg);
  }
  function tick() {
    if (visible && !document.hidden) {
      var fresh = nextCandle();
      candles.push(fresh);
      candles.shift();
      if (fresh.trade && fresh.trade.flag) announce(fresh.trade.rule);
      // Put the row one step to the right without animation, then let it roll back into place.
      gRoll.style.transition = 'none';
      render(false);
      gRoll.style.transform = 'translateX(' + STEP + 'px)';
      gRoll.getBoundingClientRect();
      gRoll.style.transition = '';
      gRoll.style.transform = 'translateX(0)';
      showStats();
    }
    setTimeout(tick, 1300);
  }
  if (!reduce) setTimeout(tick, 2600);

  // Crosshair with open, high, low and close.
  var ohlc = document.getElementById('ohlc');
  function clearCross() { while (gCross.firstChild) gCross.removeChild(gCross.firstChild); }
  svg.addEventListener('mousemove', function (e) {
    var r = svg.getBoundingClientRect();
    var mx = (e.clientX - r.left) / r.width * W, my = (e.clientY - r.top) / r.height * H;
    var idx = clamp(Math.floor(mx / STEP), 0, N - 1), k = candles[idx];
    clearCross();
    gCross.appendChild(el('line', { 'class': 'cross', x1: idx * STEP + STEP / 2, x2: idx * STEP + STEP / 2, y1: TOP - 8, y2: H - BOT + 8 }));
    gCross.appendChild(el('line', { 'class': 'cross', x1: 0, x2: W - PADR + 6, y1: my, y2: my }));
    ohlc.innerHTML = 'O <b>' + k.o.toFixed(4) + '</b>H <b>' + k.h.toFixed(4) + '</b>L <b>' + k.l.toFixed(4) + '</b>C <b>' + k.c.toFixed(4) + '</b>';
  });
  svg.addEventListener('mouseleave', function () { clearCross(); ohlc.innerHTML = ''; });
})();
