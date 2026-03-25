import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = value;
    index += 1;
  }

  return args;
}

async function resolveUserIdByEmail(supabase, email) {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail
    );

    if (match) {
      return match.id;
    }

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  throw new Error(`No Supabase Auth user found for ${normalizedEmail}.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email;
  const password = args.password;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load .env.local first."
    );
  }

  if (!email || !password) {
    throw new Error(
      "Usage: node --env-file=.env.local scripts/set-supabase-user-password.mjs --email you@example.com --password 'new-password'"
    );
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const userId = await resolveUserIdByEmail(supabase, email);
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password
  });

  if (error) {
    throw new Error(`Failed to update password: ${error.message}`);
  }

  process.stdout.write(
    `Password updated for ${data.user?.email ?? email} (${userId}).\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
