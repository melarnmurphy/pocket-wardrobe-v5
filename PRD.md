# Pocket Wardrobe — Opinionated Product Requirements Document

## 1. Product overview

Pocket Wardrobe is a **personal wardrobe operating system** that helps users:

- digitise what they own,
- understand what works together,
- plan outfits for weather and occasion,
- track cost per wear,
- compare their wardrobe to global fashion signals,
- identify underused items,
- and identify the smallest number of purchases that would unlock the most additional outfits.

This product is **not**:

- a Pinterest clone,
- an RSS reader,
- a runway-image archive,
- a chatbot that guesses outfits from unstructured text,
- or a product that republishes Vogue, Pantone, or other publisher content.

This product **is**:

- a structured wardrobe database,
- a fashion rule engine,
- a colour intelligence system,
- a trend signal normalization system,
- and an explainable outfit recommendation engine.

---

## 2. Product thesis

Most wardrobe apps stop at storage. Pocket Wardrobe should go further and become a **decision engine**.

The product should help users answer:

1. What do I actually own?
2. What should I wear today or this week?
3. What trends do I already own?
4. What single item would unlock the most outfits?
5. Why do some clothes never get worn?

The defensible moat is the combination of:

- strong real-world ingestion,
- structured garment records,
- colour intelligence,
- explainable fashion rules,
- weather and occasion-aware outfit generation,
- trend normalization,
- and wardrobe-first matching.

---

## 3. Product principles

### 3.1 Structured first, AI second

The system should rely primarily on:

- structured garment records,
- colour data,
- style rules,
- occasion constraints,
- trend signals,
- and ranking logic.

LLMs are permitted for:

- summarization,
- classification assistance,
- ingestion fallback,
- explanation generation.

LLMs must **not** be the primary source of outfit logic.

### 3.2 Garments are the core entity

The core object is **not** an uploaded image.  
The core object is a **garment record**.

Images, URLs, receipts, and outfit photos are just **sources** that create or enrich garments.

### 3.3 Wardrobe and lookbook are separate

A user’s **wardrobe** is what they own.  
A user’s **lookbook** is inspiration, saved looks, wishlist references, missing pieces, target aesthetics, and outfit ideas.

Do not collapse these into one table.

### 3.4 Trend ingestion must be IP-safe

The system should ingest **signals**, not **content**.

The app should **not** say:

> “Here are the 8 Vogue takeaways,” followed by rewritten article summaries and copied runway images.

It should say:

> “This week’s global signals show a rise in soft white neutrals, deep olive, and relaxed tailoring across major fashion coverage.”

Then underneath:

- Source count: 9
- Source types: fashion publications, runway coverage, brand releases
- Confidence: high
- Links: original sources

That is a **trend intelligence product**, not a **content-republishing product**.

### 3.5 Pantone is a source signal, not a system dependency

Pantone or any similar proprietary colour publication should be treated only as an **input signal source**.

The app must run on its own internal colour ontology:

- hex,
- rgb,
- lab,
- lch,
- family,
- undertone,
- saturation band,
- lightness band.

The product must not depend on proprietary colour IDs to function.

### 3.6 Explainability is mandatory

Every recommendation should carry machine-readable reasoning where practical:

- why this outfit was chosen,
- why a garment matches a trend,
- why an item is underused,
- why something is missing,
- why a colour pairing works.

### 3.7 Wardrobe-first recommendations

Trend matching should prefer:

1. You already own this.
2. You own something adjacent.
3. You can style into this.
4. You are missing one key piece.

The app should not immediately push shopping.

---

## 4. Target users

### 4.1 Primary user
A fashion-aware consumer who wants practical wardrobe help rather than social validation.

Characteristics:
- owns enough clothing to benefit from structure,
- cares about style, outfit planning, or overbuying,
- wants to make better use of what they already own,
- wants practical recommendations for weather, work, events, and weekends.

### 4.2 Secondary user
A user who is trying to reduce unnecessary spending by improving:
- cost per wear,
- wardrobe reuse,
- purchase discipline,
- and trend-aware shopping.

