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

  /* ---------- Count-up numbers ---------- */
  function countUp(node) {
    var target = parseFloat(node.dataset.count);
    var decimals = (node.dataset.count.split('.')[1] || '').length;
    if (reduce) { node.textContent = target.toFixed(decimals); return; }
    var start = performance.now(), ms = 1200;
    (function tick(now) {
      var t = clamp((now - start) / ms, 0, 1);
      node.textContent = (target * (1 - Math.pow(1 - t, 3))).toFixed(decimals);
      if (t < 1) requestAnimationFrame(tick);
    })(start);
  }

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

  /* ---------- Reveal on scroll, and start charts when they come into view ---------- */
  var plays = new Map();
  document.querySelectorAll('svg[data-net]').forEach(function (svg) { plays.set(svg, drawNetwork(svg)); });

  var watched = document.querySelectorAll('[data-reveal], [data-viz], [data-count], svg[data-net]');
  function activate(node) {
    node.classList.add('in');
    if (node.hasAttribute('data-count')) countUp(node);
    if (plays.has(node)) plays.get(node)();
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        activate(entry.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
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
      });
    }, { threshold: 0.5 });
    screens.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- One scroll step moves one full section (large screens only) ---------- */
  var snapQuery = window.matchMedia('(min-width: 1024px) and (min-height: 660px)');
  if (root.classList.contains('home') && screens.length && !reduce) {
    var HEADER = 62, lockedUntil = 0, lastWheel = 0;
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
      lockedUntil = Date.now() + 700;
      window.scrollTo({ top: target, behavior: 'smooth' });
    };
    var fits = function () { return screens[currentIndex()].offsetHeight <= window.innerHeight - HEADER + 4; };
    window.addEventListener('wheel', function (e) {
      if (!snapQuery.matches || e.ctrlKey || !fits()) return;
      e.preventDefault();
      var now = Date.now(), quiet = now - lastWheel > 140;
      lastWheel = now;
      // Ignore the tail of a trackpad swipe; act once per gesture.
      if (now < lockedUntil || (!quiet && now < lockedUntil + 400)) return;
      if (Math.abs(e.deltaY) < 4) return;
      go(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    window.addEventListener('keydown', function (e) {
      if (!snapQuery.matches || !fits() || e.altKey || e.ctrlKey || e.metaKey) return;
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

  /* ---------- Headline: words arrive one after another ---------- */
  var headline = document.getElementById('headline');
  if (headline && !reduce) {
    var label = headline.textContent;
    headline.setAttribute('aria-label', label);
    headline.innerHTML = label.split(' ').map(function (w, i) {
      return '<span class="w" aria-hidden="true" style="animation-delay:' + (0.15 + i * 0.07).toFixed(2) + 's">' + w + '</span>';
    }).join(' ');
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
      if (k.trade.flag) { stats.flags++; stats.rules[Math.floor(Math.random() * 3)]++; }
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

  var visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(svg);
  }
  function tick() {
    if (visible && !document.hidden) {
      candles.push(nextCandle());
      candles.shift();
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
