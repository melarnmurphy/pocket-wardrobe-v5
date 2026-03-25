# AGENTS.md

# Mandatory Reading Before Any Work

Before making any code changes, you MUST read and understand the following files:

1. PRD.md — contains the product requirements, product philosophy, IP rules, colour system, trend system, and outfit engine logic.
2. schema.sql — contains the canonical database schema and data model. Do not invent new tables without checking this file first.

These documents define the system architecture and product behavior. They are the source of truth.

## MCP Project Target

For this repository, any Supabase MCP usage must target `pocketwardrobev5` only.

Do not invoke the `real-estate` MCP server when working in `fashionapp5`.
If an MCP server name is needed for Supabase access in this repo, use `pocketwardrobev5`.

## Development workflow for this project

When starting a task:

1. Read AGENTS.md
2. Read PRD.md
3. Read schema.sql
4. Inspect the current repository structure
5. Identify what already exists vs what must be built
6. Propose a plan
7. Implement in small steps
8. After changes, explain:
   - what changed
   - why
   - which files were modified
   - what should be built next

Do NOT:
- invent a different database schema
- merge wardrobe and lookbook tables
- build a trend system that republishes articles
- depend on Pantone codes as the main colour system
- build outfit generation as pure LLM output

Do:
- follow the schema
- follow the PRD logic
- keep logic explainable
- use structured rules and colour math
- implement RLS and security correctly

## Project
Build a competitive AI wardrobe / pocket wardrobe application.

This product is not a generic image-upload closet tracker. It is a structured wardrobe operating system with:
1. multi-source garment ingestion,
2. personal wardrobe management,
3. lookbook management,
4. wear tracking and cost-per-wear analytics,
5. trend intelligence,
6. a fashion knowledge graph / rule engine,
7. weather- and occasion-aware outfit generation.

The stack should assume:
- Next.js app router
- TypeScript
- Supabase for auth, database, storage, edge functions
- Postgres with pgvector if embeddings are needed
- a modular service architecture
- clean production-ready code
- no hacky one-off logic
- shared vs global pipelines designed intentionally

---

## Product goals

Build an MVP that supports:

### Core user flows
1. User uploads clothing into their wardrobe from:
   - product URL or website image
   - direct photo upload
   - receipt line item
   - full outfit image that is decomposed into separate garments

2. User can:
   - add garments to personal wardrobe
   - add garments or outfits to a lookbook
   - log wears
   - view cost per wear
   - generate outfits based on weather + event / dress code

3. System can:
   - maintain structured garment metadata
   - apply fashion rules consistently
   - match global trend signals to a user’s wardrobe
   - explain why an outfit or trend recommendation was generated

---

## Non-goals for MVP
Do not build these first unless required by existing architecture:
- resale marketplace integration
- social feed
- influencer / creator features
- advanced 3D closet UI
- live runway scraping from dozens of sources
- fully autonomous trend shopping recommendations
- native mobile app unless requested

---

## Required architecture principles

### 1. Separate ingestion from garments
Uploaded images, URLs, receipts, and outfit photos are not the garment itself.
They are input sources that create or enrich a normalized garment record.

### 2. Separate wardrobe from lookbook
Wardrobe = owned items.
Lookbook = inspiration, wishlist, saved outfits, reference looks, or AI-generated styling targets.

Do not collapse these into one table unless there is a strong abstraction that preserves semantics.

### 3. Prefer structured rules over LLM-only reasoning
Outfit generation should primarily be:
- filters
- constraints
- ranking
- style rules
- metadata matching

LLMs may be used for:
- explanations
- summarization
- enrichment
- fallback parsing

Do not make the outfit generator depend entirely on freeform model output.

### 4. Confidence-aware ingestion
All weakly inferred clothing data must support:
- confidence scores
- user review / correction
- provenance metadata

### 5. Global trend engine, personal recommendations
Trend detection is global.
Trend-to-wardrobe matching is per-user.

### 6. Explainability is mandatory
Where reasonable, recommendations should include machine-readable reasons:
- why this outfit works
- why a garment matched a trend
- why a garment was suggested
- why something is missing

