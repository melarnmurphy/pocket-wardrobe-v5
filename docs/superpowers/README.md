# Superpowers Plans And Specs

The files in `plans/` and `specs/` are historical implementation artifacts. Many plan files still contain unchecked `- [ ]` boxes even when the corresponding code has already been implemented.

Use [../implementation-status.md](../implementation-status.md) as the reconciled status layer before treating any plan checklist as unfinished work.

Current important reconciliation:

- The active fashion vision service is the self-hosted `pipeline/` FastAPI app plus `PIPELINE_SERVICE_URL`.
- `modal_fashion_app.py` is legacy reference code only unless a Modal deployment is explicitly requested.
- The web pipeline route is `POST /api/pipeline/analyse`, matching the pipeline endpoint spelling.
