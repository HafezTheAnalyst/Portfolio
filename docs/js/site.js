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

  /* ---------- Network illustration (made-up data) ---------- */
  function seeded(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }
  function drawNetwork(svg) {
    var mode = svg.dataset.net;
    var W = 400, H = 280;
    var rand = seeded(mode === 'group' ? 11 : 29);
    var nodes = [], hot = [], i, j;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.classList.add('net');

    if (mode === 'group') {
      // Traders on a ring; every pair is compared, a few pairs stand out.
      var n = 12;
      for (i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 - Math.PI / 2;
        nodes.push({ x: W / 2 + Math.cos(a) * 150, y: H / 2 + Math.sin(a) * 108 });
      }
      hot = [[0, 3, 91], [5, 8, 84], [9, 11, 77]];
    } else {
      // Accounts scattered; a few clusters turn out to be connected.
      var cols = 6, rows = 3;
      for (i = 0; i < cols * rows; i++) {
        nodes.push({
          x: 42 + (i % cols) * 63 + (rand() - 0.5) * 30,
          y: 52 + Math.floor(i / cols) * 86 + (rand() - 0.5) * 38
        });
      }
      hot = [[1, 7], [7, 8], [1, 8], [4, 10], [12, 13], [13, 14]];
    }

    var gEdges = el('g', {}), gHot = el('g', {}), gNodes = el('g', {}), gText = el('g', {});
    svg.appendChild(gEdges); svg.appendChild(gHot); svg.appendChild(gNodes); svg.appendChild(gText);

    var edges = [];
    if (mode === 'group') {
      for (i = 0; i < nodes.length; i++) for (j = i + 1; j < nodes.length; j++) {
        var e = el('line', { 'class': 'edge', x1: nodes[i].x, y1: nodes[i].y, x2: nodes[j].x, y2: nodes[j].y });
        gEdges.appendChild(e); edges.push(e);
      }
    }
    var flagged = {};
    var hotEls = hot.map(function (h) {
      var p = nodes[h[0]], q = nodes[h[1]];
      var len = Math.hypot(q.x - p.x, q.y - p.y);
      var line = el('line', { 'class': 'hot', x1: p.x, y1: p.y, x2: q.x, y2: q.y });
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      gHot.appendChild(line);
      flagged[h[0]] = flagged[h[1]] = true;
      var label = null;
      if (h[2]) {
        label = el('text', { 'class': 'score', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + 4, 'text-anchor': 'middle' });
        label.textContent = h[2];
        gText.appendChild(label);
      }
      return { line: line, label: label };
    });
    var nodeEls = nodes.map(function (p, idx) {
      var c = el('circle', { 'class': 'node', cx: p.x, cy: p.y, r: mode === 'group' ? 8 : 7 });
      c.style.transitionDelay = (idx * 0.03).toFixed(2) + 's, 0s';
      gNodes.appendChild(c);
      return c;
    });

    function play() {
      var step = reduce ? 0 : 1;
      nodeEls.forEach(function (c) { c.classList.add('on'); });
      setTimeout(function () { edges.forEach(function (e) { e.classList.add('on'); }); }, 500 * step);
      hotEls.forEach(function (h, k) {
        setTimeout(function () {
          h.line.style.strokeDashoffset = 0;
          if (h.label) h.label.classList.add('on');
        }, (1100 + k * 320) * step);
      });
      setTimeout(function () {
        nodeEls.forEach(function (c, idx) { if (flagged[idx]) c.classList.add('flag'); });
      }, (1100 + hotEls.length * 320) * step);
    }
    return play;
  }

  /* ---------- Rotating network: traders as points on a slowly turning globe (made-up data) ---------- */
  function makeGlobe(canvas) {
    var ctx = canvas.getContext('2d');
    var COUNT = 16, pts = [], i;
    for (i = 0; i < COUNT; i++) {
      var yy = 1 - 2 * (i + 0.5) / COUNT, rr = Math.sqrt(1 - yy * yy), ang = i * 2.399963;
      pts.push([Math.cos(ang) * rr, yy, Math.sin(ang) * rr]);
    }
    var hot = [[1, 6, 91], [3, 11, 84], [8, 14, 77]];
    var rotY = 0.5, rotX = -0.28, dragging = false, lastX = 0, lastY = 0;
    var started = null, visible = false, w = 0, h = 0, raf = null;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function project(p) {
      var cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
      var x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy;
      var y = p[1] * cx - z * sx; z = p[1] * sx + z * cx;
      var s = 1 / (1 + z * 0.28), R = Math.min(w, h) * 0.4;
      return { x: w / 2 + x * R * s, y: h / 2 + y * R * s, z: z, s: s };
    }
    function draw(now) {
      raf = null;
      if (started === null) started = now;
      var t = reduce ? 99 : (now - started) / 1000;
      var cs = getComputedStyle(canvas);
      var cNode = cs.getPropertyValue('--blue').trim(), cAmber = cs.getPropertyValue('--amber').trim();
      var cDot = cs.getPropertyValue('--dot').trim(), cInk = cs.getPropertyValue('--amber-ink').trim(), cBg = cs.getPropertyValue('--paper').trim();
      var P = pts.map(project), a, b;
      ctx.clearRect(0, 0, w, h);

      // Every pair is compared: faint lines, fainter at the back.
      var fade = clamp((t - 0.4) / 0.8, 0, 1);
      ctx.lineWidth = 1; ctx.strokeStyle = cDot;
      for (a = 0; a < COUNT; a++) for (b = a + 1; b < COUNT; b++) {
        ctx.globalAlpha = fade * clamp(0.3 - (P[a].z + P[b].z) * 0.11, 0.04, 0.5);
        ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); ctx.stroke();
      }
      // The pairs that stand out.
      var flagged = {};
      hot.forEach(function (hp, k) {
        var prog = clamp((t - 1.2 - k * 0.45) / 0.7, 0, 1);
        if (prog <= 0) return;
        var p = P[hp[0]], q = P[hp[1]];
        ctx.globalAlpha = 1; ctx.strokeStyle = cAmber; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + (q.x - p.x) * prog, p.y + (q.y - p.y) * prog); ctx.stroke();
        if (prog >= 1) { flagged[hp[0]] = flagged[hp[1]] = true; hp.done = true; }
      });
      // Points, back to front.
      P.map(function (p, idx) { return { p: p, idx: idx }; }).sort(function (m, n) { return n.p.z - m.p.z; }).forEach(function (o) {
        var grow = clamp((t - o.idx * 0.04) / 0.4, 0, 1);
        ctx.globalAlpha = clamp(0.95 - o.p.z * 0.4, 0.35, 1);
        ctx.fillStyle = flagged[o.idx] ? cAmber : cNode;
        ctx.beginPath(); ctx.arc(o.p.x, o.p.y, (flagged[o.idx] ? 7.5 : 6) * o.p.s * grow, 0, Math.PI * 2); ctx.fill();
      });
      // Scores on the flagged pairs.
      ctx.globalAlpha = 1; ctx.font = '700 12px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      hot.forEach(function (hp) {
        if (!hp.done) return;
        var mx = (P[hp[0]].x + P[hp[1]].x) / 2, my = (P[hp[0]].y + P[hp[1]].y) / 2;
        ctx.lineWidth = 4; ctx.strokeStyle = cBg; ctx.strokeText(hp[2], mx, my);
        ctx.fillStyle = cInk; ctx.fillText(hp[2], mx, my);
      });

      if (!dragging && !reduce) rotY += 0.0032;
      if (visible && (!reduce || dragging)) schedule();
    }
    function schedule() { if (raf === null) raf = requestAnimationFrame(draw); }

    canvas.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId); schedule();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      rotY += (e.clientX - lastX) * 0.008;
      rotX = clamp(rotX + (e.clientY - lastY) * 0.008, -1.2, 1.2);
      lastX = e.clientX; lastY = e.clientY;
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
  document.querySelectorAll('canvas[data-globe]').forEach(makeGlobe);

  /* ---------- Reveal on scroll, and start charts when they come into view ---------- */
  var plays = new Map();
  document.querySelectorAll('svg[data-net]').forEach(function (svg) { plays.set(svg, drawNetwork(svg)); });

  var watched = document.querySelectorAll('[data-reveal], [data-viz], [data-roll], svg[data-net]');
  function activate(node) {
    node.classList.add('in');
    if (node.hasAttribute('data-roll') && !reduce) setTimeout(function () { playRoll(node); }, 350);
    if (plays.has(node)) plays.get(node)();
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
