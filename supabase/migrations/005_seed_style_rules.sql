-- 005_seed_style_rules.sql
-- Adds constraint_type column, partial unique index on global rules,
-- removes 5 legacy hand-coded seed rows from 001, and inserts full seed set.

begin;

-- Step 1: Add constraint_type column
alter table public.style_rules
  add column if not exists constraint_type text not null default 'soft'
    check (constraint_type in ('hard', 'soft'));

-- Step 2: Partial unique index on global rules only.
-- Prevents duplicate global seeds on re-run. Does NOT block two different
-- users from each holding the same semantic rule as a personal override.
create unique index if not exists idx_style_rules_global_unique
  on public.style_rules (rule_type, subject_type, subject_value, predicate, object_type, object_value)
  where rule_scope = 'global';

-- Step 3: Delete the 5 legacy rows from migration 001.
-- The beige/navy row (colour_pairing) is not re-inserted — it is replaced
-- by the beige/brown analogous pair from buildSeedStyleRules().
-- The other 4 are re-inserted in step 4 with correct constraint_type.
delete from public.style_rules
where rule_scope = 'global'
  and (rule_type, subject_type, subject_value, predicate, object_type, object_value) in (
    ('colour_pairing', 'colour_family', 'beige',            'pairs_with',      'colour_family', 'navy'),
    ('occasion_fit',   'category',      'white shirt',      'appropriate_for', 'occasion',      'business_casual'),
    ('weather_fit',    'category',      'sandals',          'avoid_with',      'weather',       'cold_rain'),
    ('layering',       'category',      'knitwear',         'layerable_with',  'category',      'coat'),
    ('silhouette',     'category',      'wide_leg_trousers','pairs_with',      'category',      'fitted_top')
  );

-- Step 4: Insert full seed set (~112 rules).
-- ON CONFLICT DO NOTHING makes this re-runnable safely.
insert into public.style_rules
  (rule_type, subject_type, subject_value, predicate, object_type, object_value, weight, rule_scope, explanation, constraint_type)
