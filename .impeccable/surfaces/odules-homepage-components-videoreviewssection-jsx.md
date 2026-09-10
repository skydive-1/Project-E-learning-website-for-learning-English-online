---
version: 1
slug: "odules-homepage-components-videoreviewssection-jsx"
primary_target: "frontend/src/modules/homepage/components/VideoReviewsSection.jsx"
related_targets: ["frontend/src/modules/homepage/styles/homepage.scss"]
---

# Homepage Platform Showcase

## Scope and mode

- **Primary surface:** `VideoReviewsSection.jsx`, rendered on the public homepage.
- **Visitor mode:** Persuade through product explanation.
- **Audience:** Guests evaluating the platform and signed-in learners reviewing their own learning signals.

## Job and task

Show how the platform works through a rotating product-interface stack. Let visitors inspect courses, public quizzes, weekly streak, badges, and AI-supported practice without presenting fabricated performance data.

## Data truth and states

- Course and public-quiz counts and previews come from `/courses` and `/quizzes/free` with a ten-minute client cache.
- Personal streak and badges come from `GamificationContext`; guests receive a sign-in state and failed requests receive an unavailable state.
- Never restore hard-coded streaks, scores, course totals, quiz totals, or badge counts.
- The carousel pauses offscreen, on document hide, during pointer/keyboard interaction, when the visitor pauses it, and when reduced motion is preferred.

## Direction contract

Use a ReflexAI-inspired fanned product carousel inside a bounded navy stage: one crisp central interface, two progressively quieter cards on each side, and one invisible buffer card for seamless looping. Keep the surrounding E-Learn typography and indigo palette. Per-frame animation is limited to transform and opacity with a 700ms in-out movement and a 500ms opacity transition. Provide direct panel controls and an explicit pause/resume control; preserve usable loading, error, empty, guest, mobile, keyboard, and reduced-motion states.

## Finish status

Implemented and verified through component tests, production build, and desktop/mobile render inspection.
