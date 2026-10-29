/**
 * Records one raw response per BDP endpoint, made with this client's own GraphQL
 * documents and paths, into test/fixtures/raw/ (gitignored: samples can contain
 * the user's own data). `scripts/sanitize-fixtures.ts` turns them into the
 * committed fixtures. About 30 requests, paced like any other use.
 *
 *   node scripts/record.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CARTELLA_PERSONALE,
  CARTELLE_DEL_PROVVEDIMENTO,
  CARTELLE_PERSONALI,
  searchAbstractDocument,
  searchProvvedimentiDocument,
  VIEW_ABSTRACT,
  VIEW_PROVVEDIMENTO,
} from "../src/bdp/graphql.ts";
import { request, type RequestSpec } from "../src/bdp/http.ts";
import { requireSession } from "../src/session/status.ts";

const OUT = join(import.meta.dirname, "..", "test", "fixtures", "raw");
const AREA = "CIVILE";

const session = await requireSession();
await mkdir(OUT, { recursive: true });

const save = async (name: string, spec: RequestSpec): Promise<unknown> => {
  let response: Awaited<ReturnType<typeof request>>;
  try {
    response = await request(session, spec);
  } catch (error) {
    console.log(`${name}: FAILED ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`);
    return null;
  }
  const raw = response.body.toString("utf8");
  const body = response.contentType.includes("pdf")
    ? { pdfBytes: response.body.length }
    : raw.startsWith("{") || raw.startsWith("[")
      ? JSON.parse(raw)
      : { text: raw.slice(0, 3000), length: raw.length };
  await writeFile(
    join(OUT, `${name}.json`),
    `${JSON.stringify({ status: response.status, contentType: response.contentType, body }, null, 2)}\n`,
  );
  const errors = (body as { errors?: unknown }).errors;
  console.log(`${name}: ${response.status} ${response.body.length}B${errors ? ` GRAPHQL ERRORS ${JSON.stringify(errors)}` : ""}`);
  return body;
};

const gql = (name: string, query: string, variables: Record<string, unknown>) =>
  save(name, { method: "POST", path: "graphql", json: { query, variables } });

const list = { area: AREA, sort_field: "data_pubblicazione", sort_order: "desc" };

await save("user-current", { method: "GET", path: "user/current" });

const search = (await gql("search-provvedimento-phrase", searchProvvedimentiDocument(true), {
  ...list,
  from: 0,
  size: 3,
  q: 'anonymized_testo:"\\"decreto ingiuntivo\\""',
  sort_field: "_score",
})) as { data?: { provvedimento?: { items?: { id: string }[] } } } | null;
await gql("search-provvedimento-all-words", searchProvvedimentiDocument(true), {
  ...list,
  from: 0,
  size: 2,
  q: 'anonymized_testo_all_words:"usucapione servitù" AND data:[01/01/2024 TO 31/12/2024]',
});
await gql("last-provvedimento", searchProvvedimentiDocument(false), { ...list, from: 0, size: 2 });
const abstracts = (await gql("search-massima", searchAbstractDocument(true), {
  ...list,
  from: 0,
  size: 3,
  q: 'testo:"locazione"',
  sort_field: "_score",
})) as { data?: { massima?: { items?: { id: string }[] } } } | null;
await gql("last-massima", searchAbstractDocument(false), { ...list, from: 0, size: 2 });

const provvedimentoId = search?.data?.provvedimento?.items?.[0]?.id;
const massimaId = abstracts?.data?.massima?.items?.[0]?.id;
if (!provvedimentoId || !massimaId) throw new Error("ricerche senza risultati: impossibile campionare il dettaglio");

await gql("view-provvedimento", VIEW_PROVVEDIMENTO, { id: [provvedimentoId], area: AREA });
await gql("view-massima", VIEW_ABSTRACT, { id: [massimaId], area: AREA });
await save("provvedimento-timeline", { method: "GET", path: `provvedimento/${provvedimentoId}/timeline` });
await save("provvedimento-testo", { method: "GET", path: `provvedimento/${provvedimentoId}/document/testo` });
await save("provvedimento-document", {
  method: "GET",
  path: `provvedimento/${provvedimentoId}/document`,
  accept: "application/pdf",
});
await save("massima-document", { method: "GET", path: `massima/${massimaId}/document`, accept: "application/pdf" });

await save("provvedimento-autocomplete", { method: "GET", path: "provvedimento/autocomplete", query: { q: "LOCAZIONE", area: AREA } });
await save("massima-autocomplete", { method: "GET", path: "massima/autocomplete", query: { q: "LOCAZIONE", area: AREA } });
await save("provvedimento-occurrence", { method: "GET", path: `provvedimento/occurrence/${AREA}/parola_chiave` });
await save("massima-occurrence", { method: "GET", path: `massima/occurrence/${AREA}/parola_chiave` });
await save("materia", { method: "GET", path: "materia", query: { area: AREA } });
await save("ruolo", { method: "GET", path: "ruolo", query: { area: AREA } });
await save("ufficio-geografia", { method: "GET", path: "ufficio/geografia" });
await save("ufficio-query", { method: "GET", path: "ufficio", query: { q: "BOLOGNA" } });
await save("giudice-query", { method: "GET", path: "giudice", query: { q: "ROSSI" } });
await save("parola-chiave-query", { method: "GET", path: "parola_chiave", query: { q: "LOCAZ", area: AREA } });
await save("riferimento-normativo-query", { method: "GET", path: "riferimento_normativo", query: { q: "1453" } });
await save("monitor-published", { method: "GET", path: "monitor/published" });
await save("archive-occurrences-root", { method: "POST", path: "archive/occurrences", json: { area: AREA } });
await save("archive-occurrences-distretto", {
  method: "POST",
  path: "archive/occurrences",
  json: { distretto: "BOLOGNA", area: AREA },
});
await save("provvedimento-filter", { method: "GET", path: "provvedimento/filter" });
await save("massima-filter", { method: "GET", path: "massima/filter" });
const cartelle = (await gql("cartelle-personali", CARTELLE_PERSONALI, {})) as {
  data?: { cartelle?: { id: string }[] };
} | null;
await gql("cartelle-del-provvedimento", CARTELLE_DEL_PROVVEDIMENTO, { provvedimento_id: provvedimentoId });
const cartellaId = cartelle?.data?.cartelle?.[0]?.id;
if (cartellaId) await gql("cartella-personale", CARTELLA_PERSONALE, { id: cartellaId });
