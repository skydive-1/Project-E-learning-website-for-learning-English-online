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
