# Spend flow — process description

**This file is the source of truth for the pipeline diagram.** Edit it, then ask for the
visual to be rebuilt from it. The diagram code should follow this document, not the other
way round — if the two disagree, this file wins and the code is wrong.

> To request a rebuild: *"rebuild the spend flow visual from README-spend-flow.md"*

---

## Files

| File | What it is |
|---|---|
| `README-spend-flow.md` | This document. The process, in words. |
| `spend-pipeline.js` | The diagram. Two variants, both driven by the spec block at the top of the file. |
| `spend-pipeline.html` | Refinement harness — open it, edit the JS, hit Redraw. Theme and motion toggles. `#dark` in the URL opens the dark palette. |
| `index.html` | The site. The CXO Nexus platform hero runs the heading and lede full width, then puts the **compact** variant on the left and the **access** variant on the right (`.split.hero-panels`, which stacks below 1100px). |
| `d3.v7.min.js` | D3 v7.9, vendored locally so everything works offline. |

---

## The process

The whole pipeline is drawn as a **surgical theatre**: spend data arrives in sacks, is
admitted, given a record id, dissected, worked on by specialists, classified, checked,
and discharged to the customer.

### 1 — Intake

Multiple individuals arrive carrying bags of **spend data** and throw them into the
input layer.

### 2 — Receiving

Every individual throws their bags into the same receptacle / gurney.

### 3 — Loading

Each gurney carries a stack of several sacks of spend data.

### 4 — Transport

Each gurney is wheeled by a **data operations doctor in a mask** to the data operations
room.

### 5 — Operating rooms

Each gurney is taken to **its own operating room**.

### 6 — Dissection

In each operating room the spend data is:

- assigned a **unique record id**
- dissected into **two separate branches**, which travel independently from here:
  - **Organizations / vendors**
  - **Product descriptions and other product information**
- both branches carry the assigned record id, which is how they are rejoined later

The two branches are worked in parallel on the **specialist bench** — supplier, product,
contract, pricing, spend anomaly and business hierarchy — each cleaning, normalizing and
enriching its own slice. The branches do not meet again until the immersion node.

### 7 — Supplier specialist  *(branch A)*

The organizations / vendors branch is sent to the supplier specialist — a specialist / AI
that cleans, normalizes and enriches organization data.

| Step | |
|---|---|
| 7.1 | The specialist enters the room to operate on the organization data |
| 7.2 | The specialist pulls in the **organization catalogue** |
| 7.3 | Takes the organizations from the spend data and **cleans, normalizes and enriches** them — including **parentage** |
| 7.4 | **Updates the supplier specialist** to recognize newly seen organizations in future |
| 7.5 | Sends the clean, normalized and enriched organizations into the **knowledge immersion and integration room**, where branch A waits to be rejoined with branch B |

### 8 — Product specialist  *(branch B)*

The product branch — descriptions and other product information — is sent to the product
specialist, a separate specialist / AI that cleans and normalizes product data.

| Step | |
|---|---|
| 8.1 | Cleans and normalizes the product |
| 8.2 | Uses the clean, normalized product to **identify the manufacturer** from history — and sends that to the supplier specialist |
| 8.3 | **Integrates** the clean, normalized, enriched organization from the immersion and integration room, matched on the assigned record id |
| 8.4 | Calls in the **classification physician** to identify the spend, using the integrated organization, what has been learned from history, and the output of the product cleaner and normalizer |
| 8.5 | Sends the integrated and classified data to the **data recovery room** |

### 8b — Further specialists

Alongside supplier and product, the bench carries four more specialists. Each cleans,
normalizes and enriches its own slice of the record, and all of them feed the same
immersion node.

| Specialist | Works on | Fed by |
|---|---|---|
| **Contract** | terms · obligations | organizations branch |
| **Pricing** | competitive price | product branch |
| **Spend anomaly** | leakage · outliers | product branch |
| **Business hierarchy** | parentage · ownership | organizations branch |

> The *fed by* column is a provisional reading — it drives the colour of each dot and
> decides which branch the work arrives on. Correct it here if a specialist sits on the
> other branch. A specialist fed by *both* is not currently expressible: each one takes
> a single entry point into the building.

### 8c — Immersion: the branches reunite

