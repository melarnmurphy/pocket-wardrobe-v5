# Superpowers Plans And Specs

The files in `plans/` and `specs/` are historical implementation artifacts. Many plan files still contain unchecked `- [ ]` boxes even when the corresponding code has already been implemented.

Use [../implementation-status.md](../implementation-status.md) as the reconciled status layer before treating any plan checklist as unfinished work.

Current important reconciliation:

- The active fashion vision service is `modal_fashion_app.py` plus `PIPELINE_SERVICE_URL`.
- The older `pipeline/` FastAPI package described in `2026-03-23-fashion-pipeline.md` was not created and is superseded by the Modal service unless a local containerized service is explicitly requested.
- The web pipeline route is `POST /api/pipeline/analyse`, matching the Modal endpoint spelling.
