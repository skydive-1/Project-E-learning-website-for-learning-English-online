# Project-wide constraints

## Zero-cost architecture (non-negotiable)

- This graduation project must operate at **0 VND**. Do not require or recommend enabling Billing, adding a payment card, purchasing credits, prepaying, or upgrading any provider to a paid tier.
- Prefer existing free tiers, local/open-source processing, deterministic logic, caching, batching, backoff, quota guards, and backend telemetry.
- Before adding or enabling an external service/API, verify that the proposed path works without a billing account. If Billing is required, keep that integration disabled and implement a free fallback instead.
- Never silently activate a billable feature. Any action with a plausible monetary cost requires the user's explicit change to this policy first.
- Treat provider quotas as hard resource limits: minimize calls, avoid duplicate work, cache safe results, stop/retry with bounded backoff on 429, and degrade gracefully when a free quota is unavailable.
- Monitoring and admin UI must state the real data source. Never label locally observed telemetry as Google-reported data, and never label delayed provider metrics as true realtime data.

## Protected file

- `I22.401_BM08.pdf` is another person's graduation-project report. Never open, parse, ingest, index, copy, move, edit, delete, or otherwise touch this file.

## Quality gates before delivery (non-negotiable)

- Follow `docs/RELEASE_CHECKLIST.md` for every code change.
- Before any push, run the local secret review, backend tests, frontend tests, and frontend production build. Do not push when any local gate fails.
- A push is not considered complete or safe to merge until GitGuardian, GitHub frontend CI, GitHub backend CI, the Vercel deployment, and the Railway deployment/healthcheck all report success for the same commit.
- External provider checks only exist after a commit is pushed. Never claim they passed based on local results; report them as unverified until their real status is available.
- Never merge, release, or promote a deployment while any required check is failing, pending, cancelled, skipped unexpectedly, or inaccessible.