> Drawn in the diagram as **“Match & merge”**. The process keeps the original name; the
> node label uses the business term.

The two branches are **reunited in the immersion node** for knowledge integration, matched
on the record id assigned at dissection. From this point on there is a single unified
record again, and it is that unified content which is passed into classification (8.4).

### 8d — Other processing

**Not everything is spend-classified.** Coming out of match & merge the flow divides:

| Goes to | What |
|---|---|
| **Spend classification** (8.4) | supplier, product, pricing and spend-anomaly work — the spend gets a name |
| **Other processing** | **contracts** and **business hierarchy** — these are not spend, so they are not classified |

Both paths rejoin at **ready for review** (8.5), and everything is checked together from
there on.

### 9 — Review lab

The integrated and classified data is taken from the recovery room and broken into
**four branches** for processing in the review lab:

1. **Supplier** — supplier / parentage check
2. **OEM** — OEM / parentage check
3. **Classification** — classification check
4. **Contract** — contract check

The classification branch splits into the customer's taxonomies:

- Taxonomy₁
- Taxonomy₂
- …
- Taxonomyₙ

These are **deliberately not named**. TBM, Level 1 and Non-Tech were the original
labels, and they meant nothing to a website reader — the useful claim is not which
taxonomies a particular customer has, but that any number of them can be produced from
the one classified record. The subscripts and the ellipsis carry that: 1 to n, for some n.

Three chips are drawn because three is enough to establish a series without crowding the
row — it is not a claim that there are three. If the count changes, the ellipsis position
moves with `CLASS_GAP_AFTER`.

### 9b — Sign-off

Before anything is packaged, the results are read and a verdict is given. The chart is
picked up, read, and stamped:

- **Approved** — the work goes on to packaging (10)
- **Needs updates** — the work is sent **back to the review lab** (9), which reworks it and
  runs it down through the checks again

Nothing reaches packaging without passing this gate. Rejected work does not go back to the
start — it re-enters at the review lab and carries on from there.

**The inspection round.** The verdict is not instant: an inspector leaves the gate carrying
the chart and walks the review lab before deciding.

    Sign-off → Supplier → OEM → Taxonomy₁ → Taxonomy₂ → Taxonomyₙ → Contract → Sign-off

Every chip is inspected **from underneath**, which takes two lanes:

- `LANE_A`, between the branch row and the taxonomy row — Supplier, OEM, Contract
- `LANE_B`, between the taxonomy row and the collector bus — the three taxonomies

They drop from A to B after OEM and climb back to A for Contract. `LANE_B` did not exist
until this was built: `YC` was `Y2 + 46`, leaving only 18px under the taxonomy chips, which
is narrower than the figure. It is now `Y2 + 70`, giving a 42px corridor to match the one
above, **at the cost of 24px of diagram height**.

The return does **not** retrace. They come home along the rail the record itself takes:
down Contract's drop line to the collector bus, west along the bus, then down into the
gate — at roughly double pace, since nothing happens on the way back. `BACK_Y` is offset
by the glyph's foot height so they walk **on** the bus rather than through it.

The chart tracks the round — it lifts as they set off, and fills one line per stop — and
the verdict stamps about 160 ms after they are back. A rejected record is walked again on
its retry pass.

| Edit | Where |
|---|---|
| Which chips are visited, and in what order | `TOUR_STOPS` in `renderCompact` |
| Walking pace, return pace, pause at each stop | `OUT_SPEED`, `BACK_SPEED`, `DWELL` |
| The two corridors | `LANE_A`, `LANE_B` (and `YC`, which sets how deep `LANE_B` is) |
| The figure itself | `drawWalker` |

> The Classification chip is **passed under but not visited** — the taxonomies below it are
> its result, so stopping at both would be saying the same thing twice. Adding it is one
> entry in `TOUR_STOPS`.

> The figure is drawn **deliberately out of scale** with the badges. The hero renders this
> diagram at about 0.78, so a figure sized to match the chips would be 14px on screen and
> its gait would read as a wobble. It is about 24 units tall instead.

### 10 — Packaging

Each of supplier, OEM, classification and contract, and their output, is taken from the
review lab to packaging.

| Step | |
|---|---|
| 10.1 | Deployed to **QA** |
| 10.2 | **Approved for customer viewing** |

### 11 — Feedback to processing