---

## Data model requirements

Design a schema with at least the following entities.

### users
Standard user identity and profile data.

### garments
Owned clothing items.
Suggested fields:
- id
- user_id
- title
- description
- brand
- category
- subcategory
- colour_primary
- colour_secondary
- pattern
- material
- size
- fit
- formality_level
- seasonality
- wardrobe_status
- purchase_price
- purchase_currency
- purchase_date
- retailer
- wear_count
- last_worn_at
- cost_per_wear
- favourite_score
- versatility_score
- embedding
- extraction_metadata_json
- created_at
- updated_at

### garment_sources
Tracks how a garment entered the system.
Examples:
- direct_upload
- product_url
- receipt
- outfit_decomposition
- manual_entry

Suggested fields:
- id
- garment_id nullable during draft phase
- user_id
- source_type
- original_url nullable
- storage_path nullable
- raw_text nullable
- source_metadata_json
- parse_status
- confidence
- created_at

### garment_images
- id
- garment_id
- image_type (original, cutout, cropped, thumbnail)
- storage_path
- width
- height
- created_at

### garment_drafts
For low-confidence ingestion before user confirmation.
- id
- user_id
- source_id
- draft_payload_json
- confidence
- status
- created_at

### wear_events
- id
- user_id
- garment_id
- worn_at
- occasion
- notes
- outfit_id nullable

### outfits
- id
- user_id
- title
- occasion
- dress_code
- weather_context_json
- explanation
- source_type (generated, manual, imported)
- created_at

### outfit_items
- id
- outfit_id
- garment_id
- role (top, bottom, outerwear, shoes, accessory)

### lookbook_entries
- id
- user_id
- title
- description
- source_type
- source_url nullable
- image_path nullable
- aesthetic_tags
- occasion_tags
- created_at

### lookbook_items
Allows linking a lookbook entry to owned garments and/or desired garment archetypes.
- id
- lookbook_entry_id
- garment_id nullable
- desired_item_json nullable
- role

### style_rules
Structured fashion rules.
- id
- rule_type
- subject_type
- subject_value
- predicate
- object_type
- object_value
- weight
- rule_scope (global, user)
- explanation
- active

Examples:
- beige blazer pairs_with navy trousers
- white shirt appropriate_for business casual
- linen trousers works_in_weather warm
- hoodie avoid_with formal office

### trend_signals
Global normalized trend records.
- id
- trend_type
- label
- normalized_attributes_json
- source_count
- source_authority_score
- recency_score
- season
- region
- first_seen_at
- last_seen_at

### trend_sources
- id
- trend_signal_id
- source_name
- source_url
- source_type
- observed_at
- raw_excerpt or summary
- authority_score

### user_trend_matches
- id
- user_id
- trend_signal_id
- match_type (exact, adjacent, missing_piece)
- score
- reasoning_json
- created_at

### weather_snapshots
- id
- user_id nullable
- location_key
- weather_date
- temp_min
- temp_max
- conditions
- precipitation_chance
- created_at

### occasion_profiles
- id
- user_id nullable
- label
- constraints_json
- created_at

---

## Functional requirements

## A. Wardrobe ingestion

Implement ingestion pipelines for:

### A1. Direct photo upload
Input:
- user uploads image

System should:
- store original image
- detect whether image contains one garment or multiple garments
- if one garment: create garment draft
- if multiple garments: either
  - prompt for selection, or
  - create multiple candidate garment drafts
- extract candidate metadata:
  - category
  - subcategory
  - colour
  - pattern
  - material if possible
  - fit / silhouette if possible
- preserve confidence scores
- require user confirmation before finalizing low-confidence drafts

### A2. Product URL / website image ingestion
Input:
- product URL or manually uploaded product screenshot

System should:
- fetch page metadata if URL ingestion is enabled
- extract product title, brand, displayed price, colour, category, images where available
- normalize into garment draft
- allow user edits before save

Note:
Avoid tightly coupling to one retailer. Build adapter-based ingestion.

### A3. Receipt ingestion
Input:
- receipt image, PDF, or line item text

