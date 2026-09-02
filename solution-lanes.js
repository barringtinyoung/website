/* ============================================================================
   Solution lanes — one business problem in, three strands worked in parallel,
   one owned system out.

   The argument the drawing makes: people, process and technology are not three
   equal slices of a pie, they are three lanes worked at the same time from the
   same problem, and the work is not finished until all three arrive. A lane
   that never reaches the right-hand edge is a solution nobody runs.

       <div id="solution-lanes"></div>
       <script src="solution-lanes.js"></script>
       <script>renderSolutionLanes('#solution-lanes');</script>

   No D3. Nothing here reaches outside its container.

   Colour rule, deliberately strict: the lanes themselves are drawn in the
   page's line and muted tones only. Accent is reserved for the packets and for
   the outcome node once all three have landed — so colour reads as motion and
   completion, not as category. Giving each lane its own hue turns this into a
   chart and makes the eye sort vertically when the argument runs across.
   ============================================================================ */

(function (global) {
  'use strict';

  var C = {
    ink:    'var(--ink,    #10171A)',
    muted:  'var(--muted,  #5B6A67)',
    faint:  'var(--faint,  #7E8C89)',
    line:   'var(--line,   #E0DDD7)',
    line2:  'var(--line-2, #CFCBC3)',
    raised: 'var(--raised, #F1EFEB)',
    accent: 'var(--accent, #C4553A)'
  };
  var MONO = 'var(--mono, ui-monospace, Consolas, monospace)';

  /* ---------------------------------------------------------------------
     SPEC. Four words a cell, hard limit — the nine method steps directly
     above carry the detail, and this is here for the shape. Each cell is
     written as its own lines so nothing has to be wrapped at draw time.
     --------------------------------------------------------------------- */
  var PHASES = ['Research', 'Design', 'Develop', 'Implement'];

  var LANES = [
    { k: 'People', cells: [
        ['who owns', 'the number'],
        ['who decides,', 'what limit'],
        ['who operates', 'it'],
        ['who runs it', 'after'] ] },
    { k: 'Process', cells: [
        ['the decision', 'that moves'],
        ['what good', 'enough costs'],
        ['the exception', 'path'],
        ['what actually', 'changes'] ] },
    { k: 'Technology', cells: [
        ['data that', 'holds it'],
        ['the model', 'or rules'],
        ['prototype to', 'production'],
        ['monitoring', 'and retraining'] ] }
  ];

  var CAP_IN  = ['The business', 'problem'];
  var CAP_OUT = ['In production,', 'run by', 'your team'];

  /* Technology usually moves fastest and people slowest. That is worth
     admitting rather than animating all three at one speed, and it is why
     the outcome waits: the last lane sets the finish. */
  var DUR = { People: 7400, Process: 6200, Technology: 5000 };
  var HOLD = 2200;   /* outcome lit */
  var GAP  = 900;    /* dark before the next run */

  /* ---------------------------------------------------------------------
     GEOMETRY. One viewBox, scaled by CSS; every number below is in those
     units, so the diagram keeps its proportions at any width.
     --------------------------------------------------------------------- */
  var W = 1080, H = 300;
  var CAP_W = 116, CAP_H = 118;
  /* The lane name is a cell at the head of its own row, not a label floating in
     the gutter: the fan-out curves pass through that space, and a bare label
     sitting on top of them was the one place this read as cluttered. */
  var LX = 214, LABW = 108;
  var GX = LX + LABW, GW = 544, COL = GW / 4;
  var ROW = 62, GAP_ROW = 10;
  var GH = ROW * 3 + GAP_ROW * 2;
  var GY = Math.round((H - GH) / 2) + 8;   /* +8 leaves room for the headers */

  function laneY(i) { return GY + i * (ROW + GAP_ROW); }
  function laneMid(i) { return laneY(i) + ROW / 2; }

  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }
  /* SVG presentation attributes do not accept var(); style does. */
  function styled(node, css) {
    for (var k in css) if (css.hasOwnProperty(k)) node.style.setProperty(k, css[k]);
    return node;
  }
  function text(x, y, s, css, attrs) {
    var t = svgEl('text', attrs || {});
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.textContent = s;
    return styled(t, css);
  }

  function render(target, opts) {
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) return;
    opts = opts || {};
    host.innerHTML = '';

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      role: 'img',
      'aria-label': 'One business problem entering three parallel lanes — people, ' +
                    'process and technology — worked across research, design, develop and ' +
                    'implement, converging on a system in production run by your team.'
    });

    /* ---- phase headers ------------------------------------------------ */
    PHASES.forEach(function (p, c) {
      svg.appendChild(text(GX + c * COL + COL / 2, GY - 18, p.toUpperCase(),
        { fill: C.faint, 'font-family': MONO, 'font-size': '11px', 'letter-spacing': '.16em' },
        { 'text-anchor': 'middle' }));
    });

    /* ---- end caps ----------------------------------------------------- */
    function cap(x, lines) {
      var g = svgEl('g', {});
      var y = (H - CAP_H) / 2;
      var r = styled(svgEl('rect', { x: x, y: y, width: CAP_W, height: CAP_H, rx: 2 }),
                     { fill: 'none', stroke: C.line2, 'stroke-width': '1',
                       transition: 'stroke .35s ease, fill .35s ease' });
      g.appendChild(r);
      var t0 = y + CAP_H / 2 - (lines.length - 1) * 9;
      var ts = lines.map(function (s, i) {
        var t = text(x + CAP_W / 2, t0 + i * 18, s,
          { fill: C.muted, 'font-family': MONO, 'font-size': '13px',
            transition: 'fill .35s ease' },
          { 'text-anchor': 'middle' });
        g.appendChild(t); return t;
      });
      svg.appendChild(g);
      return { box: r, texts: ts };
    }
    cap(0, CAP_IN);
    var outCap = cap(W - CAP_W, CAP_OUT);

    /* ---- lanes -------------------------------------------------------- */
    var cellRects = [];   /* [lane][col] — filled as a packet passes over */

    LANES.forEach(function (lane, i) {
      var y = laneY(i);

      svg.appendChild(styled(svgEl('rect', { x: LX, y: y, width: LABW, height: ROW }),
        { fill: 'transparent', stroke: C.line, 'stroke-width': '1' }));
      svg.appendChild(text(LX + LABW / 2, laneMid(i) + 4, lane.k.toUpperCase(),
        { fill: C.faint, 'font-family': MONO, 'font-size': '11px', 'letter-spacing': '.12em' },
        { 'text-anchor': 'middle' }));

      cellRects[i] = [];
      lane.cells.forEach(function (linesIn, c) {
        var x = GX + c * COL;
        var r = styled(svgEl('rect', { x: x, y: y, width: COL, height: ROW }),
                       { fill: 'transparent', stroke: C.line, 'stroke-width': '1',
                         transition: 'fill .35s ease' });
        svg.appendChild(r);
        cellRects[i][c] = r;

        var t0 = y + ROW / 2 - (linesIn.length - 1) * 8;
        linesIn.forEach(function (s, k) {
          svg.appendChild(text(x + COL / 2, t0 + k * 16 + 4, s,
            { fill: C.muted, 'font-family': MONO, 'font-size': '12px' },
            { 'text-anchor': 'middle' }));
        });
      });
    });

    /* ---- the three routes --------------------------------------------- */
    /* One path per lane: fan out of the problem cap, straight across its own
       lane, converge into the outcome cap. Packets ride these with
       getPointAtLength, so each curve is defined once and never recomputed. */
    var routes = LANES.map(function (lane, i) {
      var x0 = CAP_W, x1 = LX, x2 = GX + GW, x3 = W - CAP_W;
      var my = H / 2, ly = laneMid(i);
      var d = 'M' + x0 + ',' + my +
              'C' + (x0 + 52) + ',' + my + ' ' + (x1 - 52) + ',' + ly + ' ' + x1 + ',' + ly +
              'L' + x2 + ',' + ly +
              'C' + (x2 + 52) + ',' + ly + ' ' + (x3 - 52) + ',' + my + ' ' + x3 + ',' + my;
      var p = styled(svgEl('path', { d: d }),
                     { fill: 'none', stroke: C.line2, 'stroke-width': '1' });
      svg.appendChild(p);
      return { path: p, dur: DUR[lane.k], len: 0 };
    });

    var packets = routes.map(function () {
      var c = styled(svgEl('circle', { r: 5 }), { fill: C.accent });
      svg.appendChild(c);
      return c;
    });

    host.appendChild(svg);

    /* Path length is only measurable once the node is in the document. */
    routes.forEach(function (r) {
      r.len = r.path.getTotalLength ? r.path.getTotalLength() : 0;
    });

    /* ---- narrow screens ------------------------------------------------
       A four-column lane diagram cannot reflow into lanes, and a horizontal
       scroller on a phone is worse than no diagram. Below the breakpoint CSS
       hides the svg and shows this instead — same twelve cells, same source,
       so the two cannot drift. ------------------------------------------- */
    function capLine(cls, s) {
      var d = document.createElement('div');
      d.className = 'll-cap ' + cls;
      d.textContent = s;
      return d;
    }

    var list = document.createElement('div');
    list.className = 'lanes-list';
    list.appendChild(capLine('ll-in', CAP_IN.join(' ')));
    LANES.forEach(function (lane) {
      var d = document.createElement('div'); d.className = 'll-lane';
      var n = document.createElement('span'); n.className = 'n'; n.textContent = lane.k;
      d.appendChild(n);
      var ol = document.createElement('ol');
      lane.cells.forEach(function (linesIn, c) {
        var li = document.createElement('li');
        var em = document.createElement('em');
        em.textContent = PHASES[c];
        li.appendChild(em);
        li.appendChild(document.createTextNode(' ' + linesIn.join(' ')));
        ol.appendChild(li);
      });
      d.appendChild(ol); list.appendChild(d);
    });
    list.appendChild(capLine('ll-out', CAP_OUT.join(' ')));
    host.appendChild(list);

    /* ---- motion -------------------------------------------------------- */
    function place(i, t) {                       /* t in 0..1 along the route */
      var r = routes[i];
      if (!r.len) return;
      var pt = r.path.getPointAtLength(r.len * t);
      packets[i].setAttribute('cx', pt.x);
      packets[i].setAttribute('cy', pt.y);
      /* Light the cell the packet is currently over, and only that one. */
      var col = Math.floor((pt.x - GX) / COL);
      var inside = pt.x >= GX && pt.x <= GX + GW;
      cellRects[i].forEach(function (rect, c) {
        rect.style.fill = (inside && c === col) ? C.raised : 'transparent';
      });
    }

    function lightOutcome(on) {
      outCap.box.style.stroke = on ? C.accent : C.line2;
      outCap.box.style.fill = on
        ? 'color-mix(in srgb, ' + C.accent + ' 8%, transparent)'
        : 'none';
      outCap.texts.forEach(function (t) { t.style.fill = on ? C.accent : C.muted; });
    }

    var reduced = global.matchMedia &&
                  global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || opts.still) {
      routes.forEach(function (r, i) { place(i, 1); });
      cellRects.forEach(function (row) {
        row.forEach(function (rect) { rect.style.fill = 'transparent'; });
      });
      lightOutcome(true);
      return;
    }

    var slowest = Math.max(DUR.People, DUR.Process, DUR.Technology);
    var t0 = null;
    function frame(now) {
      if (t0 === null) t0 = now;
      var e = now - t0;
      routes.forEach(function (r, i) { place(i, Math.min(1, e / r.dur)); });
      lightOutcome(e >= slowest);
      if (e >= slowest + HOLD + GAP) { t0 = now; lightOutcome(false); }
      global.requestAnimationFrame(frame);
    }
    global.requestAnimationFrame(frame);
  }

  global.renderSolutionLanes = render;
})(window);