values
  -- COLOUR: complementary (8 rows)
  ('colour_complement','colour_family','blue','pairs_with','colour_family','orange',0.96,'global','Blue and orange create a high-contrast pairing that reads bold and intentional.','soft'),
  ('colour_complement','colour_family','orange','pairs_with','colour_family','blue',0.96,'global','Blue and orange create a high-contrast pairing that reads bold and intentional.','soft'),
  ('colour_complement','colour_family','green','pairs_with','colour_family','red',0.96,'global','Green and red can create a sharp, editorial contrast when the tones are controlled.','soft'),
  ('colour_complement','colour_family','red','pairs_with','colour_family','green',0.96,'global','Green and red can create a sharp, editorial contrast when the tones are controlled.','soft'),
  ('colour_complement','colour_family','purple','pairs_with','colour_family','yellow',0.96,'global','Purple and yellow create vivid contrast that feels directional rather than safe.','soft'),
  ('colour_complement','colour_family','yellow','pairs_with','colour_family','purple',0.96,'global','Purple and yellow create vivid contrast that feels directional rather than safe.','soft'),
  ('colour_complement','colour_family','black','pairs_with','colour_family','white',0.96,'global','Black and white delivers a clear high-contrast look with very low styling friction.','soft'),
  ('colour_complement','colour_family','white','pairs_with','colour_family','black',0.96,'global','Black and white delivers a clear high-contrast look with very low styling friction.','soft'),
  -- COLOUR: analogous (12 rows)
  ('colour_analogous','colour_family','blue','pairs_with','colour_family','purple',0.88,'global','Blue and purple sit close on the colour wheel, which makes them feel tonal and smooth.','soft'),
  ('colour_analogous','colour_family','purple','pairs_with','colour_family','blue',0.88,'global','Blue and purple sit close on the colour wheel, which makes them feel tonal and smooth.','soft'),
  ('colour_analogous','colour_family','red','pairs_with','colour_family','pink',0.88,'global','Red and pink read as adjacent shades, producing a soft but still polished tonal story.','soft'),
  ('colour_analogous','colour_family','pink','pairs_with','colour_family','red',0.88,'global','Red and pink read as adjacent shades, producing a soft but still polished tonal story.','soft'),
  ('colour_analogous','colour_family','yellow','pairs_with','colour_family','orange',0.88,'global','Yellow and orange produce warmth and a cohesive sunlit palette.','soft'),
  ('colour_analogous','colour_family','orange','pairs_with','colour_family','yellow',0.88,'global','Yellow and orange produce warmth and a cohesive sunlit palette.','soft'),
  ('colour_analogous','colour_family','green','pairs_with','colour_family','yellow',0.88,'global','Green and yellow feel fresh and adjacent, especially in spring and summer dressing.','soft'),
  ('colour_analogous','colour_family','yellow','pairs_with','colour_family','green',0.88,'global','Green and yellow feel fresh and adjacent, especially in spring and summer dressing.','soft'),
  ('colour_analogous','colour_family','beige','pairs_with','colour_family','brown',0.88,'global','Beige and brown create depth within a neutral palette without losing harmony.','soft'),
  ('colour_analogous','colour_family','brown','pairs_with','colour_family','beige',0.88,'global','Beige and brown create depth within a neutral palette without losing harmony.','soft'),
  ('colour_analogous','colour_family','grey','pairs_with','colour_family','black',0.88,'global','Grey and black create restrained tonal contrast that stays clean and urban.','soft'),
  ('colour_analogous','colour_family','black','pairs_with','colour_family','grey',0.88,'global','Grey and black create restrained tonal contrast that stays clean and urban.','soft'),
  -- COLOUR: triadic (12 rows)
  ('colour_triadic','colour_family','blue','pairs_with','colour_family','red',0.8,'global','Blue, red, and yellow form a classic triadic palette with balanced energy.','soft'),
  ('colour_triadic','colour_family','blue','pairs_with','colour_family','yellow',0.8,'global','Blue, red, and yellow form a classic triadic palette with balanced energy.','soft'),
  ('colour_triadic','colour_family','red','pairs_with','colour_family','blue',0.8,'global','Blue, red, and yellow form a classic triadic palette with balanced energy.','soft'),
  ('colour_triadic','colour_family','red','pairs_with','colour_family','yellow',0.8,'global','Blue, red, and yellow form a classic triadic palette with balanced energy.','soft'),
  ('colour_triadic','colour_family','yellow','pairs_with','colour_family','blue',0.8,'global','Blue, red, and yellow form a classic triadic palette with balanced energy.','soft'),
  ('colour_triadic','colour_family','yellow','pairs_with','colour_family','red',0.8,'global','Blue, red, and yellow form a classic triadic palette with balanced energy.','soft'),
  ('colour_triadic','colour_family','green','pairs_with','colour_family','orange',0.8,'global','Green, orange, and purple create a lively but stable triadic story.','soft'),
  ('colour_triadic','colour_family','green','pairs_with','colour_family','purple',0.8,'global','Green, orange, and purple create a lively but stable triadic story.','soft'),
  ('colour_triadic','colour_family','orange','pairs_with','colour_family','green',0.8,'global','Green, orange, and purple create a lively but stable triadic story.','soft'),
  ('colour_triadic','colour_family','orange','pairs_with','colour_family','purple',0.8,'global','Green, orange, and purple create a lively but stable triadic story.','soft'),
  ('colour_triadic','colour_family','purple','pairs_with','colour_family','green',0.8,'global','Green, orange, and purple create a lively but stable triadic story.','soft'),
  ('colour_triadic','colour_family','purple','pairs_with','colour_family','orange',0.8,'global','Green, orange, and purple create a lively but stable triadic story.','soft'),
  -- WEATHER (8 rows)
  ('weather_fit','category','sandals','avoid_with','weather','cold_rain',0.99,'global','Sandals are generally a poor choice in cold rainy weather.','soft'),
  ('weather_fit','category','coat','works_in_weather','weather','cold_rain',0.95,'global','A coat is one of the safest outer layers for cold rainy conditions.','soft'),
  ('weather_fit','category','boots','works_in_weather','weather','cold_rain',0.94,'global','Boots usually handle wet streets and lower temperatures better than open footwear.','soft'),
  ('weather_fit','category','knitwear','works_in_weather','weather','cool_breeze',0.9,'global','Knitwear adds insulation without the weight of a full coat in cooler breezy weather.','soft'),
  ('weather_fit','category','linen trousers','works_in_weather','weather','warm_sun',0.92,'global','Linen trousers breathe well and stay comfortable in warmer sunny weather.','soft'),
  ('weather_fit','category','t-shirt','works_in_weather','weather','warm_sun',0.88,'global','A t-shirt is a reliable warm-weather base because it is breathable and easy to layer lightly.','soft'),
  ('weather_fit','category','blazer','works_in_weather','weather','mild_clear',0.78,'global','A blazer is often most comfortable in mild weather when outerwear is optional.','soft'),
  ('weather_fit','category','loafer','works_in_weather','weather','mild_clear',0.82,'global','Loafers work best in dry mild weather where a polished low-profile shoe is practical.','soft'),
  -- OCCASION (7 rows)
  ('occasion_fit','category','white shirt','appropriate_for','occasion','business_casual',0.95,'global','A white shirt is a strong business-casual base layer.','soft'),
  ('occasion_fit','category','blazer','appropriate_for','occasion','business_casual',0.92,'global','A blazer makes business-casual outfits feel intentional without forcing full suiting.','soft'),
  ('occasion_fit','category','tailored trousers','appropriate_for','occasion','business_casual',0.9,'global','Tailored trousers anchor business-casual outfits with structure.','soft'),
  ('occasion_fit','category','sneakers','appropriate_for','occasion','casual',0.9,'global','Sneakers are a safe casual footwear base for everyday dressing.','soft'),
  ('occasion_fit','category','denim jacket','appropriate_for','occasion','casual',0.82,'global','A denim jacket usually reads casual and relaxed.','soft'),
  ('occasion_fit','category','dress','appropriate_for','occasion','evening',0.86,'global','A dress often transitions easily into evening dressing depending on fabrication and styling.','soft'),
  ('occasion_fit','category','heels','appropriate_for','occasion','evening',0.84,'global','Heels often elevate a look for evening settings.','soft'),
  -- SEASONALITY (15 rows)
  ('seasonality','category','linen trousers','works_in_season','season','summer',0.92,'global','Linen trousers breathe well and are best suited to summer heat.','soft'),
  ('seasonality','category','heavy wool coat','works_in_season','season','autumn',0.95,'global','Heavy wool coats provide the insulation needed in autumn and winter.','soft'),
  ('seasonality','category','heavy wool coat','works_in_season','season','winter',0.95,'global','Heavy wool coats provide the insulation needed in autumn and winter.','soft'),
  ('seasonality','category','trench coat','works_in_season','season','spring',0.88,'global','A trench coat handles transitional weather in spring and autumn well.','soft'),
  ('seasonality','category','trench coat','works_in_season','season','autumn',0.88,'global','A trench coat handles transitional weather in spring and autumn well.','soft'),
  ('seasonality','category','sandals','works_in_season','season','spring',0.9,'global','Sandals are suited to warmer spring and summer conditions.','soft'),
  ('seasonality','category','sandals','works_in_season','season','summer',0.9,'global','Sandals are suited to warmer spring and summer conditions.','soft'),
  ('seasonality','category','knitwear','works_in_season','season','autumn',0.9,'global','Knitwear provides warmth that is most useful in autumn and winter.','soft'),
  ('seasonality','category','knitwear','works_in_season','season','winter',0.9,'global','Knitwear provides warmth that is most useful in autumn and winter.','soft'),
  ('seasonality','category','t-shirt','works_in_season','season','spring',0.88,'global','A t-shirt is a practical lightweight layer for spring and summer.','soft'),
  ('seasonality','category','t-shirt','works_in_season','season','summer',0.88,'global','A t-shirt is a practical lightweight layer for spring and summer.','soft'),
  ('seasonality','category','puffer jacket','works_in_season','season','winter',0.96,'global','A puffer jacket delivers maximum insulation for winter conditions.','soft'),
  ('seasonality','category','cotton shirt','works_in_season','season','spring',0.85,'global','A cotton shirt is breathable and suitable across spring, summer, and autumn.','soft'),
  ('seasonality','category','cotton shirt','works_in_season','season','summer',0.85,'global','A cotton shirt is breathable and suitable across spring, summer, and autumn.','soft'),
  ('seasonality','category','cotton shirt','works_in_season','season','autumn',0.85,'global','A cotton shirt is breathable and suitable across spring, summer, and autumn.','soft'),
  -- FORMALITY: hard (8 rows)
  ('formality','category','suit','required_for','dress_code','black_tie',0.99,'global','A suit is a non-negotiable requirement at black tie and formal occasions.','hard'),
  ('formality','category','suit','required_for','dress_code','formal',0.99,'global','A suit is a non-negotiable requirement at black tie and formal occasions.','hard'),
  ('formality','category','jeans','avoid_with','dress_code','black_tie',0.99,'global','Jeans are too casual and should be avoided at black tie and formal events.','hard'),
  ('formality','category','jeans','avoid_with','dress_code','formal',0.99,'global','Jeans are too casual and should be avoided at black tie and formal events.','hard'),
  ('formality','category','open-toe shoes','avoid_with','dress_code','formal',0.95,'global','Open-toe shoes are generally inappropriate for formal occasions.','hard'),
  ('formality','category','trainers','avoid_with','dress_code','business_casual',0.97,'global','Trainers are too casual for business-casual settings and above.','hard'),
  ('formality','category','trainers','avoid_with','dress_code','formal',0.97,'global','Trainers are too casual for business-casual settings and above.','hard'),
  ('formality','category','trainers','avoid_with','dress_code','black_tie',0.97,'global','Trainers are too casual for business-casual settings and above.','hard'),
  -- FORMALITY: soft (10 rows)
  ('formality','category','loafers','appropriate_for','dress_code','smart_casual',0.82,'global','Loafers are a versatile shoe that works well for smart-casual and business-casual dress codes.','soft'),
  ('formality','category','loafers','appropriate_for','dress_code','business_casual',0.82,'global','Loafers are a versatile shoe that works well for smart-casual and business-casual dress codes.','soft'),
  ('formality','category','dress shirt','appropriate_for','dress_code','business_casual',0.9,'global','A dress shirt is a reliable choice for business-casual and formal occasions.','soft'),
  ('formality','category','dress shirt','appropriate_for','dress_code','formal',0.9,'global','A dress shirt is a reliable choice for business-casual and formal occasions.','soft'),
  ('formality','category','chinos','appropriate_for','dress_code','smart_casual',0.85,'global','Chinos sit comfortably in smart-casual and business-casual dress codes.','soft'),
  ('formality','category','chinos','appropriate_for','dress_code','business_casual',0.85,'global','Chinos sit comfortably in smart-casual and business-casual dress codes.','soft'),
  ('formality','category','polo shirt','appropriate_for','dress_code','smart_casual',0.78,'global','A polo shirt reads polished enough for smart-casual and relaxed enough for casual.','soft'),
  ('formality','category','polo shirt','appropriate_for','dress_code','casual',0.78,'global','A polo shirt reads polished enough for smart-casual and relaxed enough for casual.','soft'),
  ('formality','category','evening dress','appropriate_for','dress_code','formal',0.92,'global','An evening dress is well-suited to formal and black-tie events.','soft'),
  ('formality','category','evening dress','appropriate_for','dress_code','black_tie',0.92,'global','An evening dress is well-suited to formal and black-tie events.','soft'),
  -- LAYERING (12 rows)
  ('layering','category','knitwear','layerable_with','category','coat',0.9,'global','Knitwear often layers well with coats in cooler weather.','soft'),
  ('layering','category','shirt','layerable_with','category','blazer',0.92,'global','A shirt under a blazer is a classic layering combination for structured looks.','soft'),
  ('layering','category','t-shirt','layerable_with','category','cardigan',0.85,'global','A t-shirt under a cardigan creates an easy layered casual look.','soft'),
  ('layering','category','turtleneck','layerable_with','category','coat',0.88,'global','A turtleneck under a coat adds warmth and a strong visual layer in cold weather.','soft'),
  ('layering','category','shirt','layerable_with','category','waistcoat',0.84,'global','A shirt under a waistcoat gives a smart, layered finish without a jacket.','soft'),
  ('layering','category','base-layer','layerable_with','category','puffer',0.93,'global','A base layer under a puffer is the most practical winter layering combination.','soft'),
  ('layering','category','tank','layerable_with','category','shirt',0.78,'global','A tank under an open shirt creates an effortless layered look.','soft'),
  ('layering','category','dress','layerable_with','category','denim jacket',0.8,'global','A dress with a denim jacket over it adds casual contrast and warmth.','soft'),
  ('layering','category','bodysuit','layerable_with','category','trousers',0.82,'global','A bodysuit tucked into trousers gives a clean, smooth layered silhouette.','soft'),
  ('layering','category','shirt','layerable_with','category','knitwear',0.86,'global','A collared shirt under a knit is a classic smart-casual layering move.','soft'),
  ('layering','category','vest','layerable_with','category','blazer',0.83,'global','A vest under a blazer adds texture and depth to a tailored look.','soft'),
  ('layering','category','turtleneck','layerable_with','category','blazer',0.87,'global','A turtleneck under a blazer creates a sleek modern alternative to a shirt and tie.','soft'),
  -- SILHOUETTE (8 rows)
  ('silhouette','category','wide_leg_trousers','pairs_with','category','fitted_top',0.85,'global','Wide-leg trousers usually balance well with a more fitted top.','soft'),
  ('silhouette','category','slim_fit_trousers','pairs_with','category','oversized_top',0.84,'global','Slim-fit trousers balance an oversized top by keeping the lower half streamlined.','soft'),
  ('silhouette','category','midi_skirt','pairs_with','category','fitted_top',0.83,'global','A midi skirt pairs well with a fitted top to keep the silhouette from reading bulky.','soft'),
  ('silhouette','category','cropped_jacket','pairs_with','category','high_waist_bottom',0.86,'global','A cropped jacket works best with a high-waist bottom that meets the hem cleanly.','soft'),
  ('silhouette','category','straight_leg_trousers','pairs_with','category','tucked_shirt',0.82,'global','A tucked shirt with straight-leg trousers creates a clean, elongated line.','soft'),
  ('silhouette','category','maxi_skirt','pairs_with','category','fitted_top',0.81,'global','A fitted top keeps the silhouette controlled when wearing a voluminous maxi skirt.','soft'),
  ('silhouette','category','fitted_dress','pairs_with','category','structured_outerwear',0.88,'global','A fitted dress reads polished under structured outerwear like a tailored coat.','soft'),
  ('silhouette','category','relaxed_trousers','pairs_with','category','structured_blazer',0.84,'global','Relaxed trousers balance a structured blazer by adding ease at the bottom.','soft'),
  -- MATERIALS
  -- linen
  ('material','material','linen','works_in_weather','weather','warm_sun',0.93,'global','Linen is highly breathable and one of the best natural fabrics for warm sunny weather.','soft'),
  ('material','material','linen','works_in_weather','weather','mild_clear',0.85,'global','Linen works well in mild weather and stays comfortable throughout the day.','soft'),
  -- wool
  ('material','material','wool','works_in_weather','weather','cold_rain',0.9,'global','Wool provides warmth and some moisture resistance in cold rainy conditions.','soft'),
  ('material','material','wool','works_in_weather','weather','cool_breeze',0.88,'global','Wool is well suited to cool breezy weather as a mid or outer layer.','soft'),
  ('material','material','wool','has_property','wear_note','itch_risk',0.72,'global','Standard wool can be itchy against skin. Merino, cashmere and lambswool are softer and usually itch-free.','soft'),
  -- cotton
  ('material','material','cotton','works_in_weather','weather','mild_clear',0.85,'global','Cotton is a versatile breathable fabric that works well in mild clear conditions.','soft'),
  ('material','material','cotton','works_in_weather','weather','warm_sun',0.82,'global','Cotton breathes well in warm weather, though linen is preferable for intense heat.','soft'),
  -- cashmere
  ('material','material','cashmere','works_in_weather','weather','cool_breeze',0.9,'global','Cashmere is light enough not to overheat but warm enough for cool breezy weather.','soft'),
  ('material','material','cashmere','works_in_weather','weather','cold_rain',0.78,'global','Cashmere provides warmth in cold rain though it should be protected from moisture.','soft'),
  -- silk
  ('material','material','silk','works_in_weather','weather','mild_clear',0.88,'global','Silk is temperature-regulating and drapes beautifully in mild clear weather.','soft'),
  ('material','material','silk','works_in_weather','weather','warm_sun',0.82,'global','Silk is lightweight and breathable in warm weather, though it marks easily.','soft'),
  ('material','material','silk','avoid_with','weather','cold_rain',0.85,'global','Silk is prone to water spotting and should be avoided in cold rainy conditions.','soft'),
  ('material','material','silk','appropriate_for','occasion','evening',0.92,'global','Silk''s natural sheen and drape make it a strong choice for evening dressing.','soft'),
  ('material','material','silk','avoid_layering_with','material','silk',0.8,'global','Silk on silk tends to slip and create static, making it a poor layering combination.','soft'),
  -- leather
  ('material','material','leather','avoid_layering_with','material','leather',0.85,'global','Layering leather on leather creates a tone-on-tone clash that reads heavy rather than intentional.','soft'),
  -- rayon (viscose, lyocell, modal, tencel, cupro)
  ('material','material','rayon','works_in_weather','weather','warm_sun',0.85,'global','Rayon (viscose, lyocell, modal, tencel) is breathable and drapes well in warm weather.','soft'),
  ('material','material','rayon','works_in_weather','weather','mild_clear',0.88,'global','Rayon is a breathable plant-based fibre that works well across mild conditions.','soft'),
  ('material','material','rayon','avoid_with','weather','cold_rain',0.82,'global','Rayon weakens when wet and tends to cling uncomfortably in cold rainy conditions.','soft'),
  ('material','material','rayon','texture_contrast_with','material','denim',0.8,'global','The soft drape of rayon creates an interesting contrast with the structure of denim.','soft'),
  -- nylon
  ('material','material','nylon','works_in_weather','weather','cold_rain',0.88,'global','Nylon is water-resistant and reliable in cold rainy weather, especially in outerwear.','soft'),
  -- denim
  ('material','material','denim','texture_contrast_with','material','silk',0.82,'global','Denim and silk create a productive contrast between rough and refined textures.','soft'),
  ('material','material','denim','texture_contrast_with','material','satin',0.84,'global','Denim and satin create a high-contrast pairing of casual and elevated textures.','soft'),
  ('material','material','denim','texture_contrast_with','material','rayon',0.8,'global','The soft drape of rayon creates an interesting contrast with the structure of denim.','soft'),
  -- poplin
  ('material','material','poplin','works_in_weather','weather','warm_sun',0.9,'global','Poplin is a lightweight crisp fabric that stays cool and comfortable in warm weather.','soft'),
  ('material','material','poplin','works_in_weather','weather','mild_clear',0.88,'global','Poplin''s plain weave breathes well and works across mild conditions.','soft'),
  ('material','material','poplin','appropriate_for','occasion','business_casual',0.88,'global','Poplin''s clean, crisp finish makes it a natural choice for business-casual shirting.','soft'),
  -- chiffon
  ('material','material','chiffon','works_in_weather','weather','warm_sun',0.88,'global','Chiffon is sheer and lightweight, making it a natural choice for warm sunny weather.','soft'),
  ('material','material','chiffon','works_in_weather','weather','mild_clear',0.84,'global','Chiffon drapes beautifully in mild clear conditions.','soft'),
  ('material','material','chiffon','avoid_with','weather','cold_rain',0.88,'global','Chiffon loses its drape when wet and is not suited to cold rainy weather.','soft'),
  ('material','material','chiffon','appropriate_for','occasion','evening',0.9,'global','Chiffon''s delicate, flowing quality makes it a strong choice for evening dressing.','soft'),
  -- satin
  ('material','material','satin','appropriate_for','occasion','evening',0.92,'global','Satin''s smooth sheen and fluid drape make it a go-to fabric for evening dressing.','soft'),
  ('material','material','satin','texture_contrast_with','material','denim',0.84,'global','Satin and denim create a high-contrast pairing of elevated and casual textures.','soft'),
  ('material','material','satin','texture_contrast_with','material','cotton',0.8,'global','Satin''s sheen contrasts well with the matte texture of cotton for a polished mix.','soft'),
  -- tweed
  ('material','material','tweed','works_in_weather','weather','cool_breeze',0.85,'global','Tweed''s dense weave makes it a strong choice for cool breezy conditions.','soft'),
  ('material','material','tweed','texture_contrast_with','material','cotton',0.78,'global','Tweed and cotton pair well by contrasting structured texture against a clean base.','soft')
on conflict do nothing;

commit;
