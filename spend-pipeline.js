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
    classed: '#9A6B12',   /* classified spend */
    rework:  '#7E5AA0'    /* sent back from sign-off for updates */
  };

  var FONT_SANS = 'var(--sans, "Segoe UI", system-ui, sans-serif)';
  var FONT_MONO = 'var(--mono, ui-monospace, Consolas, monospace)';

  /* =========================================================================
     THE HANDOFF — the two hero diagrams are one story. The packet travels the
     pipeline and reaches 12 Customer; only then does the access diagram show it
     dividing among the roles. The compact variant announces each arrival, the
     access variant waits for one.

     Render order does not matter: both timers first tick on the frame after all
     synchronous render calls, so HAS_PACER is settled before it is read. With
     no compact variant on the page (the refinement harness, a page that embeds
     only the access diagram) nothing ever announces, so the access variant
     detects that and free-runs instead of sitting frozen.
     ========================================================================= */

  var ARRIVALS = [];
  var HAS_PACER = false;
  function onArrival(fn) { ARRIVALS.push(fn); }
  function announceArrival() { ARRIVALS.forEach(function (f) { f(); }); }

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
    { id: 'intake',   minH: 118, label: '01 · Data intake',            note: 'contributors hand over spend data' },
    { id: 'receive',  minH: 168, label: '02 · Receiving',         note: 'sacks stacked onto gurneys' },
    { id: 'transit',  minH: 96,  label: '03 · Transport',         note: 'wheeled through by data operations' },
    { id: 'theatre',  label: '04 · Record processing & compression',   note: 'one gurney, one room' },
    { id: 'split',    label: '05 · Record split',        note: 'organizations and products, same record id' },
    { id: 'suites',   label: '06 · Enrichment', note: 'supplier and product, worked in parallel' },
    { id: 'immerse',  label: '07 · Match & merge',         note: 'knowledge integration' },
    { id: 'classify', label: '08 · Spend classification',    note: 'the spend gets a name' },
    { id: 'recovery', label: '09 · Ready for review',          note: 'integrated and classified, resting' },
    { id: 'review',   label: '10 · Validation',        note: 'three independent checks' }
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
      steps: ['6.1 Assign unique record id',
              '6.2 Dissect into organizations + products',
              '6.3 Both halves inherit the record id'] },
    { id: 'or2', kind: 'room', lane: 'theatre', x: 445, w: 350, glyph: 'theatre',
      title: 'Operating room 2', tag: 'OR-2',
      steps: ['6.1 Assign unique record id',
              '6.2 Dissect into organizations + products',
              '6.3 Both halves inherit the record id'] },
    { id: 'or3', kind: 'room', lane: 'theatre', x: 830, w: 350, glyph: 'theatre',
      title: 'Operating room 3', tag: 'OR-3',
      steps: ['6.1 Assign unique record id',
              '6.2 Dissect into organizations + products',
              '6.3 Both halves inherit the record id'] },

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
              '8.3 Integrate the enriched organization by record id'] },

    /* ---- 07 · immersion -------------------------------------------------- */
    { id: 'immersion', kind: 'room', lane: 'immerse', x: 330, w: 580, glyph: 'immersion', accent: C.integ,
      title: 'Match & merge', tag: '7.5 → 8.3',
      steps: ['Enriched organizations held against their record id, ready to be rejoined to product'] },

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

    /* Named to match the compact variant's CLASS_OUTPUTS. This renderer has no
       subscript support, so they read as plain text until it catches up. */
    { id: 'tax1',    kind: 'chip', lane: 'review', x: 840,  dy: 126, w: 104, h: 38, accent: C.classed, title: 'Taxonomy 1' },
    { id: 'tax2',    kind: 'chip', lane: 'review', x: 956,  dy: 126, w: 104, h: 38, accent: C.classed, title: 'Taxonomy 2' },
    { id: 'taxn',    kind: 'chip', lane: 'review', x: 1072, dy: 126, w: 108, h: 38, accent: C.classed, title: 'Taxonomy n' }
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

    { from: 'chkClass', to: 'tax1',    kind: 'classed', side: 'short' },
    { from: 'chkClass', to: 'tax2',    kind: 'classed', side: 'short' },
    { from: 'chkClass', to: 'taxn',    kind: 'classed', side: 'short' }
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

  /* Rail stages. The two-branch section (05a / 05b) is not on this list - it is
     laid out separately between SPLIT_AT-1 and SPLIT_AT. */
  var STAGES = [
    { n: '01', t: 'Data intake',                s: 'sacks of spend data handed over',        g: 'person', c: 'raw' },
    { n: '02', t: 'Staging & batching', s: 'stacked onto gurneys, wheeled through',  g: 'gurney', c: 'raw' },
    { n: '03', t: 'Record processing & compression',       s: 'record id assigned, record dissected',  g: 'doors',  c: 'raw' },
    { n: '04', t: 'Record split',            s: 'splits into branches, one record id', g: 'split',  c: 'raw' },
    { n: '06', t: 'Match & merge',             s: 'the two branches reunite \u2014 knowledge integration', g: 'merge',     c: 'integ', dx: 130 },
    { n: '07', t: 'Spend classification',        s: 'the unified record gets a name',         g: 'physician', c: 'classed' },
    { n: '08', t: 'Ready for review',              s: 'integrated and classified',              g: 'bed',       c: 'classed', dx: 130 },
    { n: '09', t: 'Validation',            s: 'supplier \u00b7 OEM \u00b7 classification · contract',    g: 'lens',      c: 'classed', dx: 130 }
  ];
  var SPLIT_AT = 4;              /* stages drawn before the two-branch section */

  /* Not everything is spend-classified. Contracts and business hierarchy leave
     match & merge on their own path, through their own stage, and rejoin at
     ready for review. BYPASS lists the specialists whose work takes it. */
  var OTHER = { n: '07b', t: 'Other processing', s: 'contracts · business hierarchy',
                g: 'cog', c: 'integ' };
  var BYPASS = [2, 5];           /* contract, business hierarchy */

  /* Dissection produces two separate branches - organizations and product
     information - which feed one specialist bench. Each specialist / AI cleans,
     normalizes and enriches its own slice. `c` says which branch feeds it, and
     colours its dot. */
  var SPECIALISTS = [
    { t: 'Supplier', s: 'organizations · vendors',   g: 'org',      c: 'org'   },
    { t: 'Product',  s: 'descriptions · attributes', g: 'box',      c: 'prod'  },
    { t: 'Contract', s: 'terms · obligations',       g: 'doc',      c: 'org'   },
    { t: 'Pricing',  s: 'competitive price',            g: 'tag',      c: 'prod'  },
    { t: 'Spend',    s: 'leakage · outliers',        g: 'spike',    c: 'prod',
      t2: 'anomaly' },
    { t: 'Business', s: 'parentage · ownership',      g: 'hier',     c: 'org',
      t2: 'hierarchy' }
  ];

  /* The two branches out of dissection. xf is where each enters the bench. */
  var TRACKS = [
    { c: 'org',  xf: 0.30 },
    { c: 'prod', xf: 0.70 }
  ];

  /* The review lab splits three ways; only the classification branch
     sub-divides into the three spend types. */
  var REVIEW_BRANCHES = [
    { id: 'sup', t: 'Supplier',       c: 'org' },
    { id: 'oem', t: 'OEM',            c: 'prod' },
    { id: 'cls', t: 'Classification', c: 'classed' },
    { id: 'con', t: 'Contract',       c: 'org' }
  ];
  /* The classification branch fans out into the customer's own taxonomies.
     Numbered rather than named: a website reader has no idea what TBM or
     Non-Tech mean, and the useful claim is not which taxonomies exist but that
     any number of them can be produced. The ellipsis after CLASS_GAP_AFTER is
     what carries "1 to n" rather than "exactly three". */
  var CLASS_OUTPUTS = [
    { t: 'Taxonomy', sub: '1' },
    { t: 'Taxonomy', sub: '2' },
    { t: 'Taxonomy', sub: 'n' }
  ];
  var CLASS_GAP_AFTER = 1;      /* the ellipsis sits after this chip index */

  /* Everything the review lab produces is packaged, then seen by the customer. */
  var TAIL = [
    { n: '10', t: 'Publish', s: 'deployed to QA \u2192 approved for viewing', g: 'package',  c: 'integ' },
    { n: '12', t: 'Customer',  s: 'eyes and hands on the result',             g: 'customer', c: 'integ' }
  ];

  /* Returns into processing. All three route up the left gutter: the right-hand
     side is full of label text, and a return routed round it crossed every
     stage caption on the way back. Colour carries which branch each one is. */
  /* `from` is the review branch, `to` the specialist it feeds back into. */
  var FEEDBACK = [
    { from: 0, to: 0, gutter: 'L', label: '11.1 supplier to history' },
    { from: 1, to: 0, gutter: 'L', label: '11.2 OEM to history' },
    { from: 2, to: 1, gutter: 'R', label: '11.3 classification to product specialist' },
    { from: 3, to: 2, gutter: 'R', label: '11.4 contract to contract specialist' }
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
    org: function (g, c) {
      g.append('rect').attr('x', -7).attr('y', -6).attr('width', 14).attr('height', 13)
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.2);
      [[-4,-3],[0,-3],[4,-3],[-4,1],[0,1],[4,1]].forEach(function (q) {
        g.append('rect').attr('x', q[0] - 1).attr('y', q[1]).attr('width', 2.4).attr('height', 2.4).style('fill', c);
      });
    },
    box: function (g, c) {
      g.append('path').attr('d', 'M-7,-3 l7,-4 l7,4 v8 l-7,4 l-7,-4 z')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.2);
      g.append('path').attr('d', 'M-7,-3 l7,4 l7,-4 M0,1 v8').style('fill', 'none')
        .style('stroke', c).style('stroke-width', 1).style('opacity', .7);
    },
    doc: function (g, c) {
      g.append('path').attr('d', 'M-6,-8 h8 l4,4 v12 h-12 z')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.2);
      g.append('path').attr('d', 'M2,-8 v4 h4').style('fill', 'none').style('stroke', c).style('stroke-width', 1);
      [(-1),2,5].forEach(function (y) {
        g.append('line').attr('x1', -3.5).attr('x2', 3.5).attr('y1', y).attr('y2', y)
          .style('stroke', c).style('stroke-width', .9).style('opacity', .65);
      });
    },
    tag: function (g, c) {
      g.append('path').attr('d', 'M-7,-2 l6,-6 h8 v8 l-6,6 z')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.2);
      g.append('circle').attr('cx', 3.5).attr('cy', -3.5).attr('r', 1.6).style('fill', c);
    },
    cog: function (g, c) {
      g.append('circle').attr('r', 4.5).style('fill', 'none').style('stroke', c).style('stroke-width', 1.3);
      for (var a = 0; a < 6; a++) {
        var r1 = 6, r2 = 8.6, t = a * Math.PI / 3;
        g.append('line')
          .attr('x1', Math.cos(t) * r1).attr('y1', Math.sin(t) * r1)
          .attr('x2', Math.cos(t) * r2).attr('y2', Math.sin(t) * r2)
          .style('stroke', c).style('stroke-width', 1.6).style('stroke-linecap', 'round');
      }
    },
    hier: function (g, c) {
      g.append('rect').attr('x', -4).attr('y', -9).attr('width', 8).attr('height', 5).attr('rx', 1)
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.2);
      g.append('path').attr('d', 'M0,-4 v3 M-6,-1 h12 M-6,-1 v3 M6,-1 v3 M0,-1 v3')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.1);
      [-6, 0, 6].forEach(function (x) {
        g.append('rect').attr('x', x - 3.5).attr('y', 2).attr('width', 7).attr('height', 5).attr('rx', 1)
          .style('fill', 'none').style('stroke', c).style('stroke-width', 1.2);
      });
    },
    spike: function (g, c) {
      g.append('path').attr('d', 'M-8,4 l4,0 l2,-9 l3,13 l2,-6 l5,0')
        .style('fill', 'none').style('stroke', c).style('stroke-width', 1.4);
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

  /* A patient chart on a clipboard: held closed, the page lifts to be read, then
     drops back. Returns handles so the animation can drive the states without a
     timer of its own. */
  function drawChart(g, col) {
    var closed = g.append('g');
    closed.append('rect').attr('x', -9).attr('y', -11).attr('width', 18).attr('height', 23).attr('rx', 2)
      .style('fill', C.surface).style('stroke', col).style('stroke-width', 1.3);
    closed.append('rect').attr('x', -4).attr('y', -13).attr('width', 8).attr('height', 4).attr('rx', 1.5)
      .style('fill', col);
    [-5, -1, 3, 7].forEach(function (y) {
      closed.append('line').attr('x1', -5).attr('x2', 5).attr('y1', y).attr('y2', y)
        .style('stroke', col).style('stroke-width', 1).style('opacity', .45);
    });

    /* the lifted page, hinged at the clip */
    var open = g.append('g').style('opacity', 0);
    var page = open.append('g');
    page.append('rect').attr('x', -9).attr('y', -11).attr('width', 18).attr('height', 23).attr('rx', 2)
      .style('fill', C.surface).style('stroke', col).style('stroke-width', 1.3);
    [-5, -1, 3, 7].forEach(function (y) {
      page.append('line').attr('x1', -5).attr('x2', 5).attr('y1', y).attr('y2', y)
        .style('stroke', col).style('stroke-width', 1).style('opacity', .55);
    });
    var scan = open.append('line').attr('x1', -6).attr('x2', 6)
      .style('stroke', col).style('stroke-width', 1.6).style('opacity', .9);

    return {
      /* t: 0 shut, 1 fully lifted. read: 0..1 drives the scan line. */
      set: function (t, read) {
        open.style('opacity', t <= 0 ? 0 : 1);
        if (t > 0) {
          page.attr('transform', 'translate(0,-11) rotate(' + (-34 * t) + ') translate(0,11)');
          var y = -6 + 13 * Math.max(0, Math.min(1, read));
          scan.attr('y1', y).attr('y2', y).style('opacity', read > 0 && read < 1 ? .9 : 0);
        }
      }
    };
  }

  /* =========================================================================
     ACCESS VARIANT — what happens after publish: the customer decides who sees
     which records, scoped on their own hierarchy. Sized for a narrow column, so
     it sits beside the pipeline rather than extending it.

         renderSpendPipeline('#el', { variant: 'access' })
     ========================================================================= */

  /* Columns in the customer's own data. A role is a combination of one or more
     of these column values, which is what decides the records it can see. */
  var ACCESS_COLS = ['Department', 'Cost centre', 'GL account', 'Legal entity'];

  /* Each role, and the column values that define it. Keep at least one showing
     two columns combined — that is what makes 'one or more' legible. */
  var ROLES = [
    { t: 'Finance',   s: 'Cost centre = all' },
    { t: 'IT',        s: 'GL account = 6xxx' },
    { t: 'Plant ops', s: 'Department = 400 + GL = 6xxx' }
  ];

  function renderAccess(root, animate) {
    var W = 440, R = 16;
    var CX = 44, CY = 34;                       /* the customer */
    var BX = 16, BY = 96, BW = W - 32, BH = 158; /* the rules box */
    var SPINE = 44, A0 = 314, AGAP = 42;         /* role rows, clear of the box */
    var CHIP_X = 62, CHIP_W = 116, CHIP_H = 26;
    var H = A0 + (ROLES.length - 1) * AGAP + 46;

    var svg = root.append('svg')
      .attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('preserveAspectRatio', 'xMidYMin meet')
      .attr('role', 'img')
      .attr('aria-label', 'After publish, the customer decides who sees which records. ' +
            'Roles based access rules are defined by information from the customer — built from columns in their own data such as department, cost ' +
            'centre, GL account and legal entity \u2014 so each role sees only its own slice: ' +
            'finance every cost centre, IT only GL 6xxx, plant operations only department 400.')
      .style('width', '100%').style('height', 'auto').style('display', 'block')
      .style('font-family', FONT_SANS);

    buildDefs(svg);
    var gBack = svg.append('g'), gRail = svg.append('g'),
        gFlow = svg.append('g'), gNode = svg.append('g');

    /* ---- the customer ---------------------------------------------------- */
    var g = gNode.append('g').attr('transform', 'translate(' + CX + ',' + CY + ')');
    g.append('circle').attr('r', R).style('fill', C.surface).style('stroke', C.integ).style('stroke-width', 1.5);
    g.append('circle').attr('r', R).style('fill', C.integ).style('opacity', .10);
    MINI.customer(g.append('g'), C.integ);
    gNode.append('text').attr('x', CX + R + 14).attr('y', CY - 1)
      .style('font-size', '13px').style('font-weight', 650).style('fill', C.ink).text('Customer');
    gNode.append('text').attr('x', CX + R + 14).attr('y', CY + 15)
      .style('font-size', '11.5px').style('fill', C.muted).text('decides who sees which records');

    gRail.append('path')
      .attr('d', 'M' + CX + ',' + (CY + R) + ' C' + CX + ',' + (BY - 24) + ' ' +
                 (BX + BW / 2) + ',' + (BY - 24) + ' ' + (BX + BW / 2) + ',' + BY)
      .style('fill', 'none').style('stroke', C.integ).style('stroke-width', 1.8).style('opacity', .85);

    /* ---- the rules box ---------------------------------------------------- */
    gBack.append('rect').attr('x', BX).attr('y', BY).attr('width', BW).attr('height', BH).attr('rx', 10)
      .style('fill', C.surface).style('stroke', C.line2).style('stroke-width', 1.2);
    gBack.append('path')
      .attr('d', 'M' + BX + ',' + (BY + 10) + ' a10,10 0 0 1 10,-10 h' + (BW - 20) +
                 ' a10,10 0 0 1 10,10 v22 h' + (-BW) + ' z')
      .style('fill', C.ink).style('opacity', .05);
    gNode.append('line').attr('x1', BX).attr('x2', BX + BW).attr('y1', BY + 32).attr('y2', BY + 32)
      .style('stroke', C.line);
    gNode.append('text').attr('x', BX + BW / 2).attr('y', BY + 21).attr('text-anchor', 'middle')
      .style('font-size', '12.5px').style('font-weight', 650).style('fill', C.ink).text('Roles based access rules');
    gNode.append('text').attr('x', BX + BW / 2).attr('y', BY + 50).attr('text-anchor', 'middle')
      .style('font-family', FONT_MONO).style('font-size', '9.5px').style('letter-spacing', '.05em')
      .style('fill', C.faint).text('defined by information from the customer');

    /* dimensions, two by two */
    var dw = (BW - 46) / 2, dh = 26;
    ACCESS_COLS.forEach(function (d, i) {
      var col = i % 2, row = (i / 2) | 0;
      var x = BX + 16 + col * (dw + 14), y = BY + 62 + row * (dh + 10);
      gNode.append('rect').attr('x', x).attr('y', y).attr('width', dw).attr('height', dh).attr('rx', dh / 2)
        .style('fill', C.surface).style('stroke', C.line2).style('stroke-width', 1.1);
      gNode.append('text').attr('x', x + dw / 2).attr('y', y + 17).attr('text-anchor', 'middle')
        .style('font-size', '11px').style('fill', C.muted).text(d);
    });

    gNode.append('text').attr('x', BX + BW / 2).attr('y', BY + BH - 14).attr('text-anchor', 'middle')
      .style('font-size', '11px').style('fill', C.muted)
      .text('a role = one or more of these column values');

    /* ---- down to the roles ------------------------------------------------- */
    var lastY = A0 + (ROLES.length - 1) * AGAP;
    gRail.append('path')
      .attr('d', 'M' + (BX + BW / 2) + ',' + (BY + BH) + ' C' + (BX + BW / 2) + ',' + (BY + BH + 26) + ' ' +
                 SPINE + ',' + (BY + BH + 20) + ' ' + SPINE + ',' + (A0 - 20))
      .style('fill', 'none').style('stroke', C.integ).style('stroke-width', 1.8).style('opacity', .85);
    gRail.append('line').attr('x1', SPINE).attr('x2', SPINE)
      .attr('y1', A0 - 20).attr('y2', lastY)
      .style('stroke', C.integ).style('stroke-width', 1.6).style('opacity', .7);

    /* Sits at BX, not CHIP_X: the connector sweeps down through x ~110 at this
       height, and a label under it needed a halo that broke the line. */
    gNode.append('text').attr('x', BX).attr('y', A0 - 30)
      .style('font-family', FONT_MONO).style('font-size', '9px').style('letter-spacing', '.14em')
      .style('text-transform', 'uppercase').style('fill', C.faint).text('roles');

    ROLES.forEach(function (a, i) {
      var y = A0 + i * AGAP;
      gRail.append('path').attr('d', 'M' + SPINE + ',' + y + ' H' + (CHIP_X - 2))
        .style('fill', 'none').style('stroke', C.integ).style('stroke-width', 1.4).style('opacity', .7)
        .attr('marker-end', 'url(#sp-arrow-integ)');
      gNode.append('rect').attr('x', CHIP_X).attr('y', y - CHIP_H / 2)
        .attr('width', CHIP_W).attr('height', CHIP_H).attr('rx', CHIP_H / 2)
        .style('fill', C.surface).style('stroke', C.integ).style('stroke-width', 1.3);
      gNode.append('text').attr('x', CHIP_X + CHIP_W / 2).attr('y', y + 4).attr('text-anchor', 'middle')
        .style('font-size', '11.5px').style('fill', C.integ).text(a.t);
      gNode.append('text').attr('x', CHIP_X + CHIP_W + 14).attr('y', y + 4)
        .style('font-size', '11px').style('fill', C.muted).text(a.s);
    });

    gNode.append('text').attr('x', BX).attr('y', H - 10)
      .style('font-family', FONT_MONO).style('font-size', '9px').style('letter-spacing', '.06em')
      .style('fill', C.faint).text('one published set \u00b7 each role sees only its own slice');

    /* ---- the packet divides at the rules ---------------------------------- */
    if (animate) {
      var nodes = ROLES.map(function (a, i) {
        var y = A0 + i * AGAP;
        var d = 'M' + CX + ',' + CY +
                ' C' + CX + ',' + (BY - 24) + ' ' + (BX + BW / 2) + ',' + (BY - 24) + ' ' + (BX + BW / 2) + ',' + BY +
                ' V' + (BY + BH) +
                ' C' + (BX + BW / 2) + ',' + (BY + BH + 26) + ' ' + SPINE + ',' + (BY + BH + 20) + ' ' +
                       SPINE + ',' + (A0 - 20) +
                ' V' + y + ' H' + (CHIP_X - 2);
        return gFlow.append('path').attr('class', 'a-branch').attr('d', d)
          .style('fill', 'none').style('stroke', 'none').node();
      });
      var lens = nodes.map(function (n) { return n.getTotalLength(); });
      var maxLen = Math.max.apply(null, lens);
      var SPEED = 105, HOLD = 90, FADE = 24;

      var tokens = gFlow.selectAll('g.a-token').data(nodes).join('g').attr('class', 'a-token');
      tokens.each(function () { drawSack(d3.select(this), 0, 0, 0.42, C.integ); });

      /* Idle is not blank: the packet parks on the customer at length 0 and
         stays visible, so the panel reads as waiting for the handoff rather
         than as broken during the ten-odd seconds a pipeline lap takes. */
      var running = false, travelled = 0, last = 0;
      onArrival(function () { running = true; travelled = 0; });

      d3.timer(function (el) {
        var dt = Math.min(60, el - last) / 1000; last = el;
        if (running) {
          travelled += SPEED * dt;
          if (travelled > maxLen + HOLD) { running = false; travelled = 0; }
        } else if (!HAS_PACER) {
          running = true;                    /* nothing to wait for — free-run */
        }

        var seen = [];
        tokens.each(function (n, i) {
          var L = lens[i], dd = Math.min(travelled, L);
          var pt = nodes[i].getPointAtLength(dd);
          var key = Math.round(pt.x) + ':' + Math.round(pt.y);
          var dup = seen.indexOf(key) >= 0; seen.push(key);
          var op = dup ? 0 : 1;
          if (running && travelled < FADE) op *= travelled / FADE;
          if (travelled > L) op *= Math.max(0.3, 1 - (travelled - L) / HOLD);
          d3.select(this).attr('transform', 'translate(' + pt.x + ',' + pt.y + ')').style('opacity', op);
        });
      });
    }

    return svg;
  }

  function renderCompact(root, animate) {
    var GAP = 54, TOP = 34, RAIL = 40, R = 16;
    var TX = RAIL + R + 16, CHIP_H = 28, CHIP_GAP = 10;

    function chipW(t) { return Math.max(74, t.length * 6.7 + 28); }

    /* ---- the specialist building, sized first: the vertical layout below
       depends on BOX_H ------------------------------------------------------ */
    var SPEC_NOTE = 'clean \u00b7 normalize \u00b7 enrich';
    var BOX_W = 424, ROOF = 10, SPEC_R = 15;   /* sized for six specialists */
    var CY_OFF = 96;                                /* circle centres, from box top */
    var BOX_H = CY_OFF + 58;

    var SPX = SPECIALISTS.map(function (e, k) {
      return { t: e.t, t2: e.t2, s: e.s, g: e.g, c: e.c,
               cx: TX + BOX_W * (k + 0.5) / SPECIALISTS.length };
    });
    var SP = TRACKS.map(function (t) { return { c: t.c, cx: TX + BOX_W * t.xf }; });

    /* ---- vertical layout -------------------------------------------------- */
    var stageY = [];
    for (var i = 0; i < SPLIT_AT; i++) stageY.push(TOP + i * GAP);
    var yDis  = stageY[SPLIT_AT - 1];
    var ySpec = yDis + 82;
    var cy    = ySpec + CY_OFF;
    var yImm  = ySpec + BOX_H + 74;
    for (var j = 0; j < STAGES.length - SPLIT_AT; j++) stageY.push(yImm + j * GAP);
    var lastY  = stageY[stageY.length - 1];
    var fanTop = lastY + R;

    var Y1 = lastY + 74, Y2 = Y1 + 66, YC = Y2 + 46;
    var YG = YC + 50;                               /* 09b sign-off gate */
    var YP = YG + 66, YU = YP + 62;
    var CH = YU + 56;
    var RG = 20;                                    /* gate badge radius */

    var OTHER_X = TX + 228;                        /* the bypass badge, clear of 07's caption */
    /* The 06 -> (07 | 07b) -> 08 diamond. 06 and 08 sit on the axis midway
       between the two paths, so both forks and both joins are symmetric. */
    var MMX = RAIL + (STAGES[SPLIT_AT].dx || 0);
    var X07 = RAIL + (STAGES[SPLIT_AT + 1].dx || 0);
    var X08 = RAIL + (STAGES[SPLIT_AT + 2].dx || 0);
    var X09 = RAIL + (STAGES[SPLIT_AT + 3].dx || 0);   /* validation, below ready for review */
    var midA = (yDis + ySpec) / 2;
    var midB = (ySpec + BOX_H + yImm) / 2;

    /* ---- review branches and classification outputs ----------------------- */
    /* The non-classification branches drop straight past the classification
       outputs on their way to the collector, so the branch row has to be wide
       enough for each drop to clear those chips rather than vanish behind them.

       The gap is DERIVED, not fixed. It was 36, tuned when the outputs were
       TBM / Level 1 / Non-Tech; the taxonomy chips are wider, and 36 put the OEM
       and Contract drops behind Taxonomy₁ and Taxonomyₙ. Sizing the output row
       first and solving for the gap keeps the drops clear whatever the outputs
       are called, and however many there are. */

    /* Subscripts are narrower than the digits chipW assumes, so the chips come
       out slightly generous — which is what we want, they are the widest row. */
    var OGAP = 8, ELL = 22;        /* gap between chips, and the wider elided gap */
    var ows = CLASS_OUTPUTS.map(function (o) { return chipW(o.t + o.sub); });
    var oTot = ows.reduce(function (m, v) { return m + v; }, 0) +
               (ows.length - 1) * OGAP + ELL;

    var CLASS_AT = 2;              /* the branch the outputs hang from */
    var DROP_CLEAR = 16;           /* daylight between a drop and the nearest chip edge */
    var bws = REVIEW_BRANCHES.map(function (r) { return chipW(r.t); });
    /* Half the output row, less half of each neighbouring chip, is how far apart
       the two flanking branches have to be. Solve both sides, take the worse. */
    var REVIEW_GAP = Math.max(36, Math.ceil(Math.max(
      oTot / 2 + DROP_CLEAR - bws[CLASS_AT - 1] / 2 - bws[CLASS_AT] / 2,
      oTot / 2 + DROP_CLEAR - bws[CLASS_AT] / 2 - bws[CLASS_AT + 1] / 2)));

    var bx = TX, B = REVIEW_BRANCHES.map(function (r, k) {
      var e = { t: r.t, c: r.c, x: bx, w: bws[k], cx: bx + bws[k] / 2 };
      bx += bws[k] + REVIEW_GAP; return e;
    });
    var ox = B[CLASS_AT].cx - oTot / 2;   /* centred under the classification branch */
    var ellX = 0;
    var O = CLASS_OUTPUTS.map(function (o, k) {
      var e = { t: o.t, sub: o.sub, x: ox, w: ows[k], cx: ox + ows[k] / 2 };
      ox += ows[k] + OGAP;
      if (k === CLASS_GAP_AFTER) { ellX = ox - OGAP + (OGAP + ELL) / 2; ox += ELL; }
      return e;
    });

    /* ---- extents ----------------------------------------------------------- */
    var last = B[B.length - 1];
    var rawLeft  = Math.min(RAIL - R, B[0].x, O[0].x, TX);
    var rawRight = Math.max(last.x + last.w, O[O.length - 1].x + O[O.length - 1].w,
                            TX + BOX_W, TX + 230);
    var GL  = rawLeft - 14;                          /* feedback lane 1    */
    var RWL = rawLeft - 40;                          /* rework return lane */
    var GR  = rawRight + 30;                         /* right return lane  */
    var contentLeft  = rawLeft - 80;
    var contentRight = GR + 14;
    var contentW = contentRight - contentLeft;
    var CW = Math.max(520, contentW + 24);
    var vbX = contentLeft - (CW - contentW) / 2;

    var svg = root.append('svg')
      .attr('viewBox', vbX + ' 0 ' + CW + ' ' + CH)
      .attr('preserveAspectRatio', 'xMidYMin meet')
      .attr('role', 'img')
      .attr('aria-label', 'Spend data pipeline. Raw spend data is taken in and dissected into two ' +
            'branches - organizations and product information. Both enter the specialists building, ' +
            'where supplier, product, contract, pricing, spend anomaly and business hierarchy ' +
            'specialists clean, normalize ' +
            'and enrich their own slice, and the work then leaves and is matched and merged back into one record. ' +
            'The unified record is classified, recovered, and checked in the review lab along supplier, ' +
            'OEM, classification and contract branches, classification splitting into the ' +
            'customer taxonomies, taxonomy one through taxonomy n. ' +
            'Sign-off reads the chart and either approves the work to packaging and the customer, or ' +
            'sends it back to the review lab. Findings feed back to the specialists.')
      .style('width', '100%').style('height', 'auto').style('display', 'block')
      .style('font-family', FONT_SANS);

    buildDefs(svg);
    /* Layer order matters: fills sit UNDER the tokens, or a packet travelling
       inside the building is hidden by the building's own background. */
    var gBack = svg.append('g'),   /* solid fills (the building)      */
        gRail = svg.append('g'),   /* connector lines                 */
        gFlow = svg.append('g'),   /* travelling packets              */
        gNode = svg.append('g');   /* badges, circles, chips, text    */

    /* A stage may sit off the rail (dx), which turns its connectors into
       diagonals — used so the edge into spend classification is visible. */
    function stageX(k) { return RAIL + (STAGES[k].dx || 0); }

    /* ---- rail connectors, skipping the building ---------------------------- */
    STAGES.forEach(function (st, k) {
      if (k === SPLIT_AT - 1 || k === STAGES.length - 1) return;
      var x1 = stageX(k), x2 = stageX(k + 1);
      var y1 = stageY[k] + R, y2 = stageY[k + 1] - R, my = (y1 + y2) / 2;
      var d = (x1 === x2)
        ? 'M' + x1 + ',' + y1 + ' V' + y2
        : 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + my + ' ' + x2 + ',' + my + ' ' + x2 + ',' + y2;
      gRail.append('path').attr('d', d)
        .style('fill', 'none').style('stroke', C[st.c]).style('stroke-width', 1.8).style('opacity', .85);
    });

    /* ---- badges ------------------------------------------------------------ */
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
    STAGES.forEach(function (st, k) { badge(stageX(k), stageY[k], st, C[st.c]); });

    /* ---- dissection into the building, and out again to immersion ---------- */
    SP.forEach(function (e) {
      gRail.append('path')
        .attr('d', 'M' + RAIL + ',' + (yDis + R) + ' C' + RAIL + ',' + midA + ' ' +
                   e.cx + ',' + midA + ' ' + e.cx + ',' + ySpec)
        .style('fill', 'none').style('stroke', C[e.c]).style('stroke-width', 1.6).style('opacity', .8);
      gRail.append('path')
        .attr('d', 'M' + e.cx + ',' + (ySpec + BOX_H) + ' C' + e.cx + ',' + midB + ' ' +
                   MMX + ',' + midB + ' ' + MMX + ',' + (yImm - R))
        .style('fill', 'none').style('stroke', C[e.c]).style('stroke-width', 1.6).style('opacity', .8);
    });

    /* ---- the specialist building ------------------------------------------- */
    gBack.append('rect').attr('x', TX - 9).attr('y', ySpec).attr('width', BOX_W + 18).attr('height', ROOF)
      .attr('rx', 3).style('fill', C.ink).style('opacity', .10);
    gBack.append('rect').attr('x', TX).attr('y', ySpec + ROOF).attr('width', BOX_W).attr('height', BOX_H - ROOF)
      .attr('rx', 6).style('fill', C.surface).style('stroke', C.line2).style('stroke-width', 1.2);

    var sign = gNode.append('text').attr('x', TX + BOX_W / 2).attr('y', ySpec + ROOF + 24)
      .attr('text-anchor', 'middle')
      .style('font-size', '12.5px').style('font-weight', 650).style('fill', C.ink)
      .style('paint-order', 'stroke').style('stroke', C.surface).style('stroke-width', 3.5);
    sign.append('tspan').style('font-family', FONT_MONO).style('font-size', '10px')
      .style('font-weight', 400).style('fill', C.muted).text('05  ');
    sign.append('tspan').text('Enrichment');
    gNode.append('text').attr('x', TX + BOX_W / 2).attr('y', ySpec + ROOF + 40).attr('text-anchor', 'middle')
      .style('font-family', FONT_MONO).style('font-size', '9.5px').style('letter-spacing', '.05em')
      .style('fill', C.faint)
      .style('paint-order', 'stroke').style('stroke', C.surface).style('stroke-width', 3.5).text(SPEC_NOTE);

    /* Work reaching each specialist, and leaving again. */
    SPX.forEach(function (e) {
      var inX = SP[e.c === 'org' ? 0 : 1].cx;
      gRail.append('path')
        .attr('d', 'M' + inX + ',' + (ySpec + ROOF) + ' C' + inX + ',' + (cy - 26) + ' ' +
                   e.cx + ',' + (cy - 26) + ' ' + e.cx + ',' + (cy - SPEC_R))
        .style('fill', 'none').style('stroke', C[e.c]).style('stroke-width', 1).style('opacity', .4);
      gRail.append('path')
        .attr('d', 'M' + e.cx + ',' + (cy + SPEC_R) + ' C' + e.cx + ',' + (cy + 26) + ' ' +
                   inX + ',' + (cy + 26) + ' ' + inX + ',' + (ySpec + BOX_H))
        .style('fill', 'none').style('stroke', C[e.c]).style('stroke-width', 1).style('opacity', .4);
    });

    SPX.forEach(function (e) {
      var g = gNode.append('g').attr('transform', 'translate(' + e.cx + ',' + cy + ')');
      g.append('circle').attr('r', SPEC_R).style('fill', C.surface).style('stroke', C[e.c]).style('stroke-width', 1.4);
      g.append('circle').attr('r', SPEC_R).style('fill', C[e.c]).style('opacity', .10);
      MINI[e.g](g.append('g'), C[e.c]);
      gNode.append('text').attr('x', e.cx).attr('y', cy + SPEC_R + 16).attr('text-anchor', 'middle')
        .style('font-size', '10.5px').style('font-weight', 600).style('fill', C.ink)
        .style('paint-order', 'stroke').style('stroke', C.surface).style('stroke-width', 3.5).text(e.t);
      if (e.t2) {
        gNode.append('text').attr('x', e.cx).attr('y', cy + SPEC_R + 27).attr('text-anchor', 'middle')
          .style('font-size', '10.5px').style('font-weight', 600).style('fill', C.ink)
          .style('paint-order', 'stroke').style('stroke', C.surface).style('stroke-width', 3.5).text(e.t2);
      }
    });

    /* ---- the bypass: contracts and business hierarchy skip classification ---- */
    var y07 = stageY[SPLIT_AT + 1], y08 = stageY[SPLIT_AT + 2];
    var byA = (stageY[SPLIT_AT] + y07) / 2, byB = (y07 + y08) / 2;
    gRail.append('path')
      .attr('d', 'M' + MMX + ',' + (stageY[SPLIT_AT] + R) +
                 ' C' + MMX + ',' + byA + ' ' + OTHER_X + ',' + byA + ' ' + OTHER_X + ',' + (y07 - R))
      .style('fill', 'none').style('stroke', C.integ).style('stroke-width', 1.6).style('opacity', .8);
    gRail.append('path')
      .attr('d', 'M' + OTHER_X + ',' + (y07 + R) +
                 ' C' + OTHER_X + ',' + byB + ' ' + X08 + ',' + byB + ' ' + X08 + ',' + (y08 - R))
      .style('fill', 'none').style('stroke', C.integ).style('stroke-width', 1.6).style('opacity', .8);
    badge(OTHER_X, y07, OTHER, C.integ);

    /* ---- review fan --------------------------------------------------------- */
    var revMid = (fanTop + Y1) / 2;
    B.forEach(function (e) {
      gRail.append('path')
        .attr('d', 'M' + X09 + ',' + fanTop + ' C' + X09 + ',' + revMid + ' ' +
                   e.cx + ',' + revMid + ' ' + e.cx + ',' + Y1)
        .style('fill', 'none').style('stroke', C[e.c]).style('stroke-width', 1.3).style('opacity', .65);
    });
    var subTop = Y1 + CHIP_H, subMid = (subTop + Y2) / 2;
    O.forEach(function (e) {
      gRail.append('path')
        .attr('d', 'M' + B[CLASS_AT].cx + ',' + subTop + ' C' + B[CLASS_AT].cx + ',' + subMid + ' ' +
                   e.cx + ',' + subMid + ' ' + e.cx + ',' + Y2)
        .style('fill', 'none').style('stroke', C.classed).style('stroke-width', 1.2).style('opacity', .6);
    });

    /* ---- collector into the sign-off gate ----------------------------------- */
    var plain = B.filter(function (e, k) { return k !== CLASS_AT; });   /* all but classification */
    var feeders = plain.map(function (e) { return e.cx; })
                       .concat(O.map(function (e) { return e.cx; }));
    var fromY = plain.map(function () { return Y1 + CHIP_H; })
                     .concat(O.map(function () { return Y2 + CHIP_H; }));
    feeders.forEach(function (fx, k) {
      gRail.append('line').attr('x1', fx).attr('x2', fx).attr('y1', fromY[k]).attr('y2', YC)
        .style('stroke', C.integ).style('stroke-width', 1.1).style('opacity', .45);
    });
    gRail.append('line').attr('x1', RAIL).attr('x2', Math.max.apply(null, feeders))
      .attr('y1', YC).attr('y2', YC)
      .style('stroke', C.integ).style('stroke-width', 1.3).style('opacity', .55);
    gRail.append('line').attr('x1', RAIL).attr('x2', RAIL).attr('y1', YC).attr('y2', YG - RG)
      .style('stroke', C.integ).style('stroke-width', 1.8).style('opacity', .85);

    /* approved: on to packaging and the customer */
    gRail.append('line').attr('x1', RAIL).attr('x2', RAIL).attr('y1', YG + RG).attr('y2', YP - R)
      .style('stroke', C.integ).style('stroke-width', 1.8).style('opacity', .85);
    gRail.append('line').attr('x1', RAIL).attr('x2', RAIL).attr('y1', YP + R).attr('y2', YU - R)
      .style('stroke', C.integ).style('stroke-width', 1.8).style('opacity', .85);
    gNode.append('text').attr('x', RAIL + 10).attr('y', (YG + RG + YP - R) / 2 + 3)
      .style('font-family', FONT_MONO).style('font-size', '9px').style('letter-spacing', '.1em')
      .style('fill', C.integ).text('approved');

    /* needs updates: back up the left lane to the review lab */
    var rr0 = 8;
    gRail.append('path')
      .attr('d', 'M' + (RAIL - RG) + ',' + YG +
                 ' H' + (RWL + rr0) + ' Q' + RWL + ',' + YG + ' ' + RWL + ',' + (YG - rr0) +
                 ' V' + (lastY + rr0) + ' Q' + RWL + ',' + lastY + ' ' + (RWL + rr0) + ',' + lastY +
                 ' H' + (X09 - R - 2))
      .style('fill', 'none').style('stroke', C.rework).style('stroke-width', 1.4).style('opacity', .8)
      .attr('marker-end', 'url(#sp-arrow-rework)');
    gNode.append('text')
      .attr('transform', 'translate(' + (RWL - 12) + ',' + ((lastY + YG) / 2) + ') rotate(-90)')
      .attr('text-anchor', 'middle')
      .style('font-family', FONT_MONO).style('font-size', '9px').style('letter-spacing', '.12em')
      .style('fill', C.rework).text('needs updates');

    /* ---- chips --------------------------------------------------------------- */
    function chip(e, y, col, size) {
      gNode.append('rect').attr('x', e.x).attr('y', y).attr('width', e.w).attr('height', CHIP_H)
        .attr('rx', CHIP_H / 2)
        .style('fill', C.surface).style('stroke', col).style('stroke-width', 1.2);
      var fs = size || 11.5;
      var t = gNode.append('text').attr('x', e.cx).attr('y', y + 18).attr('text-anchor', 'middle')
        .style('font-size', fs + 'px').style('fill', col);
      t.append('tspan').text(e.t);
      /* A real subscript: dy drops the baseline, the smaller size keeps it from
         reading as part of the word. text-anchor centres the pair together. */
      if (e.sub) t.append('tspan').attr('dy', 3.4)
        .style('font-size', (fs * 0.8) + 'px').text(e.sub);
    }
    B.forEach(function (e) { chip(e, Y1, C[e.c]); });
    O.forEach(function (e) { chip(e, Y2, C.classed, 11); });
    gNode.append('text').attr('x', ellX).attr('y', Y2 + 19).attr('text-anchor', 'middle')
      .style('font-size', '13px').style('fill', C.faint).text('…');

    /* ---- 09b sign-off: the chart is read, then stamped ----------------------- */
    var gate = gNode.append('g').attr('transform', 'translate(' + RAIL + ',' + YG + ')');
    gate.append('circle').attr('r', RG).style('fill', C.surface).style('stroke', C.integ).style('stroke-width', 1.5);
    gate.append('circle').attr('r', RG).style('fill', C.integ).style('opacity', .10);
    var chart = drawChart(gate.append('g'), C.integ);

    var gLbl = gNode.append('text').attr('x', RAIL + RG + 14).attr('y', YG - 1)
      .style('font-size', '13px').style('font-weight', 650).style('fill', C.ink);
    gLbl.append('tspan').style('font-family', FONT_MONO).style('font-size', '10px')
      .style('font-weight', 400).style('fill', C.integ).text('09b  ');
    gLbl.append('tspan').text('Sign-off');
    gNode.append('text').attr('x', RAIL + RG + 14).attr('y', YG + 15)
      .style('font-size', '11.5px').style('fill', C.muted).text('the chart is read');

    var stampW = 118, stampX = RAIL + RG + 150;
    var stamp = gNode.append('g').attr('transform', 'translate(' + stampX + ',' + (YG - 14) + ')')
      .style('opacity', 0);
    var stampBox = stamp.append('rect').attr('width', stampW).attr('height', 28).attr('rx', 14)
      .style('fill', C.surface).style('stroke-width', 1.4);
    var stampTxt = stamp.append('text').attr('x', stampW / 2).attr('y', 18).attr('text-anchor', 'middle')
      .style('font-size', '11.5px').style('font-weight', 600);

    badge(RAIL, YP, TAIL[0], C.integ);
    badge(RAIL, YU, TAIL[1], C.integ);

    /* ---- feedback: each return lands on its own specialist ---------------- */
    FEEDBACK.forEach(function (fb, k) {
      var src = B[fb.from], dst = SPX[fb.to], rr = 8;
      var yIn = ySpec + 58 + k * 5;                 /* inside the building, above the circles */
      var tcx = dst.cx, land = cy - SPEC_R - 3;
      var d;
      if (fb.gutter === 'L') {
        var lane = GL - k * 10;
        var yb = Y1 + CHIP_H + 10 + k * 7;
        d = 'M' + src.cx + ',' + (Y1 + CHIP_H) + ' V' + (yb - rr) +
            ' Q' + src.cx + ',' + yb + ' ' + (src.cx - rr) + ',' + yb +
            ' H' + (lane + rr) + ' Q' + lane + ',' + yb + ' ' + lane + ',' + (yb - rr) +
            ' V' + (yIn + rr) + ' Q' + lane + ',' + yIn + ' ' + (lane + rr) + ',' + yIn +
            ' H' + (tcx - rr) + ' Q' + tcx + ',' + yIn + ' ' + tcx + ',' + (yIn + rr) +
            ' V' + land;
      } else {
        var laneR = GR + (k - 2) * 12;
        var ybR = Y1 + CHIP_H + 10 + k * 7;
        d = 'M' + src.cx + ',' + (Y1 + CHIP_H) + ' V' + (ybR - rr) +
            ' Q' + src.cx + ',' + ybR + ' ' + (src.cx + rr) + ',' + ybR +
            ' H' + (laneR - rr) + ' Q' + laneR + ',' + ybR + ' ' + laneR + ',' + (ybR - rr) +
            ' V' + (yIn + rr) + ' Q' + laneR + ',' + yIn + ' ' + (laneR - rr) + ',' + yIn +
            ' H' + (tcx + rr) + ' Q' + tcx + ',' + yIn + ' ' + tcx + ',' + (yIn + rr) +
            ' V' + land;
      }
      gNode.append('path').attr('d', d)
        .style('fill', 'none').style('stroke', C[src.c]).style('stroke-width', 1.1)
        .style('stroke-dasharray', '4 4').style('opacity', .6)
        .attr('marker-end', 'url(#sp-arrow-' + src.c + ')');
    });

    gNode.append('text')
      .attr('transform', 'translate(' + (RWL - 26) + ',' + ((ySpec + Y1) / 2) + ') rotate(-90)')
      .attr('text-anchor', 'middle')
      .style('font-family', FONT_MONO).style('font-size', '9px').style('letter-spacing', '.14em')
      .style('text-transform', 'uppercase').style('fill', C.faint)
      .text('11 \u00b7 continuous learning');

    /* ---- animation ------------------------------------------------------------
       Timed by milestone, not raw distance, so every packet reaches the same
       semantic point at the same moment. That is what lets the two branches merge
       cleanly at immersion, and what holds the packets together at the gate.

       Phases: 0 →dissection · 1 →building · 2 →specialist · 3 →out of building
               4 →immersion · 5 →review lab · 6 →branch chip · 7 →class output
               8 →sign-off · 9 dwell (zero length: the chart is read)
               10 →tail, chosen by the verdict
       -------------------------------------------------------------------------- */
    if (animate) {
      /* One piece of work per downstream endpoint. The product specialist yields
         two - an OEM finding and a classification - so six routes cover five
         specialists; the pair coincide inside the building and read as one. */
      var ROUTES = [
        { spec: 0, branch: 0, out: -1 },   /* supplier      -> supplier check   */
        { spec: 1, branch: 1, out: -1 },   /* product       -> OEM check        */
        { spec: 2, branch: 3, out: -1 },   /* contract      -> contract check   */
        { spec: 1, branch: 2, out: 0 },    /* product       -> classification   */
        { spec: 3, branch: 2, out: 1 },    /* pricing       -> classification   */
        { spec: 4, branch: 2, out: 2 },    /* spend anomaly -> classification   */
        { spec: 5, branch: 0, out: -1 }    /* business hierarchy -> supplier    */
      ].map(function (r) {
        r.track = SPX[r.spec].c === 'org' ? 0 : 1;
        return r;
      });

      var nodesA = [], nodesB = [], milesA = [], milesB = [];
      ROUTES.forEach(function (r) {
        var sp = SP[r.track], e = SPX[r.spec], b = B[r.branch], head = [];
        head.push('M' + RAIL + ',' + TOP + ' V' + yDis);
        head.push(' C' + RAIL + ',' + midA + ' ' + sp.cx + ',' + midA + ' ' + sp.cx + ',' + (ySpec + ROOF));
        head.push(' C' + sp.cx + ',' + (cy - 26) + ' ' + e.cx + ',' + (cy - 26) + ' ' + e.cx + ',' + cy);
        head.push(' C' + e.cx + ',' + (cy + 26) + ' ' + sp.cx + ',' + (cy + 26) + ' ' + sp.cx + ',' + (ySpec + BOX_H));
        head.push(' C' + sp.cx + ',' + midB + ' ' + MMX + ',' + midB + ' ' + MMX + ',' + yImm);
        if (BYPASS.indexOf(r.spec) >= 0) {
          head.push(' C' + MMX + ',' + byA + ' ' + OTHER_X + ',' + byA + ' ' + OTHER_X + ',' + y07);
          head.push(' C' + OTHER_X + ',' + byB + ' ' + X08 + ',' + byB + ' ' + X08 + ',' + y08);
        } else {
          head.push(' C' + MMX + ',' + byA + ' ' + X07 + ',' + byA + ' ' + X07 + ',' + y07);
          head.push(' C' + X07 + ',' + byB + ' ' + X08 + ',' + byB + ' ' + X08 + ',' + y08);
        }
        head.push(' C' + X08 + ',' + ((y08 + lastY) / 2) + ' ' + X09 + ',' + ((y08 + lastY) / 2) +
                  ' ' + X09 + ',' + lastY);
        head.push(' C' + X09 + ',' + revMid + ' ' + b.cx + ',' + revMid + ' ' + b.cx + ',' + Y1);
        if (r.out >= 0) {
          var o = O[r.out];
          head.push(' V' + subTop + ' C' + b.cx + ',' + subMid + ' ' + o.cx + ',' + subMid + ' ' + o.cx + ',' + Y2);
          head.push(' V' + (Y2 + CHIP_H) + ' V' + YC + ' H' + RAIL + ' V' + YG);
        } else {
          head.push(' V' + (Y1 + CHIP_H));
          head.push(' V' + YC + ' H' + RAIL + ' V' + YG);
        }
        head.push(' V' + YG);                                     /* dwell, zero length */

        var tailA = ' V' + (YU - R);
        var tailB = ' H' + (RWL + 8) + ' V' + lastY + ' H' + X09;

        function build(tail, milesInto) {
          var probe = gFlow.append('path').attr('class', 'c-branch')
            .style('fill', 'none').style('stroke', 'none');
          var acc = '', ms = [0];
          head.concat([tail]).forEach(function (sg) {
            acc += sg; probe.attr('d', acc); ms.push(probe.node().getTotalLength());
          });
          milesInto.push(ms);
          return probe.node();
        }
        nodesA.push(build(tailA, milesA));
        nodesB.push(build(tailB, milesB));
        r.col = C[TRACKS[r.track].c];
        r.midCol = BYPASS.indexOf(r.spec) >= 0 ? C.integ : C.classed;
      });

      var PH = milesA[0].length - 1;                  /* 13 phases */
      var GATE_PH = PH - 2;
      var MID_PH  = 6;                                /* 07 row -> 08: colour depends on the route */
      var PHASE_COL = [C.raw, null, null, null, null,
                       C.integ, null, C.classed, C.classed, C.classed,
                       C.integ, C.integ, null];
      var SPEED = 0.95, HOLD = 1.1, FADE = 0.22;      /* phases per second */

      var tokens = gFlow.selectAll('g.c-token').data(ROUTES).join('g').attr('class', 'c-token');
      tokens.each(function () { drawSack(d3.select(this), 0, 0, 0.44, C.raw); });

      /* Two cycles approved, then one sent back. A rejected pass does not restart
         from intake: the packets arrive back at the review lab and set off down
         from there — milestone 6, the point tail B lands on — so the resume is
         seamless. That retry is always approved, or the loop could never leave. */
      var REVIEW_PH = 8;
      var REWORK_HOLD = 0.45;
      var cycle = 0, rework = false;
      function pickVerdict() { rework = (cycle % 3) === 2; }
      pickVerdict();

      /* The packet reaches 12 Customer at the end of the last phase, and only
         on an approved pass — a rework lap turns back at the review lab and
         never gets there. Announce that crossing once per lap; the access
         diagram sets off on it. */
      HAS_PACER = true;
      var announced = false;

      var prog = 0, last = 0;
      d3.timer(function (el) {
        var dt = Math.min(60, el - last) / 1000; last = el;
        prog += SPEED * dt;
        if (prog > PH + (rework ? REWORK_HOLD : HOLD)) {
          if (rework) { rework = false; prog = REVIEW_PH; }
          else { cycle++; pickVerdict(); prog = 0; }
          announced = false;
        }
        if (!rework && !announced && prog >= PH) { announced = true; announceArrival(); }

        var k = Math.min(PH - 1, Math.floor(prog));
        var f = Math.min(1, prog - k);
        var onTail = k >= PH - 1;

        var gp = prog - GATE_PH;
        var lift = 0, read = 0;
        if (gp > 0 && gp < 1) {
          lift = gp < 0.25 ? gp / 0.25 : (gp > 0.8 ? Math.max(0, (1 - gp) / 0.2) : 1);
          read = gp < 0.25 ? 0 : Math.min(1, (gp - 0.25) / 0.55);
        }
        chart.set(lift, read);

        var showStamp = prog > GATE_PH + 0.78;
        stamp.style('opacity', showStamp ? Math.min(1, (prog - GATE_PH - 0.78) / 0.18) : 0);
        if (showStamp) {
          stampBox.style('stroke', rework ? C.rework : C.integ);
          stampTxt.style('fill', rework ? C.rework : C.integ)
                  .text(rework ? 'needs updates' : 'approved');
        }

        var seen = [];
        tokens.each(function (r, idx) {
          var useB = rework && onTail;
          var node = useB ? nodesB[idx] : nodesA[idx];
          var ms   = useB ? milesB[idx] : milesA[idx];
          var d = ms[k] + f * (ms[k + 1] - ms[k]);
          var pt = node.getPointAtLength(d);
          var key = Math.round(pt.x) + ':' + Math.round(pt.y);
          var dup = seen.indexOf(key) >= 0;
          seen.push(key);

          var col = (k === PH - 1) ? (rework ? C.rework : C.integ)
                  : (k === MID_PH) ? r.midCol
                  : (PHASE_COL[k] || r.col);
          var op = dup ? 0 : 1;
          if (prog < FADE) op *= prog / FADE;
          if (prog > PH && !rework) op *= Math.max(0.25, 1 - (prog - PH) / HOLD);

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

    if (opts.variant === 'access')  return renderAccess(root, animate);
    if (opts.variant === 'compact') return renderCompact(root, animate);
    layout();

    var svg = root.append('svg')
      .attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('preserveAspectRatio', 'xMidYMin meet')
      .attr('role', 'img')
      .attr('aria-label', 'CXO Nexus spend data pipeline, drawn as a surgical theatre: ' +
            'contributors hand over sacks of spend data, which are stacked on gurneys, wheeled into ' +
            'operating rooms, assigned a record id and dissected into organizations and products. ' +
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
    ['raw', 'org', 'prod', 'integ', 'classed', 'rework', 'muted'].forEach(function (k) {
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