System should:
- parse merchant and line items
- identify probable garment-like line items
- generate low-confidence garment drafts
- allow linking garment drafts to uploaded images later

### A4. Outfit decomposition
Input:
- full outfit photo

System should:
- identify distinct clothing items
- create separate garment candidates where possible
- store original outfit image as provenance/reference
- optionally allow saving as a lookbook entry or outfit reference at the same time

---

## B. Personal wardrobe

User can:
- view all garments
- filter by category, colour, brand, season, formality, wear frequency
- edit garment metadata
- archive garments
- mark garments unavailable / in laundry / packed / sold / donated
- log wears
- track wear count and cost per wear

Cost per wear rule:
- if purchase_price exists, cost_per_wear = purchase_price / max(wear_count, 1)
- recalculate on every wear event update
- if purchase_price missing, support nullable or estimated mode

---

## C. Lookbook

User can:
- save inspiration looks
- save outfit images
- save wishlist / target garments
- connect lookbook references to owned garments
- connect lookbook references to missing pieces

Lookbook must remain semantically distinct from wardrobe.

---

## D. Trend intelligence engine

Build a global trend pipeline.

### Inputs
Potential sources may later include:
- fashion publications
- runway summaries
- brand press releases
- colour reports
- trend articles
- curated fashion blogs

For MVP:
Do not overbuild crawling.
Create an architecture that supports:
- source adapters
- ingestion jobs
- normalization jobs
- scoring jobs

### Output
Normalize raw trend data into structured signals such as:
- colour trends
- silhouette trends
- garment archetypes
- material / texture trends
- styling pattern trends

Each trend signal should have:
- recency
- authority
- source agreement
- season
- optional regional relevance

### Matching
Per user, create matches:
- exact match: user owns the same thing
- adjacent match: user owns a similar thing
- missing piece: user does not own it but it would unlock a trend/look

This engine should be schedulable globally via cron.

Preferred architecture:
- scheduled function or job
- writes global trend tables
- separate user matching job or on-demand cache refresh

---

## E. Knowledge graph / rule engine

Implement a practical fashion rules layer.

This does not need a graph database in MVP.
Use Postgres tables and structured rules first.

The rule system should support:
- colour compatibility
- occasion appropriateness
- weather appropriateness
- layering compatibility
- silhouette balancing
- seasonality
- optional user preference overrides

Examples:
- blazer + trousers + shirt appropriate_for workwear
- knitwear layerable_with coat
- sandals avoid_with cold rain
- beige pairs_with navy
- formal dress shoes appropriate_for smart casual and formal

All rules must be inspectable and editable.

---

## F. Outfit generation

Build outfit generation as a constraint and ranking engine, not purely LLM output.

### Inputs
- user wardrobe
- weather
- occasion or event type
- dress code
- season
- garment availability
- recent wear history
- trend overlay optional
- user preferences optional

### Hard constraints
Examples:
- weather suitability
- occasion suitability
- required outfit roles present
- garment availability
- avoid incompatible categories

### Soft ranking
Examples:
- colour harmony
- silhouette balance
- novelty
- trend relevance
- underworn garment boost
- high versatility items
- repeat suppression

### Outputs
Return at least:
- one safe outfit
- one elevated / stylish outfit
- one trend-forward outfit if feasible

Each result should include explanation metadata.

---

## G. Weather-aware weekly planner

User can request outfits for a week.

System should support:
- day-by-day weather context
- occasion per day
- alternate options
- repeat avoidance across the week
- optional laundry awareness

---

## H. Content/IP policy

The system should do the following when collating information:
- Never store full publisher article bodies unless the source is licensed for that use.
- Never store or display publisher images unless licensed or embedded under permitted terms.
- Store only the minimum source text needed for classification and auditing.
- User-facing output must be normalized facts, tags, and scores, not article substitutes.
- Always retain source URL, publisher, title, and observed date.
- Respect robots.txt, source terms, and technical access controls.
- Prefer RSS, sitemap, API, and press-release endpoints over page scraping.
- Treat Pantone as a source signal, not as the app’s canonical colour system.
- Do not expose unlicensed Pantone swatch libraries, code tables, or Pantone-based colour conversion datasets in the product.

