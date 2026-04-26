insert into public.colours (
  hex,
  rgb_r,
  rgb_g,
  rgb_b,
  family,
  undertone,
  saturation_band,
  lightness_band,
  neutral_flag
)
values
  ('#1b1918', 27, 25, 24, 'black',  'neutral', 'low',    'low',    true),
  ('#f6f2ea', 246, 242, 234, 'white',  'neutral', 'low',    'high',   true),
  ('#8a8580', 138, 133, 128, 'grey',   'neutral', 'low',    'medium', true),
  ('#3857a6', 56, 87, 166, 'blue',   'cool',    'medium', 'medium', false),
  ('#a13d3a', 161, 61, 58, 'red',    'warm',    'medium', 'medium', false),
  ('#6d8266', 109, 130, 102, 'green',  'neutral', 'low',    'medium', false),
  ('#d6b449', 214, 180, 73, 'yellow', 'warm',    'medium', 'high',   false),
  ('#c76f3b', 199, 111, 59, 'orange', 'warm',    'high',   'medium', false),
  ('#7661a8', 118, 97, 168, 'purple', 'cool',    'medium', 'medium', false),
  ('#d495ac', 212, 149, 172, 'pink',   'warm',    'low',    'high',   false),
  ('#8b6349', 139, 99, 73, 'brown',  'warm',    'low',    'medium', true),
  ('#d7c1a1', 215, 193, 161, 'beige',  'warm',    'low',    'high',   true)
on conflict (hex) do update
set
  rgb_r = excluded.rgb_r,
  rgb_g = excluded.rgb_g,
  rgb_b = excluded.rgb_b,
  family = excluded.family,
  undertone = excluded.undertone,
  saturation_band = excluded.saturation_band,
  lightness_band = excluded.lightness_band,
  neutral_flag = excluded.neutral_flag;
