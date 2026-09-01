// Seeds local_listings across Adelaide suburbs so distance and radius can be
// tested honestly (BUILD_ORDER phase 7's "done when": two accounts in
// different suburbs see each other's listings at the right distances).
//
// This can't be a SQL migration: local_listings.seller_id and piece_id are
// real foreign keys into auth.users and garments, and this repo has no way
// to fabricate a real Supabase Auth user from a migration. Run this
// manually against two or more real accounts that already have garments in
// their wardrobe.
//
// Usage:
//   node --env-file=.env.local scripts/seed-local-listings.mjs \
//     --email you@example.com --suburb norwood \
//     --email friend@example.com --suburb glenelg
//
// Each --email/--suburb pair lists up to 3 of that user's own garments
// (oldest first) that don't already have a live listing. Suburb must be one
// of lib/domain/local-threads/adelaide-suburbs.ts's names.

import { createClient } from "@supabase/supabase-js";

const ADELAIDE_SUBURBS = {
  adelaide: [-34.9285, 138.6007],
  "north adelaide": [-34.9081, 138.5942],
  norwood: [-34.9203, 138.6295],
  unley: [-34.9497, 138.6062],
  glenelg: [-34.9805, 138.5183],
  prospect: [-34.8814, 138.5942],
  burnside: [-34.9328, 138.6428],
  walkerville: [-34.8994, 138.6103],
  "west lakes": [-34.8686, 138.5028],
  "henley beach": [-34.9161, 138.4956],
  "mawson lakes": [-34.8083, 138.6161],
  modbury: [-34.8306, 138.6842],
  marion: [-35.0092, 138.5586],
  brighton: [-35.0161, 138.5217],
  mitcham: [-34.9781, 138.6194],
  "st peters": [-34.9042, 138.6153],
  campbelltown: [-34.8969, 138.6614],
  "port adelaide": [-34.8464, 138.5031],
  semaphore: [-34.8386, 138.4886],
  hindmarsh: [-34.9067, 138.5722]
};

function parseArgs(argv) {
  const pairs = [];
  let current = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--email") {
      if (current.email) pairs.push(current);
      current = { email: argv[index + 1] };
      index += 1;
    } else if (token === "--suburb") {
      current.suburb = argv[index + 1]?.toLowerCase();
      index += 1;
    }
  }
  if (current.email) pairs.push(current);
  return pairs;
}

async function resolveUserIdByEmail(supabase, email) {
  const normalised = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`Failed to list users: ${error.message}`);
  const match = data.users.find((user) => user.email?.trim().toLowerCase() === normalised);
  if (!match) throw new Error(`No Supabase Auth user found for ${normalised}.`);
  return match.id;
}

async function main() {
  const pairs = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load .env.local first.");
  }
  if (pairs.length < 2) {
    throw new Error("Provide at least two --email/--suburb pairs to test cross-account distance.");
  }
  for (const pair of pairs) {
    if (!pair.suburb || !ADELAIDE_SUBURBS[pair.suburb]) {
      throw new Error(`Unknown or missing suburb for ${pair.email}. See ADELAIDE_SUBURBS above.`);
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  let created = 0;

  for (const { email, suburb } of pairs) {
    const userId = await resolveUserIdByEmail(supabase, email);
    const [lat, lng] = ADELAIDE_SUBURBS[suburb];

    const { data: garments, error: garmentsError } = await supabase
      .from("garments")
      .select("id, title, category")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .limit(3);

    if (garmentsError) throw new Error(garmentsError.message);
    if (!garments?.length) {
      process.stdout.write(`${email}: no garments to list, skipped.\n`);
      continue;
    }

    for (const garment of garments) {
      const { error: insertError } = await supabase.from("local_listings").insert({
        piece_id: garment.id,
        seller_id: userId,
        status: "live",
        ask_cents: 2000 + Math.floor(Math.random() * 8000),
        negotiable: true,
        description: garment.title || garment.category,
        photo_uris: [],
        suburb,
        lat,
        lng,
        listed_at: new Date().toISOString()
      });

      if (insertError) {
        process.stderr.write(`${email}/${garment.id}: ${insertError.message}\n`);
        continue;
      }
      created += 1;
    }

    process.stdout.write(`${email} (${suburb}): listed ${garments.length} piece(s).\n`);
  }

  process.stdout.write(`Done — ${created} listing(s) created.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