### 4.3 Future users
Potential later segments:
- stylists,
- resale-focused users,
- premium concierge users,
- capsule wardrobe planners,
- travel packers.

These are not MVP priorities.

---

## 5. Jobs to be done

### Functional jobs
- Capture clothes from messy real-world inputs.
- View and maintain a clean wardrobe inventory.
- Save inspirational looks separately from owned items.
- Generate outfits for weather and occasion.
- Understand colour compatibility and style logic.
- See what is trending without reading every source.
- Match trends to owned garments.
- Log wears and recalculate cost per wear.

### Emotional jobs
- Reduce decision fatigue.
- Reduce guilt about unworn clothing.
- Feel more stylish using what is already owned.
- Shop more confidently and selectively.

### Financial jobs
- Improve cost per wear.
- Reduce redundant purchases.
- Identify one-item purchases with high wardrobe leverage.
- Surface underused items before buying more.

---

## 6. Core product modules

## 6.1 Wardrobe ingestion

Users can add clothing from:

- product URLs,
- website screenshots,
- direct photos,
- receipt line items,
- full outfit photos that are decomposed into separate items.

### Ingestion source types
- `product_url`
- `website_image`
- `direct_upload`
- `receipt`
- `outfit_decomposition`
- `manual_entry`

### Ingestion principles
- Preserve source provenance.
- Preserve confidence scores.
- Use drafts for low-confidence extraction.
- Require user confirmation where certainty is weak.

## 6.2 Wardrobe management

Users can:

- view garments,
- filter by category, colour, brand, seasonality, wear frequency, and formality,
- edit garment metadata,
- archive garments,
- mark garments unavailable / in laundry / packed / sold / donated,
- log wear events,
- view cost per wear.

## 6.3 Lookbook

Users can save:

- inspiration outfits,
- editorial references,
- celebrity looks,
- wishlist items,
- missing-piece placeholders,
- AI-generated styling targets.

The lookbook must remain semantically distinct from wardrobe.

## 6.4 Colour intelligence engine

The app should understand:

- dominant garment colours,
- undertones,
- complementary / analogous / tonal pairings,
- trend-colour alignment,
- wardrobe colour gaps.

## 6.5 Style rules / knowledge graph

The system should know things like:

- beige blazer pairs with navy trouser,
- sandals are poor choices in cold rain,
- wide-leg trousers work with fitted tops,
- white shirt is appropriate for business casual,
- tonal dressing can be ranked highly for minimal aesthetics.

The MVP can implement this in structured Postgres tables before any dedicated graph database.

## 6.6 Outfit generator

The outfit engine should use:

- weather,
- occasion,
- garment availability,
- colour harmony,
- silhouette balance,
- trend overlay,
- repeat avoidance,
- user preference.

## 6.7 Trend intelligence engine

The app should extract structured signals from:

- fashion publications,
- runway coverage,
- press releases,
- colour reports,
- brand newsrooms,
- curated sources.

The trend system should store **signals and metadata**, not article bodies or editorial image archives.

---

## 7. Detailed user flows

## 7.1 Direct photo upload
1. User uploads an image.
2. System stores the original image in storage.
3. System determines whether it contains one garment or multiple garments.
4. System generates one or more garment drafts.
5. System extracts candidate metadata:
   - category,
   - subcategory,
   - colour,
   - pattern,
   - material if possible,
   - fit or silhouette if possible.
6. User reviews and confirms or edits the garment draft.
7. Confirmed draft becomes a garment record.

## 7.2 Product URL ingestion
1. User submits a product URL.
2. System captures page metadata, title, brand, displayed price, colour, category, and image references where possible.
3. System normalizes that into a garment draft.
4. User reviews and saves.

The architecture should be adapter-based and not tightly coupled to one retailer.

## 7.3 Receipt ingestion
1. User uploads a receipt image, PDF, or line-item text.
2. System extracts probable garment-like items.
3. System creates low-confidence garment drafts.
4. User may add or attach images later.

