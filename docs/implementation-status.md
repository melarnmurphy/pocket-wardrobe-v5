# Pocket Wardrobe Implementation Status

Last reconciled: 2026-05-07

This document reconciles the historical implementation plans in `docs/superpowers/plans/` with the current repository. Those plan files are useful design and implementation references, but most still contain unchecked checklist syntax and should not be treated as live task state without checking this file and the code.

## Repository State

- The project is an existing Next.js App Router + Supabase application, not greenfield.
- Core web checks are currently clean: `npm test` and `npm run typecheck` pass.
- Local-only generated files are intentionally ignored: `.mcp.json`, `supabase/.temp/`, Xcode `xcuserdata/`, and `*.xcuserstate`.
- The worktree still contains substantial uncommitted product work, especially web UI changes, avatar/profile work, trend story changes, and an iOS folder restructure. Treat those changes as intentional until reviewed.

## Implemented Or Mostly Implemented

| Area | Current state | Notes |
| --- | --- | --- |
| Core schema | Implemented | `schema.sql` and migrations cover wardrobe, sources, drafts, images, wear events, lookbook, outfits, style rules, trends, weather, entitlements, avatar additions. |
| Wardrobe vertical slice | Implemented | Create/list garments, image upload, edit metadata, feature image, favourites, wear logging, and cost-per-wear recalculation exist. |
| Lookbook | Implemented | Separate lookbook entries/items and image upload paths exist. |
| Wear events | Implemented | Domain service and tests exist, including list/log/update/delete behavior. |
| Style rules | Implemented | Rule CRUD, seed knowledge modules, template UI, semantic normalization, and tests exist. |
| Outfit generator | Partially implemented | Rule-based generation, gallery, planner UI, saved outfits, weather context, and tests exist. Pro/LLM prose enhancement is explicitly not wired yet. |
| Trend signals | Implemented | RSS/Gemini grounding adapters, extraction, taxonomy, matching, stories, cron routes, and tests exist. |
| Draft review | Implemented | `/wardrobe/review` supports pending draft review and acceptance into garments. |
| Product URL ingestion | Partially implemented | URL metadata extraction and draft/garment wiring exist, but retailer coverage and extraction quality remain MVP-level. |
| Receipt ingestion | Partially implemented | Receipt upload/text paths exist, but OCR is dependent on a service endpoint and remains a production-hardening item. |
| iOS prototype | In progress | Files now live under `ios/PocketWardrobev5/PocketWardrobev5/`; old duplicate paths are deleted. Simulator build and unit smoke test pass. Live Supabase wiring remains open. |

## Open Product/Engineering Gaps

1. **Fashion vision pipeline attachment**
   - Current web code calls `PIPELINE_SERVICE_URL` and expects a Modal-compatible `/analyse` endpoint.
   - `modal_fashion_app.py` exists and implements the YOLOS + FashionSigLIP Modal service.
   - The service advertises `/capabilities`; receipt OCR is currently reported as unavailable and the web app falls back to pasted text/text-readable files.
   - The older plan/spec described a local `pipeline/` FastAPI package; that package is not present and is superseded by the Modal service path unless a local containerized service is explicitly needed.

2. **Ingestion intelligence**
   - Direct image analysis is wired to the external pipeline service.
   - Product URL and receipt flows need stronger extraction, observability, and retry/fallback handling.
   - Outfit decomposition depends on the same image pipeline and should remain draft/review based.

3. **Outfit generation**
   - The structured rules engine is the source of truth.
   - Pro-tier LLM copy/enhancement is a stub and should be implemented only after the deterministic recommendations are stable.

4. **iOS**
   - The active project is `ios/PocketWardrobev5/PocketWardrobev5.xcodeproj`.
   - The app builds for a generic iOS Simulator.
   - The `PocketWardrobev5Tests` unit test target passes on an iPhone 17 simulator.
   - `Secrets.plist` is ignored; `Secrets.example.plist` should remain tracked.
   - Xcode user state is ignored and should not be reintroduced.

5. **Plan/spec hygiene**
   - Historical plan files still use unchecked boxes even where implementation exists.
   - Use this status file as the live reconciliation layer rather than editing every historical plan.

## Historical Plan Reconciliation

| Plan | Status | Reconciliation |
| --- | --- | --- |
| `2026-03-23-homepage-dashboard-review.md` | Mostly implemented | Dashboard/upload/review concepts exist, but the checklist remains unchecked. |
| `2026-03-23-fashion-pipeline.md` | Superseded/partial | Next.js integration exists. The local `pipeline/` package does not; `modal_fashion_app.py` is the active service implementation. |
| `2026-03-24-pipeline-draft-review.md` | Mostly implemented | Draft review UI and crop/image paths exist; keep for design history. |
| `2026-03-24-knowledge-graph-style-rules.md` | Mostly implemented | Knowledge modules, services, templates, and tests exist. |
| `2026-03-24-trend-signals.md` | Mostly implemented | Trend ingestion/extraction/matching services and API routes exist. |
| `2026-03-25-outfit-generation-ui.md` | Partially implemented | Rule-based UI exists; Pro/LLM path remains open. |
| `2026-03-25-style-rule-template-ui.md` | Mostly implemented | Template components and tests exist. |
| `2026-03-25-trend-enrichment.md` | Mostly implemented | Taxonomy, content, extraction, season, matching pieces exist; production tuning remains. |
| `2026-03-26-hybrid-trend-scoring.md` | Mostly implemented | Taxonomy metrics and sparkline UI exist. Validate production scoring with real source volume. |
| `2026-04-26-trends-story-layer.md` | Mostly implemented | Story tables/services/actions/UI/cron exist. |
| `2026-04-29-account-page-redesign.md` | Mostly implemented | Self-review checklist already marked complete in the plan. |
| `2026-04-29-ios-auth.md` | In progress | Supabase Swift/project files are present, but manual Xcode setup and build verification remain. |

## Next Build Order

1. Commit or split the current dirty worktree into coherent changesets.
2. Verify the Modal fashion pipeline locally/deployed and make the web route fail gracefully when it is missing.
3. Harden ingestion paths: product URL, receipt OCR, and outfit decomposition.
4. Complete outfit Pro explanation behavior.
5. Run iOS build verification and clean duplicate/deleted project paths.
