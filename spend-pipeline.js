/* ============================================================================
   CXO Nexus — Spend Data Pipeline, drawn as a surgical theatre.

   A standalone D3 module. Nothing in here reaches outside its container, so it
   can be dropped into the capabilities page without touching the rest of the
   site's CSS or JS.

       <div id="spend-pipeline"></div>
       <script src="d3.v7.min.js"></script>
       <script src="spend-pipeline.js"></script>
       <script>renderSpendPipeline('#spend-pipeline');</script>

   TO REFINE: almost everything lives in the SPEC section below — LANES, ROOMS
   and LINKS. Change the numbers, reload spend-pipeline.html, look at it. The
   drawing code underneath is generic and should rarely need editing.

   Colours resolve from the host page's CSS custom properties where they exist
   and fall back to the light-theme values, so the diagram follows the site.
   ============================================================================ */

(function (global) {
  'use strict';

  /* =========================================================================
     PALETTE  — var() with a literal fallback, applied via .style() (SVG
     presentation *attributes* do not accept var(), style does).
     ========================================================================= */
  var C = {
    ink:     'var(--ink,     #10171A)',
    muted:   'var(--muted,   #5B6A67)',
    faint:   'var(--faint,   #7E8C89)',
    line:    'var(--line,    #E0DDD7)',
    line2:   'var(--line-2,  #CFCBC3)',
    ground:  'var(--ground,  #F7F6F3)',
    surface: 'var(--surface, #FFFFFF)',
    raised:  'var(--raised,  #F1EFEB)',
    accent:  'var(--accent,  #C4553A)',

    /* Stream colours. These are the diagram's own vocabulary — deliberately
       literal so the two data streams stay distinguishable in either theme. */
    raw:     '#8A7B6B',   /* unprocessed spend data, still in the sack */
    org:     '#2E7A6D',   /* organizations / suppliers */
    prod:    '#C4553A',   /* products */
    integ:   '#4A6FA5',   /* integrated record */
    classed: '#9A6B12'    /* classified spend */
  };

  var FONT_SANS = 'var(--sans, "Segoe UI", system-ui, sans-serif)';
  var FONT_MONO = 'var(--mono, ui-monospace, Consolas, monospace)';

  /* =========================================================================
     SPEC — the diagram itself. Edit freely.
     ========================================================================= */

  var W = 1240;
  var H;                      /* computed from content in layout() */

  var LANE_HEADER = 50;       /* room for the band's label + note */
  var LANE_PAD    = 22;       /* breathing room under the last card */
  var LANE_GAP    = 22;       /* between bands */

  /* Horizontal bands. `minH` reserves space for the hand-drawn rows (people,
     gurneys, porters) that are generated rather than declared as ROOMS. */
  var LANES = [
    { id: 'intake',   minH: 118, label: '01 · Intake',            note: 'contributors hand over spend data' },
    { id: 'receive',  minH: 168, label: '02 · Receiving',         note: 'sacks stacked onto gurneys' },
    { id: 'transit',  minH: 96,  label: '03 · Transport',         note: 'wheeled through by data operations' },
    { id: 'theatre',  label: '04 · Operating rooms',   note: 'one gurney, one room' },
    { id: 'split',    label: '05 · Dissection',        note: 'organizations and products, same patient id' },
    { id: 'suites',   label: '06 · Specialist suites', note: 'supplier and product, worked in parallel' },
    { id: 'immerse',  label: '07 · Immersion',         note: 'knowledge integration' },
    { id: 'classify', label: '08 · Classification',    note: 'the spend gets a name' },
    { id: 'recovery', label: '09 · Recovery',          note: 'integrated and classified, resting' },
    { id: 'review',   label: '10 · Review lab',        note: 'three independent checks' }
  ];

  /* Rooms / stations.
       kind: 'room'   — bordered card with a header strip
             'plain'  — bordered card, no header
             'chip'   — small pill
       glyph: optional decoration drawn inside (see GLYPHS)
       steps: body lines. A leading '7.3 ' style token is styled as a mono tag. */
  var ROOMS = [
    /* ---- 04 · operating rooms ------------------------------------------ */
    { id: 'or1', kind: 'room', lane: 'theatre', x: 60,  w: 350, glyph: 'theatre',
      title: 'Operating room 1', tag: 'OR-1',
      steps: ['6.1 Assign unique patient id',
              '6.2 Dissect into organizations + products',
              '6.3 Both halves inherit the patient id'] },
    { id: 'or2', kind: 'room', lane: 'theatre', x: 445, w: 350, glyph: 'theatre',
      title: 'Operating room 2', tag: 'OR-2',
      steps: ['6.1 Assign unique patient id',
              '6.2 Dissect into organizations + products',
              '6.3 Both halves inherit the patient id'] },
    { id: 'or3', kind: 'room', lane: 'theatre', x: 830, w: 350, glyph: 'theatre',
      title: 'Operating room 3', tag: 'OR-3',
      steps: ['6.1 Assign unique patient id',
              '6.2 Dissect into organizations + products',
              '6.3 Both halves inherit the patient id'] },

    /* ---- 05 · the split ------------------------------------------------- */
    { id: 'orgSplit',  kind: 'chip', lane: 'split', x: 210, w: 300, h: 42, accent: C.org,
      title: 'Organizations / suppliers', tag: 'id' },
    { id: 'prodSplit', kind: 'chip', lane: 'split', x: 730, w: 300, h: 42, accent: C.prod,
      title: 'Products', tag: 'id' },

    /* ---- 06 · specialist suites ----------------------------------------- */
    { id: 'supplier', kind: 'room', lane: 'suites', x: 60,  w: 500, glyph: 'specialist', accent: C.org,
      title: 'Supplier specialist', tag: '7',
      steps: ['7.1 Specialist scrubs in',
              '7.2 Pull in the organization catalogue',
              '7.3 Clean · normalize · enrich — parentage',
              '7.4 Teach the recognizer newly seen organizations',
              '7.5 Release to immersion & integration'] },
    { id: 'product',  kind: 'room', lane: 'suites', x: 680, w: 500, glyph: 'specialist', accent: C.prod,
      title: 'Product specialist', tag: '8',
      steps: ['8.1 Clean & normalize the product',
              '8.2 Identify the manufacturer from history',
              '8.3 Integrate the enriched organization by patient id'] },

    /* ---- 07 · immersion -------------------------------------------------- */
    { id: 'immersion', kind: 'room', lane: 'immerse', x: 330, w: 580, glyph: 'immersion', accent: C.integ,
      title: 'Knowledge immersion & integration', tag: '7.5 → 8.3',
      steps: ['Enriched organizations held against their patient id, ready to be rejoined to product'] },

    /* ---- 08 · classification -------------------------------------------- */
    { id: 'classifier', kind: 'room', lane: 'classify', x: 680, w: 500, glyph: 'physician', accent: C.classed,
      title: 'Classification physician', tag: '8.4',
      steps: ['Classifies the spend from the integrated organization, prior history and the normalized product'] },

    /* ---- 09 · recovery --------------------------------------------------- */
    { id: 'recovery', kind: 'room', lane: 'recovery', x: 400, w: 440, glyph: 'recovery', accent: C.integ,
      title: 'Recovery room', tag: '8.5',
      steps: ['Integrated and classified spend, held for review'] },

    /* ---- 10 · review lab ------------------------------------------------- */
    { id: 'chkSupplier', kind: 'room', lane: 'review', x: 60,  w: 340, h: 100, glyph: 'lens', accent: C.org,
      title: 'Supplier / parentage check', tag: '9a',
      steps: ['Is the supplier right, and does its parentage hold?'] },
    { id: 'chkOem',      kind: 'room', lane: 'review', x: 450, w: 340, h: 100, glyph: 'lens', accent: C.prod,
      title: 'OEM / parentage check', tag: '9b',
      steps: ['Is the manufacturer right, and does its parentage hold?'] },
    { id: 'chkClass',    kind: 'room', lane: 'review', x: 840, w: 340, h: 100, glyph: 'lens', accent: C.classed,
      title: 'Classification check', tag: '9c',
      steps: ['Does the classification stand up on all three axes?'] },

    { id: 'tbm',     kind: 'chip', lane: 'review', x: 840,  dy: 126, w: 104, h: 38, accent: C.classed, title: 'TBM' },
    { id: 'lvl1',    kind: 'chip', lane: 'review', x: 956,  dy: 126, w: 104, h: 38, accent: C.classed, title: 'Level 1' },
    { id: 'nontech', kind: 'chip', lane: 'review', x: 1072, dy: 126, w: 108, h: 38, accent: C.classed, title: 'Non-Tech' }
  ];

  /* Links. `from`/`to` are room ids, or synthetic ids produced by the intake
     rows (gurney0..2, doctor0..2). side: 'v' vertical S-curve (default),
     'loop' a routed detour, 'elbow' an orthogonal hop. */
  var LINKS = [
    { from: 'gurney0', to: 'or1', kind: 'raw' },
    { from: 'gurney1', to: 'or2', kind: 'raw' },
    { from: 'gurney2', to: 'or3', kind: 'raw' },

    { from: 'or1', to: 'orgSplit',  kind: 'org' },
    { from: 'or2', to: 'orgSplit',  kind: 'org' },
    { from: 'or3', to: 'orgSplit',  kind: 'org' },
    { from: 'or1', to: 'prodSplit', kind: 'prod' },
    { from: 'or2', to: 'prodSplit', kind: 'prod' },
    { from: 'or3', to: 'prodSplit', kind: 'prod' },

    { from: 'orgSplit',  to: 'supplier', kind: 'org' },
    { from: 'prodSplit', to: 'product',  kind: 'prod' },

    { from: 'supplier', to: 'immersion', kind: 'org',  label: '7.5' },
    { from: 'immersion', to: 'product',  kind: 'integ', label: '8.3', side: 'up' },

    /* 8.2 — manufacturer found in the product stream is handed back to the
       supplier specialist. Routed around the outside so it reads as a return. */
    { from: 'product', to: 'supplier', kind: 'prod', label: '8.2 manufacturer', side: 'loop', dash: true },

    /* 7.4 — the recognizer learns; a loop back into the same room. */
    { from: 'supplier', to: 'supplier', kind: 'org', label: '7.4 learn', side: 'self', dash: true },

    { from: 'product',    to: 'classifier', kind: 'prod',  label: '8.4' },
    { from: 'classifier', to: 'recovery',   kind: 'classed', label: '8.5' },

    { from: 'recovery', to: 'chkSupplier', kind: 'integ' },
    { from: 'recovery', to: 'chkOem',      kind: 'integ' },
    { from: 'recovery', to: 'chkClass',    kind: 'integ' },

    { from: 'chkClass', to: 'tbm',     kind: 'classed', side: 'short' },
    { from: 'chkClass', to: 'lvl1',    kind: 'classed', side: 'short' },
    { from: 'chkClass', to: 'nontech', kind: 'classed', side: 'short' }
  ];

  /* Intake rows are generated rather than hand-placed. */
  var CONTRIBUTORS = 7;                    /* people throwing sacks */
  var GURNEYS      = [235, 620, 1005];     /* x centres, shared by rows 02–04 */
  var SACKS_PER_GURNEY = 4;

  /* =========================================================================
     DRAWING — generic below this line.
     ========================================================================= */

  /* ---- layout ----------------------------------------------------------
     Lane y positions and room heights are derived from content, so adding a
     step or lengthening a sentence can never push text under a band label. */

  function wrapText(text, maxChars) {
    if (maxChars < 8) maxChars = 8;
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var trial = cur ? cur + ' ' + w : w;
      if (trial.length <= maxChars) { cur = trial; }
      else { if (cur) lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  var CHAR_W = 6.15;          /* 12px in the site's sans, measured empirically */

  function wrapSteps(r) {
    var pad = r.glyph ? 62 : 14;
    var avail = r.w - pad - 14;
    return (r.steps || []).map(function (str) {
      var m = String(str).match(/^(\d+\.\d+)\s+(.*)$/);
      var tag = m ? m[1] : null;
      var body = m ? m[2] : str;
      var maxChars = Math.floor((avail - (tag ? 30 : 0)) / CHAR_W);
      return { tag: tag, lines: wrapText(body, maxChars) };
    });
  }

  function autoHeight(r) {
    var n = r.wrapped.reduce(function (a, s) { return a + s.lines.length; }, 0);
    var h = 40 + n * 19 + 16;
    if (r.glyph) h = Math.max(h, 96);
    return Math.max(h, 72);
  }

  function layout() {
    var byLane = {};
    ROOMS.forEach(function (r) { (byLane[r.lane] = byLane[r.lane] || []).push(r); });

    var cursor = 60;
    LANES.forEach(function (l) {
      l.y = cursor;
      var bottom = 0;
      (byLane[l.id] || []).forEach(function (r) {
        r.wrapped = wrapSteps(r);
        if (!r.h) r.h = autoHeight(r);
        r.y = l.y + LANE_HEADER + (r.dy || 0);
        bottom = Math.max(bottom, (r.dy || 0) + r.h);
      });
      l.h = LANE_HEADER + Math.max(bottom, l.minH || 0) + LANE_PAD;
      l.top = l.y + LANE_HEADER;              /* content top, for generated rows */
      cursor = l.y + l.h + LANE_GAP;
    });
    H = cursor + 84;                           /* room for the legend */
  }


  /* =========================================================================
     COMPACT VARIANT - a stage rail sized for the platform hero column.
     Same ten stages, summarized. The full surgical theatre stays in the
     default variant / spend-pipeline.html.

         renderSpendPipeline('#el', { variant: 'compact' })
     ========================================================================= */

  var STAGES = [
    { n: '01', t: 'Intake',                s: 'sacks of spend data handed over',       g: 'person',     c: 'raw' },
    { n: '02', t: 'Receiving & transport', s: 'stacked onto gurneys, wheeled through', g: 'gurney',     c: 'raw' },
    { n: '03', t: 'Operating rooms',       s: 'patient id assigned, record dissected', g: 'doors',      c: 'raw' },
    { n: '04', t: 'Dissection',            s: 'organizations \u00b7 products',           g: 'split',      c: 'dual' },
    { n: '05', t: 'Specialist suites',     s: 'clean \u00b7 normalize \u00b7 enrich',      g: 'specialist', c: 'dual' },
    { n: '06', t: 'Immersion',             s: 'knowledge integration',                 g: 'merge',      c: 'integ' },
    { n: '07', t: 'Classification',        s: 'the spend gets a name',                 g: 'physician',  c: 'classed' },
    { n: '08', t: 'Recovery',              s: 'integrated and classified',             g: 'bed',        c: 'classed' },
    { n: '09', t: 'Review lab',            s: 'supplier \u00b7 OEM \u00b7 classification',   g: 'lens',       c: 'classed' }
  ];

  /* The review lab splits three ways; only the classification branch
     sub-divides into the three spend types. */
  var REVIEW_BRANCHES = [
    { id: 'sup', t: 'Supplier',       c: 'org' },
    { id: 'oem', t: 'OEM',            c: 'prod' },
    { id: 'cls', t: 'Classification', c: 'classed' }
  ];
  var CLASS_OUTPUTS = ['TBM', 'Level 1', 'Non-Tech'];

  /* Everything the review lab produces is packaged, then seen by the customer. */
  var TAIL = [
    { n: '10', t: 'Packaging', s: 'deployed to QA \u2192 approved for viewing', g: 'package',  c: 'integ' },
    { n: '12', t: 'Customer',  s: 'eyes and hands on the result',             g: 'customer', c: 'integ' }
  ];

  /* Returns into processing. All three route up the left gutter: the right-hand
     side is full of label text, and a return routed round it crossed every
     stage caption on the way back. Colour carries which branch each one is. */
  var FEEDBACK = [
    { from: 0, label: '11.1 supplier to history' },
    { from: 1, label: '11.2 OEM to history' },
    { from: 2, label: '11.3 classification to product specialist' }
  ];

  /* Small glyphs, drawn inside a badge and centred on the origin. */
  var MINI = {
    person: function (g, c) {
      g.append('circle').attr('cy', -5).attr('r', 3).style('fill', 'none').style('stroke', c).style('stroke-width', 1.3);
      g.append('path').attr('d', 'M0,-2 v5 M0,3 l-3,5 M0,3 l3,5 M0,0 l5,-3')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.3);
      g.append('circle').attr('cx', 7).attr('cy', -5).attr('r', 2.4).style('fill', c).style('opacity', .7);
    },
    gurney: function (g, c) {
      g.append('rect').attr('x', -8).attr('y', 2).attr('width', 16).attr('height', 2.4).style('fill', c);
      g.append('circle').attr('cx', -5).attr('cy', 7).attr('r', 2).style('fill', 'none').style('stroke', c).style('stroke-width', 1.2);
      g.append('circle').attr('cx', 5).attr('cy', 7).attr('r', 2).style('fill', 'none').style('stroke', c).style('stroke-width', 1.2);
      [[-4, -2], [0, -2], [4, -2], [-2, -6], [2, -6]].forEach(function (q) {
        g.append('circle').attr('cx', q[0]).attr('cy', q[1]).attr('r', 1.9).style('fill', c).style('opacity', .65);
      });
    },
    porter: function (g, c) {
      g.append('path').attr('d', 'M-5,-6 a5,5 0 0 1 10,0 v2 a5,5 0 0 1 -10,0 z')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.3);
      g.append('rect').attr('x', -4.5).attr('y', -4).attr('width', 9).attr('height', 4).attr('rx', 1).style('fill', c).style('opacity', .55);
      g.append('path').attr('d', 'M-5,2 h10 l2,7 h-14 z').style('fill', c).style('opacity', .2).style('stroke', c).style('stroke-width', 1);
    },
    doors: function (g, c) {
      g.append('rect').attr('x', -6).attr('y', -7).attr('width', 12).attr('height', 14).attr('rx', 1)
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.3);
      g.append('path').attr('d', 'M0,-7 v14').style('stroke', c).style('stroke-width', 1.1);
    },
    split: function (g, c) {
      g.append('path').attr('d', 'M0,-8 v5').style('stroke', c).style('stroke-width', 1.4);
      g.append('path').attr('d', 'M0,-3 C0,2 -7,2 -7,8').style('fill', 'none').style('stroke', C.org).style('stroke-width', 1.5);
      g.append('path').attr('d', 'M0,-3 C0,2 7,2 7,8').style('fill', 'none').style('stroke', C.prod).style('stroke-width', 1.5);
    },
    specialist: function (g, c) {
      g.append('path').attr('d', 'M-6,-4 a6,6 0 0 1 12,0 v2 a6,7 0 0 1 -12,0 z')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.3);
      g.append('rect').attr('x', -5).attr('y', -1).attr('width', 10).attr('height', 5).attr('rx', 1.5).style('fill', c).style('opacity', .55);
    },
    merge: function (g, c) {
      g.append('path').attr('d', 'M-7,-8 C-7,-2 0,-2 0,2').style('fill', 'none').style('stroke', C.org).style('stroke-width', 1.5);
      g.append('path').attr('d', 'M7,-8 C7,-2 0,-2 0,2').style('fill', 'none').style('stroke', C.prod).style('stroke-width', 1.5);
      g.append('circle').attr('cy', 4).attr('r', 3).style('fill', c);
    },
    physician: function (g, c) {
      g.append('path').attr('d', 'M-5,-8 v5 a5,5 0 0 0 10,0 v-5')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.3);
      g.append('circle').attr('cy', 5).attr('r', 3).style('fill', 'none').style('stroke', c).style('stroke-width', 1.3);
    },
    bed: function (g, c) {
      g.append('path').attr('d', 'M-8,2 h16 M-8,2 v-5 h6 a3,3 0 0 1 3,3 v2')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.3);
      g.append('path').attr('d', 'M-8,8 h4 l2,-4 l2,7 l2,-3 h6')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.1).style('opacity', .8);
    },
    lens: function (g, c) {
      g.append('circle').attr('cx', -1).attr('cy', -1).attr('r', 5.5).style('fill', 'none').style('stroke', c).style('stroke-width', 1.4);
      g.append('line').attr('x1', 3).attr('y1', 3).attr('x2', 8).attr('y2', 8).style('stroke', c).style('stroke-width', 1.6);
    },
    package: function (g, c) {
      g.append('path').attr('d', 'M-8,-3 h16 v10 h-16 z')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.3);
      g.append('path').attr('d', 'M-9,-7 h18 v4 h-18 z').style('fill', c).style('opacity', .28);
      g.append('path').attr('d', 'M0,-7 v14').style('stroke', c).style('stroke-width', 1.1);
    },
    customer: function (g, c) {
      g.append('path').attr('d', 'M-9,-2 C-5,-8 5,-8 9,-2 C5,4 -5,4 -9,-2 z')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.3);
      g.append('circle').attr('cy', -2).attr('r', 2.4).style('fill', c);
      g.append('path').attr('d', 'M2,5 l3,4 M6,4 l2,4').style('stroke', c).style('stroke-width', 1.2).style('opacity', .8);
    }
  };

  function renderCompact(root, animate) {
    var GAP = 54, TOP = 34, RAIL = 40, R = 16;
    var TX = RAIL + R + 16, CHIP_H = 28, CHIP_GAP = 10;

    var lastY  = TOP + (STAGES.length - 1) * GAP;   /* review lab badge */
    var fanTop = lastY + R;

    var Y1 = lastY + 74;          /* review branch chips, top edge */
    var Y2 = Y1 + 66;             /* classification outputs */
    var YC = Y2 + 46;             /* collector bar */
    var YP = YC + 42;             /* packaging badge centre */
    var YU = YP + 62;             /* customer badge centre */
    var CH = YU + 56;

    function chipW(t) { return Math.max(74, t.length * 6.7 + 28); }

    /* --- geometry: review branches ------------------------------------- */
    var bx = TX, B = REVIEW_BRANCHES.map(function (r) {
      var w = chipW(r.t), e = { t: r.t, c: r.c, x: bx, w: w, cx: bx + w / 2 };
      bx += w + CHIP_GAP; return e;
    });

    /* --- geometry: classification outputs, centred under that branch ---- */
    var ows = CLASS_OUTPUTS.map(chipW);
    var oTot = ows.reduce(function (a, v) { return a + v; }, 0) + (ows.length - 1) * 8;
    var ox = B[2].cx - oTot / 2;
    var O = CLASS_OUTPUTS.map(function (t, i) {
      var e = { t: t, x: ox, w: ows[i], cx: ox + ows[i] / 2 };
      ox += ows[i] + 8; return e;
    });

    /* --- extents, so the whole thing can be centred --------------------- */
    var GUT = 48;                                   /* left gutter for the returns */
    var rawLeft  = Math.min(RAIL - R, B[0].x, O[0].x);
    var rawRight = Math.max(B[B.length - 1].x + B[B.length - 1].w,
                            O[O.length - 1].x + O[O.length - 1].w,
                            TX + 210);
    var contentLeft  = rawLeft - GUT;               /* covers lanes + rotated label */
    var contentRight = rawRight + 12;
    var contentW = contentRight - contentLeft;
    var CW = Math.max(520, contentW + 24);
    var vbX = contentLeft - (CW - contentW) / 2;
    var GL = rawLeft - 16;                          /* first return lane */

    var svg = root.append('svg')
      .attr('viewBox', vbX + ' 0 ' + CW + ' ' + CH)
      .attr('preserveAspectRatio', 'xMidYMin meet')
      .attr('role', 'img')
      .attr('aria-label', 'Spend data pipeline: raw spend data is taken in, dissected, cleaned and ' +
            'classified, then checked in the review lab along three branches - supplier, OEM and ' +
            'classification, the last splitting into TBM, Level 1 and Non-Tech. Results are packaged, ' +
            'passed through QA and approved for the customer, who reviews them. Supplier and OEM ' +
            'findings feed back to history; classification feeds back to the product specialist.')
      .style('width', '100%').style('height', 'auto').style('display', 'block')
      .style('font-family', FONT_SANS);

    buildDefs(svg);
    var gRail = svg.append('g'), gFlow = svg.append('g'), gNode = svg.append('g');

    /* --- rail connectors ------------------------------------------------ */
    STAGES.forEach(function (st, i) {
      if (i === STAGES.length - 1) return;
      var y1 = TOP + i * GAP + R, y2 = TOP + (i + 1) * GAP - R;
      if (st.c === 'dual') {
        [[-3, C.org], [3, C.prod]].forEach(function (d) {
          gRail.append('line').attr('x1', RAIL + d[0]).attr('x2', RAIL + d[0]).attr('y1', y1).attr('y2', y2)
            .style('stroke', d[1]).style('stroke-width', 1.6).style('opacity', .85);
        });
      } else {
        gRail.append('line').attr('x1', RAIL).attr('x2', RAIL).attr('y1', y1).attr('y2', y2)
          .style('stroke', C[st.c]).style('stroke-width', 1.8).style('opacity', .85);
      }
    });

    /* --- badges + labels ------------------------------------------------ */
    function badge(x, y, st, col) {
      var g = gNode.append('g').attr('transform', 'translate(' + x + ',' + y + ')');
      g.append('circle').attr('r', R).style('fill', C.surface).style('stroke', col).style('stroke-width', 1.5);
      g.append('circle').attr('r', R).style('fill', col).style('opacity', .10);
      MINI[st.g](g.append('g'), col);
      var lbl = gNode.append('text').attr('x', x + R + 16).attr('y', y - 1)
        .style('font-size', '13px').style('font-weight', 650).style('fill', C.ink);
      lbl.append('tspan').style('font-family', FONT_MONO).style('font-size', '10px')
        .style('font-weight', 400).style('fill', col).text(st.n + '  ');
      lbl.append('tspan').text(st.t);
      gNode.append('text').attr('x', x + R + 16).attr('y', y + 15)
        .style('font-size', '11.5px').style('fill', C.muted).text(st.s);
    }
    STAGES.forEach(function (st, i) {
      badge(RAIL, TOP + i * GAP, st, C[st.c === 'dual' ? 'org' : st.c]);
    });

    /* --- fan: review lab into its three branches ------------------------ */
    var fanMid = (fanTop + Y1) / 2;
    function fanTo(cx, y0, y1) {
      return 'C' + RAIL + ',' + ((y0 + y1) / 2) + ' ' + cx + ',' + ((y0 + y1) / 2) + ' ' + cx + ',' + y1;
    }
    B.forEach(function (e) {
      gRail.append('path')
        .attr('d', 'M' + RAIL + ',' + fanTop + ' C' + RAIL + ',' + fanMid + ' ' + e.cx + ',' + fanMid + ' ' + e.cx + ',' + Y1)
        .style('fill', 'none').style('stroke', C[e.c]).style('stroke-width', 1.3).style('opacity', .65);
    });

    /* --- fan: classification into its three outputs --------------------- */
    var subTop = Y1 + CHIP_H, subMid = (subTop + Y2) / 2;
    O.forEach(function (e) {
      gRail.append('path')
        .attr('d', 'M' + B[2].cx + ',' + subTop + ' C' + B[2].cx + ',' + subMid + ' ' + e.cx + ',' + subMid + ' ' + e.cx + ',' + Y2)
        .style('fill', 'none').style('stroke', C.classed).style('stroke-width', 1.2).style('opacity', .6);
    });

    /* --- collector: everything the lab produced goes to packaging ------- */
    var feeders = [B[0].cx, B[1].cx].concat(O.map(function (e) { return e.cx; }));
    var fromY   = [Y1 + CHIP_H, Y1 + CHIP_H, Y2 + CHIP_H, Y2 + CHIP_H, Y2 + CHIP_H];
    feeders.forEach(function (cx, i) {
      gRail.append('path')
        .attr('d', 'M' + cx + ',' + fromY[i] + ' C' + cx + ',' + (YC - 14) + ' ' + cx + ',' + YC + ' ' + cx + ',' + YC)
        .style('fill', 'none').style('stroke', C.integ).style('stroke-width', 1.1).style('opacity', .45);
    });
    gRail.append('line')
      .attr('x1', RAIL).attr('x2', Math.max.apply(null, feeders))
      .attr('y1', YC).attr('y2', YC)
      .style('stroke', C.integ).style('stroke-width', 1.3).style('opacity', .55);
    gRail.append('line').attr('x1', RAIL).attr('x2', RAIL).attr('y1', YC).attr('y2', YP - R)
      .style('stroke', C.integ).style('stroke-width', 1.8).style('opacity', .85);
    gRail.append('line').attr('x1', RAIL).attr('x2', RAIL).attr('y1', YP + R).attr('y2', YU - R)
      .style('stroke', C.integ).style('stroke-width', 1.8).style('opacity', .85);

    /* --- chips ----------------------------------------------------------- */
    function chip(e, y, col, size) {
      gNode.append('rect').attr('x', e.x).attr('y', y).attr('width', e.w).attr('height', CHIP_H).attr('rx', CHIP_H / 2)
        .style('fill', C.surface).style('stroke', col).style('stroke-width', 1.2);
      gNode.append('text').attr('x', e.cx).attr('y', y + 18).attr('text-anchor', 'middle')
        .style('font-size', (size || 11.5) + 'px').style('fill', col).text(e.t);
    }
    B.forEach(function (e) { chip(e, Y1, C[e.c]); });
    O.forEach(function (e) { chip(e, Y2, C.classed, 11); });

    /* --- tail badges ------------------------------------------------------ */
    badge(RAIL, YP, TAIL[0], C.integ);
    badge(RAIL, YU, TAIL[1], C.integ);

    /* --- feedback returns ------------------------------------------------- */
    var fbTarget = TOP + 4 * GAP;                    /* stage 05, specialist suites */
    var fbLanes = [];
    FEEDBACK.forEach(function (fb, i) {
      var src  = B[fb.from];
      var lane = GL - i * 9;
      var yb   = Y1 + CHIP_H + 10 + i * 7;           /* staggered so they never overlap */
      var rr   = 8;
      fbLanes.push(lane);
      gRail.append('path')
        .attr('d', 'M' + src.cx + ',' + (Y1 + CHIP_H) +
                   ' V' + (yb - rr) +
                   ' Q' + src.cx + ',' + yb + ' ' + (src.cx - rr) + ',' + yb +
                   ' H' + (lane + rr) +
                   ' Q' + lane + ',' + yb + ' ' + lane + ',' + (yb - rr) +
                   ' V' + (fbTarget + rr) +
                   ' Q' + lane + ',' + fbTarget + ' ' + (lane + rr) + ',' + fbTarget +
                   ' H' + (RAIL - R - 2))
        .style('fill', 'none').style('stroke', C[src.c]).style('stroke-width', 1.1)
        .style('stroke-dasharray', '4 4').style('opacity', .55)
        .attr('marker-end', 'url(#sp-arrow-' + src.c + ')');
    });

    /* Label set vertically in the gutter — laid horizontally it ran straight
       through the stage captions. */
    var fbMidY = (fbTarget + Y1) / 2;
    var fbX = fbLanes[fbLanes.length - 1] - 9;
    gNode.append('text')
      .attr('transform', 'translate(' + fbX + ',' + fbMidY + ') rotate(-90)')
      .attr('text-anchor', 'middle')
      .style('font-family', FONT_MONO).style('font-size', '9px').style('letter-spacing', '.14em')
      .style('text-transform', 'uppercase').style('fill', C.faint)
      .text('11 · feedback to processing');

    /* --- animation -------------------------------------------------------- */
    if (animate) {
      /* One path per delivered outcome. Identical prefixes mean tokens sit on
         top of one another while the record is still whole; duplicates are
         hidden each frame, so the packet visibly becomes three at the review
         lab and five once classification sub-divides. */
      var routes = [];
      function tail(cx, y) {
        return ' C' + cx + ',' + (YC - 14) + ' ' + cx + ',' + YC + ' ' + cx + ',' + YC +
               ' H' + RAIL + ' V' + (YU - R);
      }
      [0, 1].forEach(function (i) {
        routes.push('M' + RAIL + ',' + TOP + ' V' + fanTop +
          ' C' + RAIL + ',' + fanMid + ' ' + B[i].cx + ',' + fanMid + ' ' + B[i].cx + ',' + Y1 +
          ' V' + (Y1 + CHIP_H) + tail(B[i].cx));
      });
      O.forEach(function (e) {
        routes.push('M' + RAIL + ',' + TOP + ' V' + fanTop +
          ' C' + RAIL + ',' + fanMid + ' ' + B[2].cx + ',' + fanMid + ' ' + B[2].cx + ',' + Y1 +
          ' V' + subTop +
          ' C' + B[2].cx + ',' + subMid + ' ' + e.cx + ',' + subMid + ' ' + e.cx + ',' + Y2 +
          ' V' + (Y2 + CHIP_H) + tail(e.cx));
      });

      var nodes = routes.map(function (d) {
        return gFlow.append('path').attr('class', 'c-branch').attr('d', d)
          .style('fill', 'none').style('stroke', 'none').node();
      });
      var lens = nodes.map(function (n) { return n.getTotalLength(); });
      var maxLen = Math.max.apply(null, lens);
      var railLen = lastY - TOP;
      var SPEED = 115, HOLD = 120, FADE = 26;

      var tokens = gFlow.selectAll('g.c-token').data(nodes).join('g').attr('class', 'c-token');
      tokens.each(function () { drawSack(d3.select(this), 0, 0, 0.44, C.raw); });

      var travelled = 0, last = 0;
      d3.timer(function (el) {
        var dt = Math.min(60, el - last) / 1000; last = el;
        travelled += SPEED * dt;
        if (travelled > maxLen + HOLD) travelled = 0;

        var seen = [];
        tokens.each(function (node, i) {
          var L = lens[i], d = Math.min(travelled, L);
          var pt = nodes[i].getPointAtLength(d);
          var key = Math.round(pt.x) + ':' + Math.round(pt.y);
          var dup = seen.indexOf(key) >= 0;
          seen.push(key);

          var si = Math.floor((d / railLen) * STAGES.length);
          var st = STAGES[Math.max(0, Math.min(STAGES.length - 1, si))];
          var col = d > railLen ? C.integ : C[st.c === 'dual' ? 'org' : st.c];

          var op = dup ? 0 : 1;
          if (travelled < FADE) op *= travelled / FADE;
          if (travelled > L) op *= Math.max(0.25, 1 - (travelled - L) / HOLD);

          d3.select(this)
            .attr('transform', 'translate(' + pt.x + ',' + pt.y + ')')
            .style('opacity', op)
            .selectAll('path').style('fill', col);
        });
      });
    }

    return svg;
  }

  function renderSpendPipeline(target, opts) {
    opts = opts || {};
    var root = (typeof target === 'string') ? d3.select(target) : d3.select(target.node ? target.node() : target);
    if (root.empty()) { console.warn('[spend-pipeline] container not found:', target); return; }
    root.selectAll('*').remove();

    var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var animate = (opts.animate !== undefined) ? opts.animate : !reduced;

    if (opts.variant === 'compact') return renderCompact(root, animate);
    layout();

    var svg = root.append('svg')
      .attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('preserveAspectRatio', 'xMidYMin meet')
      .attr('role', 'img')
      .attr('aria-label', 'CXO Nexus spend data pipeline, drawn as a surgical theatre: ' +
            'contributors hand over sacks of spend data, which are stacked on gurneys, wheeled into ' +
            'operating rooms, assigned a patient id and dissected into organizations and products. ' +
            'Supplier and product specialists clean, normalize and enrich each stream, a classification ' +
            'physician names the spend, and the result is checked three ways in the review lab.')
      .style('width', '100%')
      .style('height', 'auto')
      .style('display', 'block')
      .style('font-family', FONT_SANS);

    buildDefs(svg);

    var gLanes = svg.append('g').attr('class', 'sp-lanes');
    var gLinks = svg.append('g').attr('class', 'sp-links');
    var gNodes = svg.append('g').attr('class', 'sp-nodes');
    var gFlow  = svg.append('g').attr('class', 'sp-flow');

    /* ---- lanes ---------------------------------------------------------- */
    var lane = gLanes.selectAll('g').data(LANES).join('g');
    lane.append('rect')
      .attr('x', 34).attr('width', W - 68)
      .attr('y', function (d) { return d.y; })
      .attr('height', function (d) { return d.h; })
      .attr('rx', 10)
      .style('fill', function (d, i) { return i % 2 ? C.surface : C.raised; })
      .style('opacity', 0.55)
      .style('stroke', C.line)
      .style('stroke-width', 1);
    lane.append('text')
      .attr('x', 48)
      .attr('y', function (d) { return d.y + 22; })
      .style('font-family', FONT_MONO)
      .style('font-size', '11px')
      .style('letter-spacing', '.14em')
      .style('text-transform', 'uppercase')
      .style('fill', C.accent)
      .text(function (d) { return d.label; });
    lane.append('text')
      .attr('x', 48)
      .attr('y', function (d) { return d.y + 38; })
      .style('font-family', FONT_MONO)
      .style('font-size', '10px')
      .style('letter-spacing', '.06em')
      .style('fill', C.faint)
      .text(function (d) { return d.note; });

    /* ---- rows 01–03: people, gurneys, porters --------------------------- */
    var intake = laneById('intake'), receive = laneById('receive'), transit = laneById('transit');

    var peopleY = intake.top + 96;
    var span = W - 260, x0 = 130;
    var people = d3.range(CONTRIBUTORS).map(function (i) {
      return { x: x0 + (span * i) / (CONTRIBUTORS - 1), y: peopleY };
    });
    people.forEach(function (p) { drawPerson(gNodes.append('g'), p.x, p.y); });

    /* sacks arc from each contributor into the nearest gurney */
    people.forEach(function (p) {
      var g = nearest(GURNEYS, p.x);
      var tx = g, ty = receive.top + 34;
      gLinks.append('path')
        .attr('d', arc(p.x + 16, p.y - 34, tx, ty, 0.34))
        .style('fill', 'none')
        .style('stroke', C.raw)
        .style('stroke-width', 1.4)
        .style('stroke-dasharray', '3 4')
        .style('opacity', 0.65)
        .attr('marker-end', 'url(#sp-arrow-raw)');
    });

    GURNEYS.forEach(function (cx, i) {
      drawGurney(gNodes.append('g'), cx, receive.top + 118, SACKS_PER_GURNEY);
      drawDoctor(gNodes.append('g'), cx - 96, transit.top + 62);
      /* porter → operating room */
      LINK_ANCHORS['gurney' + i] = { x: cx, y: transit.top, bottom: { x: cx, y: transit.y + transit.h } };
    });

    /* ---- rooms ---------------------------------------------------------- */
    var byId = {};
    ROOMS.forEach(function (r) { byId[r.id] = r; });

    /* ---- links (behind nodes) ------------------------------------------- */
    var linkSel = gLinks.selectAll('path.sp-link').data(LINKS).join('path')
      .attr('class', 'sp-link')
      .attr('d', function (d) { return linkPath(d, byId); })
      .style('fill', 'none')
      .style('stroke', function (d) { return C[d.kind] || C.muted; })
      .style('stroke-width', 1.8)
      .style('stroke-dasharray', function (d) { return d.dash ? '5 5' : null; })
      .style('opacity', 0.85)
      .attr('marker-end', function (d) { return 'url(#sp-arrow-' + (d.kind || 'muted') + ')'; });

    gLinks.selectAll('text.sp-linklabel').data(LINKS.filter(function (d) { return d.label; })).join('text')
      .attr('class', 'sp-linklabel')
      .each(function (d) {
        var p = midpoint(linkPath(d, byId));
        d3.select(this).attr('x', p.x).attr('y', p.y - 6);
      })
      .attr('text-anchor', 'middle')
      .style('font-family', FONT_MONO)
      .style('font-size', '10px')
      .style('letter-spacing', '.06em')
      .style('fill', function (d) { return C[d.kind] || C.muted; })
      .style('paint-order', 'stroke')
      .style('stroke', C.ground)
      .style('stroke-width', 3)
      .text(function (d) { return d.label; });

    /* ---- room cards ------------------------------------------------------ */
    var node = gNodes.selectAll('g.sp-room').data(ROOMS).join('g')
      .attr('class', 'sp-room')
      .attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });

    node.each(function (d) { (d.kind === 'chip' ? drawChip : drawRoom)(d3.select(this), d); });

    /* ---- flowing tokens -------------------------------------------------- */
    if (animate) startFlow(gFlow, linkSel);

    drawLegend(svg);
    return svg;
  }

  /* ---------------------------------------------------------------------- */

  var LINK_ANCHORS = {};

  function laneById(id) { return LANES.filter(function (l) { return l.id === id; })[0]; }

  function nearest(arr, x) {
    return arr.reduce(function (best, v) { return Math.abs(v - x) < Math.abs(best - x) ? v : best; }, arr[0]);
  }

  function anchors(node) {
    if (LINK_ANCHORS[node]) return LINK_ANCHORS[node];
    return null;
  }

  function box(id, byId) {
    if (byId[id]) {
      var r = byId[id];
      return { x: r.x, y: r.y, w: r.w, h: r.h, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
    }
    var a = anchors(id);
    if (a) return { x: a.x, y: a.y, w: 0, h: (a.bottom.y - a.y), cx: a.x, cy: a.y };
    return null;
  }

  function linkPath(d, byId) {
    var a = box(d.from, byId), b = box(d.to, byId);
    if (!a || !b) return 'M0,0';

    if (d.side === 'self') {
      /* a loop out of the left edge and back in, sitting clear of the card */
      var y1 = a.y + a.h * 0.52, y2 = a.y + a.h * 0.78, off = 46;
      return 'M' + a.x + ',' + y1 +
             ' C' + (a.x - off) + ',' + y1 + ' ' + (a.x - off) + ',' + y2 + ' ' + a.x + ',' + y2;
    }
    if (d.side === 'loop') {
      /* product suite back to supplier suite, routed under both cards */
      var yb = Math.max(a.y + a.h, b.y + b.h) + 26;
      return 'M' + (a.x + a.w * 0.18) + ',' + (a.y + a.h) +
             ' C' + (a.x + a.w * 0.18) + ',' + yb + ' ' + (b.x + b.w * 0.82) + ',' + yb +
             ' ' + (b.x + b.w * 0.82) + ',' + (b.y + b.h);
    }
    if (d.side === 'up') {
      /* immersion room rising back into the product suite */
      var sx = b.cx - 60, sy = b.y + b.h;
      return 'M' + a.cx + ',' + a.y + ' C' + a.cx + ',' + (a.y - 46) + ' ' + sx + ',' + (sy + 46) + ' ' + sx + ',' + sy;
    }
    if (d.side === 'short') {
      return 'M' + b.cx + ',' + (a.y + a.h) + ' L' + b.cx + ',' + b.y;
    }
    /* default: vertical S-curve, bottom of a → top of b */
    var ax = a.cx, ay = a.y + a.h, bx = b.cx, by = b.y;
    var dy = Math.max(24, (by - ay) * 0.5);
    return 'M' + ax + ',' + ay + ' C' + ax + ',' + (ay + dy) + ' ' + bx + ',' + (by - dy) + ' ' + bx + ',' + by;
  }

  function midpoint(dStr) {
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', dStr);
    var L = p.getTotalLength();
    return L ? p.getPointAtLength(L * 0.5) : { x: 0, y: 0 };
  }

  function arc(x1, y1, x2, y2, lift) {
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.abs(x2 - x1) * lift - 20;
    return 'M' + x1 + ',' + y1 + ' Q' + mx + ',' + my + ' ' + x2 + ',' + y2;
  }

  /* ---------------------------------------------------------------------- */

  function drawRoom(g, d) {
    var accent = d.accent || C.accent;

    g.append('rect')
      .attr('width', d.w).attr('height', d.h).attr('rx', 8)
      .style('fill', C.surface)
      .style('stroke', C.line2)
      .style('stroke-width', 1);

    /* header strip */
    g.append('path')
      .attr('d', 'M0,8 a8,8 0 0 1 8,-8 h' + (d.w - 16) + ' a8,8 0 0 1 8,8 v22 h' + (-d.w) + ' z')
      .style('fill', accent).style('opacity', 0.12);
    g.append('line')
      .attr('x1', 0).attr('x2', d.w).attr('y1', 30).attr('y2', 30)
      .style('stroke', accent).style('opacity', 0.35);
    g.append('rect')
      .attr('x', 0).attr('y', 0).attr('width', 3).attr('height', d.h)
      .style('fill', accent).style('opacity', 0.85);

    g.append('text')
      .attr('x', 14).attr('y', 20)
      .style('font-size', '13px').style('font-weight', 650)
      .style('fill', C.ink)
      .text(d.title);

    if (d.tag) {
      g.append('text')
        .attr('x', d.w - 12).attr('y', 20)
        .attr('text-anchor', 'end')
        .style('font-family', FONT_MONO).style('font-size', '10px')
        .style('letter-spacing', '.1em')
        .style('fill', accent)
        .text(d.tag);
    }

    if (d.glyph && GLYPHS[d.glyph]) GLYPHS[d.glyph](g.append('g'), d, accent);

    var pad = d.glyph ? 62 : 14;
    var row = 0;
    (d.wrapped || []).forEach(function (step) {
      step.lines.forEach(function (line, li) {
        var t = g.append('text')
          .attr('x', pad + (step.tag && li > 0 ? 30 : 0))
          .attr('y', 54 + row * 19)
          .style('font-size', '12px')
          .style('fill', C.muted);
        if (step.tag && li === 0) {
          t.append('tspan')
            .style('font-family', FONT_MONO).style('font-size', '10px')
            .style('fill', accent).text(step.tag + '  ');
        }
        t.append('tspan').text(line);
        row++;
      });
    });
  }

  function drawChip(g, d) {
    var accent = d.accent || C.accent;
    g.append('rect')
      .attr('width', d.w).attr('height', d.h).attr('rx', d.h / 2)
      .style('fill', C.surface)
      .style('stroke', accent).style('stroke-width', 1.4);
    g.append('text')
      .attr('x', d.w / 2).attr('y', d.h / 2 + 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px').style('font-weight', 600)
      .style('fill', accent)
      .text(d.title);
    if (d.tag) {
      g.append('circle').attr('cx', 16).attr('cy', d.h / 2).attr('r', 7)
        .style('fill', accent).style('opacity', 0.18);
      g.append('text').attr('x', 16).attr('y', d.h / 2 + 3)
        .attr('text-anchor', 'middle')
        .style('font-family', FONT_MONO).style('font-size', '8px')
        .style('fill', accent).text(d.tag);
    }
  }

  /* ---- glyphs ---------------------------------------------------------- */

  var GLYPHS = {
    theatre: function (g, d, a) {                        /* double doors */
      g.attr('transform', 'translate(20,50)');
      g.append('rect').attr('width', 30).attr('height', 34).attr('rx', 2)
        .style('fill', 'none').style('stroke', a).style('stroke-width', 1.4);
      g.append('line').attr('x1', 15).attr('x2', 15).attr('y1', 0).attr('y2', 34)
        .style('stroke', a).style('stroke-width', 1.4);
      g.append('circle').attr('cx', 11).attr('cy', 18).attr('r', 1.6).style('fill', a);
      g.append('circle').attr('cx', 19).attr('cy', 18).attr('r', 1.6).style('fill', a);
      g.append('path').attr('d', 'M6,-6 h18 M15,-12 v12').style('stroke', a).style('stroke-width', 1.6);
    },
    specialist: function (g, d, a) {                     /* masked head */
      g.attr('transform', 'translate(22,52)');
      g.append('path').attr('d', 'M2,10 a12,12 0 0 1 24,0 v2 a12,14 0 0 1 -24,0 z')
        .style('fill', 'none').style('stroke', a).style('stroke-width', 1.4);
      g.append('path').attr('d', 'M2,8 a12,10 0 0 1 24,0 z').style('fill', a).style('opacity', 0.25);
      g.append('rect').attr('x', 3).attr('y', 13).attr('width', 22).attr('height', 11).attr('rx', 3)
        .style('fill', a).style('opacity', 0.55);
      g.append('path').attr('d', 'M3,15 l-6,-4 M25,15 l6,-4').style('stroke', a).style('stroke-width', 1.2);
    },
    immersion: function (g, d, a) {                      /* merging streams */
      g.attr('transform', 'translate(20,46)');
      g.append('path').attr('d', 'M0,4 C14,4 14,18 28,18').style('fill', 'none').style('stroke', C.org).style('stroke-width', 1.8);
      g.append('path').attr('d', 'M0,32 C14,32 14,18 28,18').style('fill', 'none').style('stroke', C.prod).style('stroke-width', 1.8);
      g.append('circle').attr('cx', 30).attr('cy', 18).attr('r', 4.5).style('fill', a);
    },
    physician: function (g, d, a) {                      /* stethoscope-ish */
      g.attr('transform', 'translate(22,46)');
      g.append('path').attr('d', 'M2,0 v10 a10,10 0 0 0 20,0 v-10')
        .style('fill', 'none').style('stroke', a).style('stroke-width', 1.5);
      g.append('circle').attr('cx', 12).attr('cy', 28).attr('r', 6)
        .style('fill', 'none').style('stroke', a).style('stroke-width', 1.5);
      g.append('circle').attr('cx', 12).attr('cy', 28).attr('r', 2).style('fill', a);
    },
    recovery: function (g, d, a) {                       /* bed + pulse */
      g.attr('transform', 'translate(20,40)');
      g.append('path').attr('d', 'M0,20 h30 M0,20 v-8 h10 a4,4 0 0 1 4,4 v4')
        .style('fill', 'none').style('stroke', a).style('stroke-width', 1.5);
      g.append('path').attr('d', 'M0,32 l6,0 l3,-8 l4,14 l4,-6 l13,0')
        .style('fill', 'none').style('stroke', a).style('stroke-width', 1.3).style('opacity', 0.8);
    },
    lens: function (g, d, a) {                           /* magnifier */
      g.attr('transform', 'translate(20,48)');
      g.append('circle').attr('cx', 13).attr('cy', 13).attr('r', 10)
        .style('fill', 'none').style('stroke', a).style('stroke-width', 1.6);
      g.append('line').attr('x1', 20).attr('y1', 20).attr('x2', 29).attr('y2', 29)
        .style('stroke', a).style('stroke-width', 2);
    }
  };

  function drawSack(g, x, y, s, fill) {
    s = s || 1;
    var k = g.append('g').attr('transform', 'translate(' + x + ',' + y + ') scale(' + s + ')');
    k.append('path')
      .attr('d', 'M-9,-3 C-12,9 -7,16 0,16 C7,16 12,9 9,-3 z')
      .style('fill', fill || C.raw).style('opacity', 0.85)
      .style('stroke', C.ink).style('stroke-opacity', 0.25).style('stroke-width', 0.8);
    k.append('path')
      .attr('d', 'M-6,-3 l2,-6 h8 l2,6 z')
      .style('fill', fill || C.raw).style('opacity', 0.55);
    k.append('path').attr('d', 'M-6,-3 h12').style('stroke', C.ground).style('stroke-width', 1.4);
    k.append('text').attr('y', 9).attr('text-anchor', 'middle')
      .style('font-family', FONT_MONO).style('font-size', '7px')
      .style('fill', C.surface).text('$');
    return k;
  }

  function drawPerson(g, x, y) {
    var k = g.attr('transform', 'translate(' + x + ',' + y + ')');
    k.append('circle').attr('cx', 0).attr('cy', -34).attr('r', 7)
      .style('fill', 'none').style('stroke', C.muted).style('stroke-width', 1.6);
    k.append('path').attr('d', 'M0,-27 v18')
      .style('stroke', C.muted).style('stroke-width', 1.6);
    k.append('path').attr('d', 'M0,-9 l-8,16 M0,-9 l8,16')
      .style('fill', 'none').style('stroke', C.muted).style('stroke-width', 1.6);
    k.append('path').attr('d', 'M0,-22 l-10,7')                     /* free arm */
      .style('stroke', C.muted).style('stroke-width', 1.6);
    k.append('path').attr('d', 'M0,-22 l12,-9')                     /* throwing arm */
      .style('stroke', C.muted).style('stroke-width', 1.6);
    drawSack(k, 16, -36, 0.62);
    return k;
  }

  function drawGurney(g, cx, cy, sacks) {
    var k = g.attr('transform', 'translate(' + cx + ',' + cy + ')');
    /* stacked sacks, pyramid */
    var rows = [[-26, 0], [0, 0], [26, 0], [-13, -20], [13, -20], [0, -40]];
    rows.slice(0, Math.max(1, Math.min(sacks + 2, rows.length))).forEach(function (p) {
      drawSack(k, p[0], p[1] - 16, 0.78);
    });
    /* bed */
    k.append('rect').attr('x', -58).attr('y', 4).attr('width', 116).attr('height', 8).attr('rx', 3)
      .style('fill', C.line2);
    k.append('path').attr('d', 'M-58,12 v10 M58,12 v10 M-58,8 h-10 v-14')
      .style('fill', 'none').style('stroke', C.line2).style('stroke-width', 2);
    k.append('circle').attr('cx', -46).attr('cy', 26).attr('r', 5)
      .style('fill', 'none').style('stroke', C.muted).style('stroke-width', 1.6);
    k.append('circle').attr('cx', 46).attr('cy', 26).attr('r', 5)
      .style('fill', 'none').style('stroke', C.muted).style('stroke-width', 1.6);
    return k;
  }

  function drawDoctor(g, x, y) {
    var k = g.attr('transform', 'translate(' + x + ',' + y + ')');
    k.append('path').attr('d', 'M-9,-30 a9,9 0 0 1 18,0 v4 a9,10 0 0 1 -18,0 z')
      .style('fill', 'none').style('stroke', C.accent).style('stroke-width', 1.5);
    k.append('path').attr('d', 'M-9,-31 a9,7 0 0 1 18,0 z')            /* cap */
      .style('fill', C.accent).style('opacity', 0.3);
    k.append('rect').attr('x', -8).attr('y', -25).attr('width', 16).attr('height', 8).attr('rx', 2)
      .style('fill', C.accent).style('opacity', 0.55);                  /* mask */
    k.append('path').attr('d', 'M-10,-14 h20 l4,22 h-28 z')             /* scrubs */
      .style('fill', C.accent).style('opacity', 0.14)
      .style('stroke', C.accent).style('stroke-width', 1.2);
    k.append('path').attr('d', 'M10,-10 l22,6')                          /* arms to handle */
      .style('stroke', C.accent).style('stroke-width', 1.5);
    return k;
  }

  /* ---- defs ------------------------------------------------------------ */

  function buildDefs(svg) {
    var defs = svg.append('defs');
    ['raw', 'org', 'prod', 'integ', 'classed', 'muted'].forEach(function (k) {
      defs.append('marker')
        .attr('id', 'sp-arrow-' + k)
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 9).attr('refY', 5)
        .attr('markerWidth', 6).attr('markerHeight', 6)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('d', 'M0,1 L9,5 L0,9 z')
        .style('fill', C[k] || C.muted);
    });
  }

  /* ---- flowing tokens --------------------------------------------------- */

  function startFlow(layer, linkSel) {
    var paths = [];
    linkSel.each(function (d) {
      if (d.side === 'self' || d.side === 'short') return;   /* too short to read */
      paths.push({ node: this, kind: d.kind, len: this.getTotalLength() });
    });

    var tokens = [];
    paths.forEach(function (p, i) {
      var n = p.len > 260 ? 2 : 1;
      for (var j = 0; j < n; j++) {
        tokens.push({ p: p, t: (i * 0.37 + j / n) % 1, speed: 0.055 + (p.len / 9000) });
      }
    });

    var sel = layer.selectAll('g.sp-token').data(tokens).join('g').attr('class', 'sp-token');
    sel.each(function (d) { drawSack(d3.select(this), 0, 0, 0.5, C[d.kind]); });

    var last = 0;
    d3.timer(function (elapsed) {
      var dt = Math.min(60, elapsed - last) / 1000; last = elapsed;
      sel.attr('transform', function (d) {
        d.t = (d.t + d.speed * dt) % 1;
        var pt = d.p.node.getPointAtLength(d.t * d.p.len);
        return 'translate(' + pt.x + ',' + (pt.y - 6) + ')';
      }).style('opacity', function (d) {
        return Math.min(1, Math.sin(Math.PI * d.t) * 2.2);   /* fade in and out at the ends */
      });
    });
  }

  /* ---- legend ----------------------------------------------------------- */

  function drawLegend(svg) {
    var items = [
      { c: C.raw,     t: 'Raw spend data' },
      { c: C.org,     t: 'Organizations / suppliers' },
      { c: C.prod,    t: 'Products' },
      { c: C.integ,   t: 'Integrated record' },
      { c: C.classed, t: 'Classified spend' }
    ];
    var g = svg.append('g').attr('transform', 'translate(48,' + (H - 60) + ')');
    g.append('text').attr('x', 0).attr('y', 0)
      .style('font-family', FONT_MONO).style('font-size', '10px')
      .style('letter-spacing', '.14em').style('text-transform', 'uppercase')
      .style('fill', C.faint).text('Streams');
    var x = 0;
    items.forEach(function (it) {
      var e = g.append('g').attr('transform', 'translate(' + x + ',18)');
      e.append('line').attr('x1', 0).attr('x2', 22).attr('y1', 0).attr('y2', 0)
        .style('stroke', it.c).style('stroke-width', 2.4);
      e.append('text').attr('x', 30).attr('y', 4)
        .style('font-size', '12px').style('fill', C.muted).text(it.t);
      x += 40 + it.t.length * 6.6;
    });
  }

  /* ---------------------------------------------------------------------- */

  global.renderSpendPipeline = renderSpendPipeline;
  global.spendPipelineSpec = { LANES: LANES, ROOMS: ROOMS, LINKS: LINKS };

})(window);