## 7.4 Outfit decomposition
1. User uploads a full outfit image.
2. System identifies distinct clothing items.
3. System generates separate garment candidates.
4. System stores the original outfit image as provenance.
5. User may save both:
   - individual garments,
   - and the original image as an outfit or lookbook reference.

## 7.5 Wear logging
1. User logs a wear on a garment or outfit.
2. System stores a wear event.
3. Garment wear count increments.
4. Cost per wear recalculates if purchase price exists.

## 7.6 Weekly planning
1. User chooses days, weather context, and occasion or function.
2. System generates:
   - safe option,
   - elevated option,
   - trend-forward option if feasible.
3. User may save one as an outfit.
4. System should avoid excessive repetition across the week.

---

## 8. Wardrobe object model

## 8.1 Garment
A garment is a structured record representing an owned item.

Suggested fields include:

- title,
- description,
- brand,
- category,
- subcategory,
- pattern,
- material,
- size,
- fit,
- formality level,
- seasonality,
- wardrobe status,
- purchase price,
- currency,
- purchase date,
- retailer,
- wear count,
- last worn at,
- cost per wear,
- favourite score,
- versatility score,
- extraction metadata.

## 8.2 Garment sources
A garment source tracks how a garment entered the system.

Examples:
- direct upload,
- product URL,
- receipt,
- outfit decomposition,
- manual entry.

## 8.3 Garment drafts
Low-confidence ingestion results must live in draft form before becoming permanent garments.

## 8.4 Wear events
Every wear should be stored as an event so analytics remain reconstructable.

## 8.5 Lookbook entries
A lookbook entry represents inspiration, target styling, or desired items.

## 8.6 Outfits
An outfit is a saved or generated collection of garments with context:
- occasion,
- dress code,
- weather,
- explanation,
- source type.

---

## 9. Colour system requirements

Colour must be a **first-class subsystem**.

## 9.1 Canonical colour model

Every colour used in the system should be stored in canonical form as:

- hex,
- rgb,
- lab,
- lch,
- family,
- undertone,
- saturation band,
- lightness band,
- neutral flag.

The app must not treat colour as only a free-text label such as “blue” or “beige”.

## 9.2 Garment colours

A garment may have multiple colours.

The system should support:
- one or more colours per garment,
- dominance weighting,
- primary colour flag.

Examples:
- navy blazer -> one dominant navy colour,
- floral dress -> multiple colours,
- stripe shirt -> two main colours.

## 9.3 Colour relationship engine

The system must calculate which colours work well together.

Relationship types should include:
- complementary,
- analogous,
- split complementary,
- triadic,
- tonal,
- neutral pairing,
- high contrast,
- low contrast,
- monochrome,
- warm/cool balance.

## 9.4 Complementary colour algorithm

Do not rely only on naive HSL hue rotation.

Use a layered approach:

### Math layer
Convert hex to LAB/LCH and calculate:
- complementary,
- analogous,
- split-complementary,
- triadic,
- tonal,
- monochrome,
- contrast distance.

### Fashion layer
Apply style rules such as:
- neutrals pair broadly,
- one statement colour per outfit,
- workwear should reduce saturation,
- tonal looks can be ranked highly,
- high-contrast looks skew more editorial or casual unless balanced,
- warm/cool undertone clashes may be penalized unless intentional.

### Occasion layer
Apply modifiers:
- officewear -> prefer low-to-medium contrast and neutrals,
- evening -> permit stronger contrast,
- weekend casual -> allow more colour play,
- formal -> stronger weight on coherence and polished tonal structure.

## 9.5 Visual approximation derivations for colour palettes

This is how the app handles trend colours safely.

For every source colour:
1. capture source metadata:
   - source name,
   - source label,
   - date,
   - season,
   - region.
2. assign an approximate visual value:
   - canonical hex,
   - canonical rgb.
3. derive perceptual values:
   - lab,
   - lch.
4. derive classification tags:
   - family,
   - undertone,
   - saturation band,
   - lightness band.
5. compare to garment palette using colour distance.

