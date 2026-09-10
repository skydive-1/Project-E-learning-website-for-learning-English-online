---
version: 1
slug: "frontend-src-modules-academy-pages-roadmappage-jsx"
primary_target: "frontend/src/modules/academy/pages/RoadmapPage.jsx"
related_targets: ["frontend/src/modules/academy/pages/RoadmapDetailPage.jsx", "frontend/src/modules/academy/data/roadmapPaths.js", "frontend/src/modules/academy/styles/academy.scss", "frontend/src/modules/academy/styles/roadmap-detail.scss"]
---

# Academy Roadmap

## Scope and mode

- **Primary surfaces:** `RoadmapPage.jsx` at `/academy` and `RoadmapDetailPage.jsx` at `/academy/:roadmapId`.
- **Visitor mode:** Learn and choose.
- **Audience:** Learners choosing an English-learning path by current level and target.

## Job and task

Help a learner compare paths quickly, open a stable detail URL, understand each learning phase, then start a real course from the matching subject group.

## Data truth and states

- Course counts and detail-page course cards come from `/courses`, filtered by `subject_id`. Configured counts are used only while the request is loading or unavailable.
- Do not introduce invented learner totals, success percentages, or paid-service claims.
- Unknown roadmap slugs show a recoverable not-found page and do not request course data.
- Preserve fixed-header clearance, route-level scroll reset, responsive layout, keyboard focus visibility, and light/dark themes.

## Direction contract

Use a quiet editorial learning guide inspired by F8's readable roadmap composition without copying it. The detail route starts with a concise left-aligned heading, pairs long-form curriculum content with a useful sticky overview, and uses horizontal course cards backed by live catalog data. Keep E-Learn's indigo as the primary action color and orange as a small illustrative accent. Prefer semantic theme tokens, flat surfaces, restrained motion, and 12-16px card radii; refuse gradients, oversized colored panels, nested cards, and decorative metrics.

## Finish status

Implemented with dedicated routes for `basic`, `toeic`, and `ielts`, responsive one-column behavior, reduced-motion support, loading/error/empty states, accessible action labels, and direct links to matching courses.
