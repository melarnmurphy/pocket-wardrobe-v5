# Infrastructure Notes

Running notes on infrastructure direction. Each entry is dated and exploratory
unless explicitly marked as a decision.

---

## 2026-06-09 — Consider self-hosting the vision pipeline (Beta9 on Hetzner / Oracle Cloud) as a Modal alternative

**Status:** Exploratory — not committed. Captured for future evaluation.

### Context
The fashion vision pipeline (YOLOS-Fashionpedia + Marqo-FashionSigLIP) currently
runs on [Modal](https://modal.com) as the `fashion-pipeline` app
(`modal_fashion_app.py`), exposing `/analyse`, `/scrape`, `/health`, and
`/capabilities` on a T4 GPU. Modal is excellent for getting started — zero ops,
fast deploys, scale-to-zero — but bills per active GPU-second at a managed-service
premium and is a vendor lock-in point.

### Idea
Evaluate moving the GPU pipeline to **[Beta9](https://github.com/beam-cloud/beta9)**
(Beam's open-source serverless runtime) self-hosted on cheaper compute:

- **Hetzner** — dedicated GPU servers (e.g. RTX 4000/6000-class) at a large
  discount vs. managed clouds; flat monthly cost suits steady/predictable load.
- **Oracle Cloud** — competitive GPU pricing and notably cheap egress; worth
  comparing for spiky load and as a second region.

Beta9 deliberately mirrors Modal's decorator-based programming model
(`@app.cls`, GPU functions, web endpoints, volumes), so the conceptual migration
of `modal_fashion_app.py` should be relatively low-friction.

### Why it could be worth it
- **Cost** — at sustained inference volume, a flat-rate dedicated GPU (Hetzner)
  or cheap-egress GPU (Oracle) likely beats per-second managed pricing.
- **No vendor lock-in** — Beta9 is open source and self-hosted; we own the stack.
- **Control** — pin GPU types, warm pools, and cold-start behaviour directly.

### What migration would touch
- Re-host the `FashionPipeline` class + FastAPI wrapper (`/analyse`, `/scrape`,
  `/health`, `/capabilities`) on Beta9. The `/analyse` response contract must stay
  identical so the Next.js client (`lib/domain/ingestion/client.ts`) is unaffected
  — only `PIPELINE_SERVICE_URL` changes.
- Model-weight caching (currently a Modal Volume) → Beta9 volume / persistent disk.
- The `pipeline_lib.py` helpers (detection post-processing) are pure Python and
  port unchanged.
- Receipt OCR is **not** affected — it now runs in the Next.js layer via OpenAI
  vision (`lib/domain/ingestion/receipt-vision.ts`), independent of the GPU service.

### Trade-offs / open questions
- **Ops burden** — self-hosting means we own GPU driver/CUDA setup, autoscaling,
  monitoring, and uptime. Modal abstracts all of this. Quantify the eng time.
- **Scale-to-zero** — a dedicated Hetzner box is always-on (paying when idle);
  good for steady load, worse for bursty/low traffic. Model the actual call
  volume before deciding.
- **Cold starts vs. warm cost** — trade warm-pool cost against latency.
- Validate Beta9's maturity for our exact model stack (open_clip + transformers +
  the meta-device load workaround already in `modal_fashion_app.py`).

### Suggested next step (when revisited)
Spike: stand up Beta9 on one Hetzner GPU box, port `modal_fashion_app.py`, run the
existing eval harness (`eval/run_eval.py`) against it, and compare latency + cost
per 1k analyses vs. the current Modal deployment.