This lets the app say:
- you already own colours adjacent to this trend,
- your wardrobe is mostly cool-toned,
- a navy trouser would unlock 14 outfits,
- this trend aligns with your existing neutral palette.

without depending on proprietary colour systems.

---

## 10. Trend ingestion and IP-safe content policy

## 10.1 Trend engine purpose

The trend engine exists to identify and normalize:
- colour trends,
- garment archetypes,
- silhouettes,
- materials,
- patterns,
- styling patterns,
- occasions,
- aesthetics,
- era influences.

It does **not** exist to republish articles.

## 10.2 Allowed source outputs

The trend pipeline may store:
- source URL,
- publication name,
- title,
- publish date,
- source type,
- short excerpt if needed for classification,
- normalized trend signals,
- confidence score,
- source count,
- reason metadata.

## 10.3 Disallowed default behavior

The system must not store or display by default:
- full publisher article bodies,
- copied runway or editorial images,
- long rewritten summaries that substitute for the original source,
- proprietary colour libraries.

## 10.4 Preferred source access order

Prefer, in order:
1. official RSS feeds,
2. official sitemaps,
3. official press releases or newsroom pages,
4. official event pages,
5. curated manual entry,
6. only limited page extraction where necessary and compliant.

## 10.5 Product-safe output format

Trend output should be normalized and source-linked.

Good:
> “This week’s signals show growth in soft white neutrals, deep olive, and relaxed tailoring.”

Bad:
> “Here are Vogue’s 8 runway takeaways,” followed by rewritten summaries and reused images.

## 10.6 Trend cards should show

- Global signal label,
- confidence,
- source count,
- source types,
- why it matters,
- user match,
- suggested action,
- links to original sources.

Example:
- Global signal: soft white neutrals, deep olive, relaxed tailoring
- Confidence: high
- Source count: 9
- Source types: fashion publications, runway coverage, brand releases
- Why it matters: maps strongly to business-casual and minimal wardrobes
- Your match: 2 adjacent items and 1 direct match
- Suggested action: style beige blazer with white or olive-accented pieces
- Links: original sources only

---

## 11. Pantone-safe strategy

Pantone or equivalent proprietary colour publishers should be treated as source signals only.

### Allowed
- source name,
- source label,
- source URL,
- observed at,
- season,
- approximate canonical colour mapping.

### Not allowed
- building the app around proprietary Pantone IDs,
- shipping a swatch library based on proprietary data,
- claiming exact equivalence unless licensed,
- depending on proprietary colour codes for outfit logic.

The app must always transform source colours into its own internal visual approximation model.

---

## 12. Outfit generation requirements

## 12.1 Inputs
- user wardrobe,
- weather,
- occasion or event type,
- dress code,
- season,
- garment availability,
- recent wear history,
- trend overlay,
- user preferences.

## 12.2 Hard constraints
Examples:
- weather suitability,
- occasion suitability,
- required outfit roles present,
- garment availability,
- avoid incompatible categories.

## 12.3 Soft ranking
Examples:
- colour harmony,
- silhouette balance,
- novelty,
- trend relevance,
- underworn garment boost,
- high versatility items,
- repeat suppression.

## 12.4 Output modes
Return at least:
- one safe outfit,
- one elevated or stylish outfit,
- one trend-forward outfit if feasible.

## 12.5 Explanation metadata
Each result should include explanation metadata describing:
- why it was selected,
- colour logic,
- occasion fit,
- weather fit,
- trend alignment if relevant.

---

## 13. Weekly weather and occasion planning

The app should support weekly planning with:
- day-by-day weather context,
- occasion per day,
- alternate options,
- repeat avoidance,
- optional laundry awareness.

This is a core retention feature, not an optional flourish.

---

## 14. Cost per wear and wardrobe analytics

## 14.1 Cost per wear
If purchase price exists:

`cost_per_wear = purchase_price / max(wear_count, 1)`

Recalculate whenever wear events change.

