(function () {
  'use strict';

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

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

  /* ---------- Hero scatter plot: noise settles into a trend, outliers get flagged ---------- */
  var svg = document.getElementById('plot');
  if (!svg) return;

  var NS = 'http://www.w3.org/2000/svg';
  var W = 560, H = 400;
  var M = { l: 44, r: 16, t: 14, b: 40 };
  var PW = W - M.l - M.r, PH = H - M.t - M.b;
  var N = 140;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var tip = document.getElementById('tip');
  var outN = document.getElementById('r-n');
  var outFit = document.getElementById('r-fit');
  var outFlag = document.getElementById('r-flag');
  var timers = [];

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }
  function gauss() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function later(fn, ms) { timers.push(setTimeout(fn, reduce ? 0 : ms)); }

  function makeData() {
    var slope = 0.55 + Math.random() * 0.2;
    var base = 0.12 + Math.random() * 0.08;
    var pts = [];
    for (var i = 0; i < N; i++) {
      var x = 0.04 + Math.random() * 0.92;
      var y = base + slope * x + gauss() * 0.055;
      pts.push({ x: x, y: y });
    }
    // A handful of accounts that do not behave like the rest.
    var k = 5 + Math.floor(Math.random() * 4);
    for (var j = 0; j < k; j++) {
      var p = pts[Math.floor(Math.random() * N)];
      var dir = p.x > 0.5 ? -1 : 1;
      if (Math.random() < 0.3) dir = -dir;
      p.y += dir * (0.24 + Math.random() * 0.16);
    }
    pts.forEach(function (p, idx) {
      p.y = clamp(p.y, 0.03, 0.97);
      p.id = 'AC-' + String(1000 + Math.floor(Math.random() * 9000));
      p.i = idx;
    });
    return pts;
  }

  function analyse(pts) {
    // Fit, drop anything beyond 2.5 sigma, then fit again on the rest.
    function fit(list) {
      var n = list.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
      list.forEach(function (p) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; });
      var b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      var a = (sy - b * sx) / n;
      var ss = 0, st = 0, my = sy / n;
      list.forEach(function (p) { var r = p.y - (a + b * p.x); ss += r * r; st += (p.y - my) * (p.y - my); });
      return { a: a, b: b, sd: Math.sqrt(ss / (n - 2)), r2: 1 - ss / st };
    }
    var f = fit(pts);
    for (var pass = 0; pass < 2; pass++) {
      var keep = pts.filter(function (p) { return Math.abs(p.y - (f.a + f.b * p.x)) <= 2.5 * f.sd; });
      f = fit(keep);
    }
    var flagged = 0;
    pts.forEach(function (p) {
      p.z = (p.y - (f.a + f.b * p.x)) / f.sd;
      p.out = Math.abs(p.z) > 3;
      if (p.out) flagged++;
    });
    f.flagged = flagged;
    return f;
  }

  function sx(v) { return M.l + v * PW; }
  function sy(v) { return M.t + (1 - v) * PH; }

  function countTo(node, target, decimals, ms) {
    if (reduce) { node.textContent = target.toFixed(decimals); return; }
    var start = performance.now();
    (function tick(now) {
      var t = clamp((now - start) / ms, 0, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      node.textContent = (target * eased).toFixed(decimals);
      if (t < 1) requestAnimationFrame(tick);
    })(start);
  }

  function showTip(p, node) {
    var frame = svg.getBoundingClientRect();
    var scale = frame.width / W;
    tip.innerHTML = '<b>' + p.id + '</b> ' + (p.out
      ? 'is ' + Math.abs(p.z).toFixed(1) + ' standard deviations off the trend'
      : 'follows the trend');
    tip.style.left = clamp(sx(p.x) * scale, 90, frame.width - 90) + 'px';
    tip.style.top = sy(p.y) * scale + 'px';
    tip.hidden = false;
  }
  function hideTip() { tip.hidden = true; }

  function run() {
    timers.forEach(clearTimeout);
    timers = [];
    hideTip();
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var pts = makeData();
    var f = analyse(pts);

    // Grid and axes
    var grid = el('g', { 'class': 'grid' });
    for (var g = 1; g <= 4; g++) {
      grid.appendChild(el('line', { x1: M.l, x2: W - M.r, y1: sy(g / 5), y2: sy(g / 5) }));
      grid.appendChild(el('line', { y1: M.t, y2: H - M.b, x1: sx(g / 5), x2: sx(g / 5) }));
    }
    svg.appendChild(grid);
    svg.appendChild(el('line', { 'class': 'axis', x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }));
    svg.appendChild(el('line', { 'class': 'axis', x1: M.l, x2: M.l, y1: M.t, y2: H - M.b }));
    var xl = el('text', { 'class': 'axis-label', x: W - M.r, y: H - 12, 'text-anchor': 'end' });
    xl.textContent = 'Trading activity';
    var yl = el('text', { 'class': 'axis-label', x: 14, y: M.t, 'text-anchor': 'end', transform: 'rotate(-90 14 ' + M.t + ')' });
    yl.textContent = 'Result';
    svg.appendChild(xl);
    svg.appendChild(yl);

    // Trend line (kept inside the plot area)
    var x0 = 0, x1 = 1;
    var trend = el('line', { 'class': 'trend', x1: sx(x0), y1: sy(clamp(f.a + f.b * x0, 0, 1)), x2: sx(x1), y2: sy(clamp(f.a + f.b * x1, 0, 1)) });
    svg.appendChild(trend);

    var rings = el('g', {});
    var dots = el('g', {});
    svg.appendChild(rings);
    svg.appendChild(dots);

    pts.forEach(function (p) {
      var c = el('circle', { 'class': 'pt', cx: sx(p.x), cy: sy(p.y), r: 4.2, tabindex: p.out ? 0 : -1 });
      // Start scattered at random, then settle into the real position.
      var dx = M.l + Math.random() * PW - sx(p.x);
      var dy = M.t + Math.random() * PH - sy(p.y);
      if (!reduce) c.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      c.style.transitionDelay = (Math.random() * 0.35).toFixed(2) + 's, 0s';
      c.addEventListener('mouseenter', function () { showTip(p, c); });
      c.addEventListener('focus', function () { showTip(p, c); });
      c.addEventListener('mouseleave', hideTip);
      c.addEventListener('blur', hideTip);
      p.node = c;
      dots.appendChild(c);
      if (p.out) {
        p.ring = el('circle', { 'class': 'ring', cx: sx(p.x), cy: sy(p.y), r: 11 });
        rings.appendChild(p.ring);
      }
    });

    outN.textContent = '0';
    outFit.textContent = '0.00';
    outFlag.textContent = '0';

    // The sequence: settle, fit, flag.
    later(function () {
      pts.forEach(function (p) { p.node.style.transform = 'translate(0px,0px)'; p.node.classList.add('settled'); });
      countTo(outN, N, 0, 900);
    }, 350);
    later(function () {
      trend.classList.add('on');
      countTo(outFit, f.r2, 2, 800);
    }, 1750);
    later(function () {
      var order = pts.filter(function (p) { return p.out; });
      order.forEach(function (p, i) {
        later(function () {
          p.node.classList.add('out');
          p.ring.classList.add('on');
          outFlag.textContent = String(i + 1);
        }, i * 140);
      });
      if (!order.length) outFlag.textContent = '0';
    }, 2750);
  }

  document.getElementById('rerun').addEventListener('click', run);
  run();
})();