> Drawn in the diagram as **“Continuous learning”**.

Each return lands on the **specific specialist** that owns the finding, not on the
building as a whole.

| Step | From review branch | Back to specialist |
|---|---|---|
| 11.1 | Supplier | **Supplier** (history) |
| 11.2 | OEM | **Supplier** (history) |
| 11.3 | Classification | **Product** |
| 11.4 | Contract | **Contract** |

11.1 and 11.2 share a target because both feed *history*, which the supplier specialist
holds. Change either here if that is not right.

### 12 — Customer

The customer puts eyes and hands on the result.

---

## How this maps to the visual

Two variants are rendered from the same module.

```js
renderSpendPipeline('#el');                          // full surgical theatre
renderSpendPipeline('#el', { variant: 'compact' });  // stage rail, used in the hero
renderSpendPipeline('#el', { variant: 'access' });   // who sees what, after publish
```

### Compact variant — the one on the site

A vertical stage rail.

**The diagram uses business-facing labels; the process sections above keep the original
names.** This table is the translation between them. To keep the numbering aligned with
the badges, steps 2–4 are drawn as a single stage.

| Badge | Covers process steps |
|---|---|
| 01 Data intake | 1 |
| 02 Staging & batching | 2, 3, 4 — receiving, loading, transport |
| 03 Record processing & compression | 5 — the operating rooms |
| 04 Record split | 6 — the rail splits here into two branches (the dissection step) |
| **05 Enrichment** | 7, 8 and 8c — a building holding a circle per specialist |
| 06 Match & merge | 7.5 → 8.3 — the two branches reunite (the immersion room) |
| 07 Spend classification | 8.4, on the unified record |
| **07b Other processing** | 8d — contracts and business hierarchy, which skip classification |
| 08 Ready for review | 8.5 — the recovery room |
| 09 Validation | 9 — the review lab; fanning to Supplier / OEM / Classification / Contract; classification splits to Taxonomy₁ / Taxonomy₂ / … / Taxonomyₙ |
| **09b Sign-off** | 9b — the chart is read, then stamped approved or needs updates |
| 10 Publish | 10, 10.1, 10.2 — packaging |
| 11 Continuous learning (gutter) | 11.1–11.4, dashed returns landing on the specific specialist circle |
| 12 Customer | 12 |

The specialists are drawn as a **building**, signed *Enrichment*: the two branches out of dissection enter
through the roof, the work spreads to a circle for each specialist, and it gathers back
onto its own branch to leave. The branches stay separate throughout and do not merge
until 06.

The compact variant necessarily summarizes. The per-step detail of 7.1–7.5 and 8.1–8.5
lives in the full variant.

### Access variant — who sees what

A separate, smaller diagram that picks up where the pipeline ends. It is **not** part of
the numbered process above and carries no stage numbers, because it answers a different
question — governance rather than processing.

```
Customer  →  Roles based access rules  →  Finance     Cost centre = all
             columns in the customer's      IT          GL account = 6xxx
             own data — department,         Plant ops   Department = 400 + GL = 6xxx
             cost centre, GL account,
             legal entity
```

The customer decides who sees which records. The rules are **defined by information from
the customer**: the four chips inside the box are *columns in the customer's own data*, and

> **a role = one or more of these column values**

which is the line printed at the foot of the box. A role is not a job title the platform
knows about — it is a filter expressed in the customer's own vocabulary. Finance is
`Cost centre = all`; plant ops is `Department = 400 + GL = 6xxx`, deliberately combining
two columns so the "one or more" is legible from the picture rather than only from the
caption. Keep at least one role showing a combination for that reason.

One packet leaves the customer, divides at the rules, and one arrives at each role — one
published set, each role seeing only its own slice.

**It is timed off the pipeline, not off its own clock.** The packet waits on the customer
until the pipeline's packet reaches 12 Customer, then sets off. See *Animation → The
handoff between the two diagrams*.

It sits in the hero's **right column**, beside the pipeline. It was built narrow on purpose
(viewBox 440 wide) so it reads well in the smaller of the two columns.

| Edit | Where |
|---|---|
| The columns a role can be built from | `ACCESS_COLS` in `spend-pipeline.js` |
| The roles and the column values that define each | `ROLES` |