## Engineering requirements

## Code quality
- strong TypeScript types
- avoid `any` unless strictly necessary
- schema-first thinking
- zod validation for API boundaries
- clean service layer boundaries
- reusable domain modules
- no giant god files
- no duplicated business logic
- write tests for key rules and transformations

## App structure
Prefer clear folders such as:
- `app/`
- `components/`
- `lib/`
- `lib/domain/wardrobe`
- `lib/domain/lookbook`
- `lib/domain/outfits`
- `lib/domain/trends`
- `lib/domain/style-rules`
- `lib/integrations/`
- `supabase/functions/`
- `supabase/migrations/`

## Database
- use migrations
- add indexes for user_id, category, colour, wear_count, created_at
- use RLS for all user-owned tables
- global tables should be readable safely where appropriate
- keep personal and global data access explicit

## Storage
Use Supabase Storage buckets with a clear separation such as:
- `garment-originals`
- `garment-cutouts`
- `lookbook-images`
- `receipt-uploads`

## Async jobs
Use asynchronous processing for:
- image analysis
- receipt parsing
- trend ingestion
- embeddings
- outfit decomposition

Design job state tracking where needed.

---

## UX requirements

The UI should feel premium, clean, and structured.
Not noisy, not over-chatbotified.

Must support:
- garment card grid
- detail page per garment
- lookbook board or grid
- outfit builder canvas or structured outfit view
- easy edit / confirm flow after ingestion
- visible explanation for recommendations
- confidence-aware review flows

Do not bury structured metadata behind chat only.
Users should be able to edit:
- brand
- category
- colour
- size
- cost
- purchase date
- notes
- tags

---

## Build order

Codex should implement in this order unless blocked:

### Phase 1
1. audit existing repo structure
2. design schema and write migrations
3. implement core types and validation
4. implement wardrobe CRUD
5. implement wear events and cost-per-wear recalculation
6. implement lookbook CRUD
7. implement garment image storage plumbing
8. create seed style rules

### Phase 2
9. implement garment ingestion draft flow
10. implement direct upload pipeline scaffold
11. implement product URL ingestion scaffold
12. implement receipt ingestion scaffold
13. implement outfit decomposition scaffold

### Phase 3
14. implement outfit rule engine
15. implement weather-aware outfit generator
16. implement explanation payloads
17. implement weekly planning support

### Phase 4
18. implement trend signal schema and services
19. implement global trend ingestion cron architecture
20. implement user trend matching
21. implement trend-to-wardrobe UI surfaces

---

## Output expectations for Codex

When working on this repo:
- first inspect the codebase and summarize current architecture
- identify what already exists vs what must be added
- propose the smallest viable implementation path
- then implement incrementally
- after each major change:
  - explain what changed
  - explain why
  - list touched files
  - list follow-up work
  - run relevant checks if available

Do not:
- invent fake integrations
- silently skip edge cases
- produce placeholder architecture with no real wiring
- overcomplicate with premature microservices

Prefer:
- production-shaped monolith / modular app
- explicit domain modules
- testable business logic
- clear migrations and policies

---

## First task

Start by doing the following:

1. inspect the current repository structure
2. identify whether this is greenfield or an existing app
3. produce a gap analysis against the target product above
4. propose the concrete schema
5. generate the first migration set
6. scaffold the domain modules for:
   - wardrobe
   - lookbook
   - wear-events
   - style-rules
   - outfits
   - trends
7. implement the smallest end-to-end vertical slice:
   - create garment
   - upload garment image
   - list garments
   - log wear
   - recalculate cost per wear

Then stop and summarize before moving to ingestion intelligence.

---

## Notes for reasoning
This is a fashion product.
The logic should reflect actual product semantics:
- wardrobe is owned clothing
- lookbook is inspiration / planning / references
- outfits are combinations
- trends are global structured signals
- style rules are durable logic
- recommendations must be explainable

Optimize for a premium consumer app with strong data foundations.
