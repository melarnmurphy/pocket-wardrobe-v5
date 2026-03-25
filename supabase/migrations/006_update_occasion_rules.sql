-- 006_update_occasion_rules.sql
-- Expands occasion_fit rules to cover the full occasion taxonomy:
-- active, beach, business_casual, casual, evening, formal_evening,
-- lifestyle_sport, smart_casual, streetwear, wardrobe_essentials, workwear.
-- The 7 original occasion_fit rows from 005 are kept (business_casual + evening).
-- New rules are inserted; ON CONFLICT DO NOTHING makes this re-runnable.

begin;

insert into public.style_rules
  (rule_type, subject_type, subject_value, predicate, object_type, object_value, weight, rule_scope, explanation, constraint_type)
values
  -- WORKWEAR
  ('occasion_fit','category','white shirt','appropriate_for','occasion','workwear',0.95,'global','A white shirt is a reliable and versatile workwear base layer.','soft'),
  ('occasion_fit','category','blazer','appropriate_for','occasion','workwear',0.92,'global','A blazer adds structure and intention to a workwear look.','soft'),
  ('occasion_fit','category','tailored trousers','appropriate_for','occasion','workwear',0.9,'global','Tailored trousers are a core workwear piece that anchors polished dressing.','soft'),
  ('occasion_fit','category','loafers','appropriate_for','occasion','workwear',0.84,'global','Loafers are a smart, low-effort workwear shoe that bridges casual and professional.','soft'),
  -- SMART CASUAL
  ('occasion_fit','category','blazer','appropriate_for','occasion','smart_casual',0.88,'global','A blazer elevates smart-casual outfits without requiring full suiting.','soft'),
  ('occasion_fit','category','chinos','appropriate_for','occasion','smart_casual',0.85,'global','Chinos sit comfortably in smart-casual territory — polished without being stiff.','soft'),
  ('occasion_fit','category','polo shirt','appropriate_for','occasion','smart_casual',0.8,'global','A polo shirt reads polished enough for smart-casual occasions.','soft'),
  ('occasion_fit','category','loafers','appropriate_for','occasion','smart_casual',0.82,'global','Loafers are a versatile smart-casual shoe that works across many settings.','soft'),
  -- CASUAL
  ('occasion_fit','category','sneakers','appropriate_for','occasion','casual',0.9,'global','Sneakers are a safe and easy casual footwear base.','soft'),
  ('occasion_fit','category','denim jacket','appropriate_for','occasion','casual',0.82,'global','A denim jacket reads casual and relaxed across most settings.','soft'),
  ('occasion_fit','category','t-shirt','appropriate_for','occasion','casual',0.88,'global','A t-shirt is the foundation of casual dressing.','soft'),
  ('occasion_fit','category','jeans','appropriate_for','occasion','casual',0.87,'global','Jeans are the most versatile casual bottom and a wardrobe staple.','soft'),
  -- FORMAL / EVENING
  ('occasion_fit','category','evening dress','appropriate_for','occasion','formal_evening',0.95,'global','An evening dress is purpose-built for formal and evening occasions.','soft'),
  ('occasion_fit','category','heels','appropriate_for','occasion','formal_evening',0.88,'global','Heels elevate a look for formal and evening settings.','soft'),
  ('occasion_fit','category','suit','appropriate_for','occasion','formal_evening',0.9,'global','A suit reads well at formal evening events depending on fabrication and styling.','soft'),
  ('occasion_fit','category','silk top','appropriate_for','occasion','formal_evening',0.85,'global','A silk top transitions naturally into evening dressing.','soft'),
  -- EVENING
  ('occasion_fit','category','silk top','appropriate_for','occasion','evening',0.82,'global','A silk top reads elevated and is well-suited to evening dressing.','soft'),
  -- STREETWEAR
  ('occasion_fit','category','hoodie','appropriate_for','occasion','streetwear',0.9,'global','A hoodie is a streetwear staple — relaxed, graphic-friendly, and urban in feel.','soft'),
  ('occasion_fit','category','sneakers','appropriate_for','occasion','streetwear',0.92,'global','Sneakers are central to streetwear styling.','soft'),
  ('occasion_fit','category','bomber jacket','appropriate_for','occasion','streetwear',0.88,'global','A bomber jacket is a classic streetwear outer layer.','soft'),
  ('occasion_fit','category','track pants','appropriate_for','occasion','streetwear',0.85,'global','Track pants are a streetwear-coded bottom that reads relaxed and intentional.','soft'),
  -- BEACH
  ('occasion_fit','category','bikini','appropriate_for','occasion','beach',0.98,'global','A bikini is the core beach and swimwear piece.','soft'),
  ('occasion_fit','category','beach dress','appropriate_for','occasion','beach',0.92,'global','A beach dress or cover-up is a natural transition piece from water to shore.','soft'),
  ('occasion_fit','category','sandals','appropriate_for','occasion','beach',0.9,'global','Sandals are the go-to beach footwear.','soft'),
  -- ACTIVE
  ('occasion_fit','category','leggings','appropriate_for','occasion','active',0.95,'global','Leggings are a core active and athletic bottom.','soft'),
  ('occasion_fit','category','sports top','appropriate_for','occasion','active',0.92,'global','A sports top or base layer is suited to active and training occasions.','soft'),
  ('occasion_fit','category','trainers','appropriate_for','occasion','active',0.95,'global','Trainers are the standard footwear for active and athletic wear.','soft'),
  -- LIFESTYLE SPORT
  ('occasion_fit','category','polo shirt','appropriate_for','occasion','lifestyle_sport',0.88,'global','A polo shirt has strong lifestyle-sport roots and works well in relaxed outdoor settings.','soft'),
  ('occasion_fit','category','sneakers','appropriate_for','occasion','lifestyle_sport',0.85,'global','Sneakers bridge active and lifestyle-sport dressing comfortably.','soft'),
  ('occasion_fit','category','chinos','appropriate_for','occasion','lifestyle_sport',0.78,'global','Chinos work in lifestyle-sport contexts when paired with a clean top.','soft'),
  -- WARDROBE ESSENTIALS
  ('occasion_fit','category','white t-shirt','appropriate_for','occasion','wardrobe_essentials',0.95,'global','A white t-shirt is the most foundational wardrobe essential.','soft'),
  ('occasion_fit','category','jeans','appropriate_for','occasion','wardrobe_essentials',0.95,'global','Jeans are a wardrobe essential that anchors casual dressing across decades.','soft'),
  ('occasion_fit','category','white shirt','appropriate_for','occasion','wardrobe_essentials',0.92,'global','A white shirt is a versatile essential that works across casual, smart, and formal settings.','soft'),
  ('occasion_fit','category','trench coat','appropriate_for','occasion','wardrobe_essentials',0.9,'global','A trench coat is a transitional essential that works across seasons and settings.','soft'),
  ('occasion_fit','category','blazer','appropriate_for','occasion','wardrobe_essentials',0.88,'global','A well-fitted blazer is a core wardrobe essential that elevates almost any outfit.','soft')
on conflict do nothing;

commit;