> The columns and roles are **placeholders** — department / cost centre / GL account /
> legal entity, and finance / IT / plant ops. Replace them with the ones that match how
> customers actually scope access.

> The `ROLES` caption sits at `BX`, not `CHIP_X`. The connector from the box down to the
> spine sweeps through roughly x = 110 at that height; a label under it needed a halo,
> and the halo knocked a visible gap out of the line.

### Full variant — the refinement artifact

The full surgical theatre draws every room: contributors, gurneys, masked porters, three
operating rooms, both specialist suites with all their numbered steps, the immersion
room, the classification physician, recovery, and the review-lab checks.

**Known gap — the full variant is well behind the compact one.** It does not yet have:

- steps **9b, 10, 11 and 12** — sign-off, packaging, feedback and the customer
- the dissection split drawn as **two independent branches** reuniting at match & merge
- the **specialists building** with its five specialists (it still shows two suites)
- the **contract branch** in the review lab

Everything above describes the compact variant. Ask for the full one to be brought up to
date when you need it.

---

## Drawing conventions

### Streams

Colour carries what the data currently *is*, not where it is:

| Colour | Meaning |
|---|---|
| Brown | Raw spend data, still in the sack |
| Teal | Organizations / suppliers |
| Terracotta | Products |
| Blue | Integrated record |
| Gold | Classified spend |
| Violet | Rework — sent back from sign-off |

### Lines

- **Solid** — forward flow
- **Dashed** — feedback / return into an earlier stage (7.4, 8.2, 11.1–11.4)
- Lines never cross where it can be avoided; a fan out of one point is preferred over a
  shared bus, because a bus makes the animation unreadable
- **A stage can sit off the rail.** Give it `dx` in `STAGES` and its connectors become
  diagonals instead of a hidden vertical. **Match & merge, ready for review and validation
  all use `dx: 130`**, which puts them on the axis midway between spend classification (on
  the rail at 40) and other processing (300). The fork out of match & merge and the join
  into ready for review are therefore symmetric, validation sits directly under ready for
  review, and the flow only returns to the rail where the review fan spreads out — where
  the step is invisible. If `OTHER_X` moves, `dx` should be half of it to keep the diamond
  centred, and all three stages should keep the same value.
- **Validation-row spacing is load-bearing.** Supplier, OEM and Contract drop straight past the
  classification outputs on their way to the collector, so the branch row is spaced (via
  `REVIEW_GAP`) wide enough that each drop clears those chips. Narrow the gap, or widen a
  chip label, and the drops disappear behind the bubbles.

### Animation

A sack of spend data rides the pipeline and takes on each stage's colour as it passes.
The packet count tells the story:

| Where | Packets | |
|---|---|---|
| Data intake → Record split | **1** | one record, still whole |
| Record split → building | **2** | organizations branch and product branch |
| Inside the building | **6** | one piece of work at each specialist — seven routes, two of which share the product specialist |
| Leaving the building | **2** | gathered back onto their own branches |
| At match & merge | **1** | the two branches reunite into one record |
| Match & merge → Ready for review | **2** | most work is classified; contracts and business hierarchy take other processing |
| Ready for review → Validation | **1** | both paths rejoin |
| Validation → branches | **4** | supplier, OEM, classification, contract |
| After classification splits | **6** | the three taxonomy chips join supplier, OEM and contract |
| Into sign-off | converge | everything gathers at the gate to be read |
| After sign-off | 1 path of 2 | approved → publish → customer, or needs updates → back to validation |
| After a rejection | resumes | the packets set off down again **from validation**, not from intake |
| At the gate | held | the packets stop while the inspector walks the round, then resume |

Two mechanisms make this work, and both matter if the diagram is edited:

- **Milestone timing.** Every route is timed by milestone, not by raw distance, so the
  two branches reach match & merge at the same instant and merge cleanly even though the
  product branch is a longer curve. Adding a stage means adding a milestone to every
  route, or they will drift apart.
- **Duplicate hiding.** Tokens sitting at the same point are hidden, so the packet reads
  as one object until it genuinely divides.
- **The gate hold.** The inspection round does not run on its own clock beside the
  pipeline — it stops it. When `prog` reaches `GATE_PH` it is pinned there while `tourT`
  advances, then released. Route milestones are never touched, so all fourteen paths stay
  in step through the pause.

  This costs real time: a lap was **14.85 s** and is now **23.6 s** — the round itself is
  8.7 s. That is the price of it, and it lands on the access diagram too — see below.