## 14.2 Analytics opportunities
The app should be able to answer:
- which items are underworn,
- which categories dominate the wardrobe,
- which colours are overrepresented,
- which gaps reduce outfit options,
- which items are high-value anchors,
- which items have poor matching coverage.

---

## 15. Knowledge graph / style-rule requirements

The MVP does not require a dedicated graph database.

Implement structured rules first in Postgres.

The rule system should support:
- colour compatibility,
- occasion appropriateness,
- weather appropriateness,
- layering compatibility,
- silhouette balancing,
- seasonality,
- optional user preference overrides.

Examples:
- blazer + trousers + shirt appropriate_for workwear
- knitwear layerable_with coat
- sandals avoid_with cold rain
- beige pairs_with navy
- formal dress shoes appropriate_for smart casual and formal

Rules must be inspectable and editable.

---

## 16. Data and platform architecture

## 16.1 Backend
Use Supabase for:
- Auth,
- Postgres,
- RLS,
- Storage,
- Edge Functions,
- Cron scheduling,
- pgvector if needed.

## 16.2 Storage buckets
Recommended buckets:
- `garment-originals`
- `garment-cutouts`
- `lookbook-images`
- `receipt-uploads`
- `source-thumbnails`

## 16.3 Async jobs
Use async processing for:
- image analysis,
- receipt parsing,
- trend ingestion,
- embeddings,
- outfit decomposition,
- colour extraction.

Track job state where needed.

---

## 17. Security, privacy, and data ownership

## 17.1 User-owned tables
User-owned data must be protected with RLS.

This includes:
- garments,
- garment sources,
- garment images,
- garment drafts,
- garment colours,
- wear events,
- lookbook entries,
- lookbook items,
- outfits,
- outfit items,
- user trend matches,
- user occasion profiles,
- user weather preferences if later added.

## 17.2 Global tables
Global readable tables may include:
- colours,
- colour relationships,
- trend signals,
- trend sources,
- trend signal sources,
- trend colours,
- style rules where scope is global.

Writes to global tables should be service-side only.

## 17.3 Privacy
Do not expose user wardrobe data in global trend pipelines.
Global trend jobs must be logically separate from personal recommendations.

---

## 18. MVP scope

## Must-have
- garment CRUD,
- garment ingestion draft flow,
- garment images,
- wear logging,
- cost per wear,
- lookbook,
- colour extraction and garment colour mapping,
- base colour relationship engine,
- style rules,
- weather + occasion outfit suggestions,
- trend signal ingestion scaffold,
- IP-safe trend display,
- user trend matching.

## Later
- resale export,
- social sharing,
- marketplace integrations,
- influencer boards,
- advanced retailer scrapers,
- premium licensed publisher feeds,
- stylist concierge mode,
- native mobile app if needed.

---

## 19. Build order

1. Create schema and migrations for wardrobe, lookbook, outfits, style rules.
2. Add colour tables and colour utilities.
3. Add trend tables and trend ingestion job tracking.
4. Implement RLS.
5. Build garment CRUD.
6. Build wear logging and cost-per-wear recalculation.
7. Build lookbook CRUD.
8. Build colour derivation utilities:
   - hex -> rgb,
   - rgb -> lab,
   - lab -> lch,
   - colour distance.
9. Build colour relationship generation.
10. Build garment colour mapping flow.
11. Build trend source ingestion adapters:
   - RSS,
   - sitemap,
   - press release,
   - curated manual adapter.
12. Build trend normalization.
13. Build user trend matching.
14. Build outfit colour scoring.
15. Build outfit generator with weather and occasion.

---

## 20. Success criteria

The MVP is successful if a user can:

- create and maintain a clean wardrobe,
- save inspiration separately from owned items,
- log wears and see cost per wear,
- receive usable outfit recommendations,
- understand why recommendations were made,
- see trend signals without the app behaving like a publisher-summary product,
- and identify practical next steps using their existing wardrobe.

---

## 21. Product positioning

Pocket Wardrobe is a wardrobe operating system that turns a user’s clothes into a structured decision engine for styling, trend matching, and smarter buying.
