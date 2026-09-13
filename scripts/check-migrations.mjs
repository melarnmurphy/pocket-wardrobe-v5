import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const migrationsDir = path.resolve("supabase/migrations");
const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql"));
const numericGroups = new Map();

for (const file of files) {
  const match = file.match(/^(\d+)_.*\.sql$/);
  if (!match) continue;
  const number = Number(match[1]);
  const group = numericGroups.get(number) ?? [];
  group.push(file);
  numericGroups.set(number, group);
}

const errors = [];
for (const [number, group] of numericGroups) {
  if (group.length < 2) continue;
  const contents = await Promise.all(group.map((file) => readFile(path.join(migrationsDir, file), "utf8")));
  const hasTimestampReconciliation = contents.some((content) => content.includes("Reconciliation marker"));
  if (!hasTimestampReconciliation) {
    errors.push(`migration number ${number} is duplicated without a reconciliation marker: ${group.join(", ")}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Migration naming check passed (${files.length} SQL files).`);