- **The handoff between the two diagrams.** The access diagram does not run on its own
  clock. Its packet parks on the customer and stays there until the pipeline's packet
  reaches **12 Customer**, and only then sets off among the roles — the right-hand panel
  is the continuation of the left-hand one, not a second animation running beside it.
  The compact variant calls `announceArrival()` as `prog` crosses the last phase;
  `renderAccess` subscribes with `onArrival()`.

  Only an **approved** lap announces. A rework lap turns back at the review lab and never
  reaches the customer, so nothing is published and the access diagram correctly stays
  parked — which is why the pause before a retry is visibly longer.

  Idle is not blank: the packet sits on the customer at full opacity, so a panel waiting
  out a lap reads as waiting rather than as broken. Since the inspection round was added
  that wait is roughly **16 s** of a 23 s lap — worth remembering if the round gets longer
  still.

  If no compact variant is on the page (the refinement harness, or a page embedding only
  the access diagram) nothing ever announces, so `HAS_PACER` stays false and the access
  variant free-runs instead of freezing. Both timers first tick after all synchronous
  render calls, so render order does not matter.

- **Layer order.** The SVG has five layers, and the order is load-bearing:
  `gBack` (solid fills) → `gRail` (lines) → `gFlow` (packets) → `gNode` (badges, circles,
  chips, text) → `gWalk` (the sign-off inspector). The inspector is last because the round
  takes them across chips whose fills would otherwise hide them. Anything with a solid fill drawn above `gFlow` will hide packets passing
  behind it — that is what made the packets vanish inside the specialists building. Put
  new fills in `gBack`; put new labels in `gNode`, where a packet slipping behind a badge
  or a circle reads as entering it.

### The sign-off gate

The gate turns the loop into a small state machine. Each packet has **two** tails built
from the same head — one to publish, one back to validation — and the verdict picks
which one is used. The verdict is chosen once per cycle, at the moment the chart opens, so
packets can never be caught halfway down the wrong tail.

The dwell at the gate is a **zero-length path segment**: the packets hold still while the
chart is read. That is what buys the pause without special-casing the timer.

A rejection **rewinds to milestone 8** — validation — rather than to zero. The rework
tail is built to end on that exact point, so the packets arrive and set off again with no
visible jump. The retry is always approved; if the ratio could reject twice the packets
would never leave the gate.

| Setting | Where | Now |
|---|---|---|
| Verdict ratio | `pickVerdict()` in `spend-pipeline.js` | 2 approved : 1 needs updates |
| Read dwell | one full phase | ~1.1s |
| Cycle length | 11 phases at `SPEED` 0.95 | ~11.6s, plus ~1.2s hold |
| Rework resume point | `REVIEW_PH` | milestone 8, the validation stage |
| Phases per cycle | milestones per route | 13 |
| Routes | one per downstream endpoint, plus one for business hierarchy | 7 |

Both outgoing paths are **always drawn and labelled**, so the branch is legible with
motion switched off. What the animation adds is which one is taken this time round.

Motion respects `prefers-reduced-motion`, and can be forced off:

```js
renderSpendPipeline('#el', { variant: 'compact', animate: false });
```

---

## Changing the process

Edit the numbered sections above, then ask for a rebuild. Some common changes and what
they touch:

| You want to | Change |
|---|---|
| Add or rename a stage | The numbered sections. Say whether it belongs on the compact rail or only in the full theatre. |
| Change a branch or split | Section 9, or wherever the split occurs |
| Add a feedback loop | Section 11, saying where it returns to |
| Add or remove a specialist | Section 8b, saying which branch feeds it |
| Add a review-lab branch | Section 9 — note this widens the diagram |
| Change what skips classification | Section 8d, and `BYPASS` in `spend-pipeline.js` |
| Change how often sign-off rejects | The verdict ratio, above |
| Reword a caption | The stage's description line |
| Change a colour's meaning | The **Streams** table |

If a change would make the compact variant too tall or too dense for the hero panel, say
so in the request — the alternatives are summarizing further on the rail, or moving the
detail into the full variant and linking to it.
