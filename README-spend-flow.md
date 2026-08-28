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
| `index.html` | The site. Renders the **compact** variant in the CXO Nexus platform hero. |
| `d3.v7.min.js` | D3 v7.9, vendored locally so everything works offline. |

---

## The process

The whole pipeline is drawn as a **surgical theatre**: spend data arrives in sacks, is
admitted, given a patient id, dissected, worked on by specialists, classified, checked,
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

- assigned a **unique patient id**
- dissected into **organizations** and **products**
- both halves carry the assigned patient id

### 7 — Supplier specialist

The organizations / suppliers are sent to the supplier specialist.

| Step | |
|---|---|
| 7.1 | The specialist enters the room to operate on the organization data |
| 7.2 | The specialist pulls in the **organization catalogue** |
| 7.3 | Takes the organizations from the spend data and **cleans, normalizes and enriches** them — including **parentage** |
| 7.4 | **Updates the supplier specialist** to recognize newly seen organizations in future |
| 7.5 | Sends the clean, normalized and enriched organizations into the **knowledge immersion and integration room** |

### 8 — Product specialist

The products are sent to the product specialist.

| Step | |
|---|---|
| 8.1 | Cleans and normalizes the product |
| 8.2 | Uses the clean, normalized product to **identify the manufacturer** from history — and sends that to the supplier specialist |
| 8.3 | **Integrates** the clean, normalized, enriched organization from the immersion and integration room, matched on the assigned patient id |
| 8.4 | Calls in the **classification physician** to identify the spend, using the integrated organization, what has been learned from history, and the output of the product cleaner and normalizer |
| 8.5 | Sends the integrated and classified data to the **data recovery room** |

### 9 — Review lab

The integrated and classified data is taken from the recovery room and broken into
**three branches** for processing in the review lab:

1. **Supplier** — supplier / parentage check
2. **OEM** — OEM / parentage check
3. **Classification** — classification check

The classification branch splits into three:

- TBM
- Level 1
- Non-Tech

### 10 — Packaging

Each of supplier, OEM and classification, and their output, is taken from the review lab
to packaging.

| Step | |
|---|---|
| 10.1 | Deployed to **QA** |
| 10.2 | **Approved for customer viewing** |

### 11 — Feedback to processing

| Step | |
|---|---|
| 11.1 | Supplier feeds back to **history** |
| 11.2 | OEM feeds back to **history** |
| 11.3 | Product classification feeds back to the **product specialist** |

### 12 — Customer

The customer puts eyes and hands on the result.

---

## How this maps to the visual

Two variants are rendered from the same module.

```js
renderSpendPipeline('#el');                          // full surgical theatre
renderSpendPipeline('#el', { variant: 'compact' });  // stage rail, used in the hero
```

### Compact variant — the one on the site

A vertical stage rail. To keep the numbering above aligned with the badges, steps 2–4 are
drawn as a single stage:

| Badge | Covers process steps |
|---|---|
| 01 Intake | 1 |
| 02 Receiving & transport | 2, 3, 4 |
| 03 Operating rooms | 5 |
| 04 Dissection | 6 |
| 05 Specialist suites | 7, 8 (both suites, summarized) |
| 06 Immersion | 7.5 → 8.3 |
| 07 Classification | 8.4 |
| 08 Recovery | 8.5 |
| 09 Review lab | 9, fanning to Supplier / OEM / Classification, the last splitting to TBM / Level 1 / Non-Tech |
| 10 Packaging | 10, 10.1, 10.2 |
| 11 (gutter) | 11.1–11.3, dashed returns to the specialist suites |
| 12 Customer | 12 |

The compact variant necessarily summarizes. The per-step detail of 7.1–7.5 and 8.1–8.5
lives in the full variant.

### Full variant — the refinement artifact

The full surgical theatre draws every room: contributors, gurneys, masked porters, three
operating rooms, both specialist suites with all their numbered steps, the immersion
room, the classification physician, recovery, and the three review-lab checks.

**Known gap:** the full variant currently ends at the review lab. Steps **10, 11 and 12
(packaging, feedback and customer) are not yet drawn there** — they exist only in the
compact variant. Ask for it to be brought up to date when you need it.

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

### Lines

- **Solid** — forward flow
- **Dashed** — feedback / return into an earlier stage (7.4, 8.2, 11.1–11.3)
- Lines never cross where it can be avoided; a fan out of one point is preferred over a
  shared bus, because a bus makes the animation unreadable

### Animation

A sack of spend data rides the pipeline and takes on each stage's colour as it passes.
At the review lab it **splits three ways**; when classification sub-divides it becomes
**five**; all of them converge on the customer. Tokens that sit at the same point are
hidden, so the packet reads as one object until it genuinely divides.

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
| Reword a caption | The stage's description line |
| Change a colour's meaning | The **Streams** table |

If a change would make the compact variant too tall or too dense for the hero panel, say
so in the request — the alternatives are summarizing further on the rail, or moving the
detail into the full variant and linking to it.
