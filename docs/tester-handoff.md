# Pocket Wardrobe Tester Handoff

Use this build:

```txt
https://fashionapp5.vercel.app
```

What to test:

1. Sign in and confirm the app loads.
2. Open `Wardrobe` and check that the page renders without errors.
3. Open `Trends` and confirm it loads.
4. Open `Lookbook` and `Outfits` to make sure the main navigation works.
5. Check any recent wardrobe or trend content for obvious data issues.

What to report:

- Any page that fails to load
- Any broken navigation or blank screen
- Any missing or incorrect garment data
- Any confusing text, layout issues, or overlapping UI
- Any trend result that looks obviously wrong or duplicated

Notes:

- This is a production deployment backed by the linked Supabase project.
- Trend discovery uses a hosted SearXNG instance.
- If something looks stale, refresh once and retry.
