---
version: 1
slug: "frontend-src-modules-academy-pages-roadmappage-jsx"
primary_target: "frontend/src/modules/academy/pages/RoadmapPage.jsx"
related_targets: ["frontend/src/modules/academy/styles/academy.scss"]
---

# Academy Roadmap

## Scope and mode

- **Primary surface:** `RoadmapPage.jsx`, exposed at `/academy`.
- **Visitor mode:** Learn and choose.
- **Audience:** Learners choosing an English-learning path by current level and target.

## Job and task

Help a learner compare the available paths quickly, understand the expected duration and live course count, open the phase breakdown, then continue to the correctly filtered course list.

## Data truth and states

- Course counts come from `/courses` and fall back to the configured path count only while the request is unavailable.
- Do not introduce invented learner totals, success percentages, or paid-service claims.
- Preserve the detail dialog, keyboard-close behavior, fixed-header clearance, responsive layout, and light/dark themes.

## Direction contract

Use a quiet editorial page inspired by F8's roadmap composition: a concise left-aligned introduction, compact horizontal bordered path cards with copy first and a circular illustration second, and a spacious two-column benefits close. Keep E-Learn's indigo as the primary action color and orange as a small illustrative accent. Prefer semantic theme tokens, flat surfaces, restrained motion, and 12–16px card radii; refuse gradients, oversized colored panels, nested cards, and decorative metrics.

## Finish status

Implemented with responsive one-column behavior, reduced-motion support, accessible action labels, and the existing dialog interaction preserved.
