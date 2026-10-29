/**
 * Turns the raw samples from scripts/record.ts into committed test fixtures:
 * keeps every response's shape and types, replaces decision text and personal
 * names with placeholders, trims long lists, and skips the user's own data.
 *
 *   node scripts/sanitize-fixtures.ts
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "test", "fixtures");
const RAW = join(ROOT, "raw");

/** The user's identity and binary or full-text bodies never leave raw/. */
const SKIP = new Set(["user-current", "provvedimento-testo", "provvedimento-document", "massima-document"]);
const TEXT_KEYS = new Set(["testo", "estratto", "titolo", "annotazione", "note", "esito", "text_note"]);
const PERSON_KEYS = new Set(["presidente", "relatore", "giudice_assegnatario_fascicolo", "name", "family_name"]);
const PERSON_LISTS = new Set(["giudice-query"]);
const MAX_ITEMS = 5;

const sanitize = (value: unknown, key: string | null): unknown => {
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => sanitize(item, key));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v, k)]));
  }
  if (typeof value !== "string" || key === null) return value;
  if (TEXT_KEYS.has(key)) return key === "estratto" ? "Testo di esempio con un <mark>termine</mark> evidenziato." : "Testo di esempio.";
  if (PERSON_KEYS.has(key)) return value === "" ? value : "NOME COGNOME";
  return value;
};

for (const file of (await readdir(RAW)).filter((f) => f.endsWith(".json"))) {
  const name = file.slice(0, -".json".length);
  if (SKIP.has(name)) continue;
  const { body } = JSON.parse(await readFile(join(RAW, file), "utf8")) as { body: unknown };
  const clean = PERSON_LISTS.has(name) && Array.isArray(body)
    ? body.slice(0, MAX_ITEMS).map((_, i) => `NOME COGNOME ${i + 1}`)
    : sanitize(body, null);
  await writeFile(join(ROOT, file), `${JSON.stringify(clean, null, 2)}\n`);
  console.log(`${name}`);
}
