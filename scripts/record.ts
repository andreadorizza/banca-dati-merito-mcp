/**
 * Records one raw sample per BDP endpoint into test/fixtures/raw/ (gitignored: the
 * samples can contain the user's own data). Used to pin response shapes; the
 * committed fixtures are sanitised copies.
 *
 *   BDM_GQL_DOCS=path/to/spa-graphql.txt node scripts/record.ts
 *
 * BDM_GQL_DOCS points at the GraphQL documents extracted from BDP's own front end
 * (one "### <kind> <name>" header per document).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { request, type RequestSpec } from "../src/bdp/http.ts";
import { requireSession } from "../src/session/status.ts";

const OUT = join(import.meta.dirname, "..", "test", "fixtures", "raw");

const loadDocuments = async (path: string): Promise<Map<string, string>> => {
  const text = await readFile(path, "utf8");
  const docs = new Map<string, string>();
  for (const block of text.split(/^### /m).slice(1)) {
    const [header, ...body] = block.split("\n");
    const name = header?.split(" ")[1];
    if (name) docs.set(name, body.join("\n").trim());
  }
  return docs;
};

/** The operation plus every fragment it reaches, as the SPA sends it. */
const assemble = (docs: Map<string, string>, operation: string): string => {
  const seen = new Set<string>();
  const pending = [operation];
  const parts: string[] = [];
  while (pending.length > 0) {
    const name = pending.pop();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const doc = docs.get(name);
    if (!doc) throw new Error(`documento GraphQL mancante: ${name}`);
    parts.push(doc);
    for (const match of doc.matchAll(/\.\.\.(\w+)/g)) if (match[1]) pending.push(match[1]);
  }
  return parts.join("\n\n");
};

const main = async (): Promise<void> => {
  const docsPath = process.env.BDM_GQL_DOCS;
  if (!docsPath) throw new Error("BDM_GQL_DOCS non impostato");
  const docs = await loadDocuments(docsPath);
  const session = await requireSession();
  await mkdir(OUT, { recursive: true });

  const save = async (name: string, spec: RequestSpec): Promise<unknown> => {
    const response = await request(session, spec);
    const isJson = response.contentType.includes("json");
    const body = isJson
      ? JSON.parse(response.body.toString("utf8"))
      : response.contentType.includes("pdf")
        ? { pdfBytes: response.body.length }
        : { text: response.body.toString("utf8").slice(0, 3000), length: response.body.length };
    await writeFile(
      join(OUT, `${name}.json`),
      `${JSON.stringify({ status: response.status, contentType: response.contentType, body }, null, 2)}\n`,
    );
    console.log(`${name}: ${response.status} ${response.contentType} ${response.body.length}B`);
    return body;
  };

  const gql = (name: string, operation: string, variables: Record<string, unknown>) =>
    save(name, {
      method: "POST",
      path: "graphql",
      json: { operationName: operation, variables, query: assemble(docs, operation) },
    });

  await save("user-current", { method: "GET", path: "user/current" });

  const search = (await gql("search-provvedimento-phrase", "searchProvvedimento", {
    from: 0,
    size: 3,
    area: "CIVILE",
    q: 'anonymized_testo:"\\"decreto ingiuntivo\\""',
    sort_field: "_score",
    sort_order: "desc",
  })) as { data: { provvedimento: { items: { id: string }[] } } };
  await gql("search-provvedimento-all-words", "searchProvvedimento", {
    from: 0,
    size: 2,
    area: "CIVILE",
    q: 'anonymized_testo_all_words:"usucapione servitù" AND data:[01/01/2024 TO 31/12/2024]',
    sort_field: "data",
    sort_order: "desc",
  });
  await gql("last-provvedimento", "lastProvvedimento", {
    from: 0,
    size: 2,
    area: "CIVILE",
    sort_field: "data_pubblicazione",
    sort_order: "desc",
  });
  const massime = (await gql("search-massima", "searchMassima", {
    from: 0,
    size: 3,
    area: "CIVILE",
    q: 'testo:"locazione"',
    sort_field: "_score",
    sort_order: "desc",
  })) as { data: { massima: { items: { id: string }[] } } };
  await gql("last-massima", "lastMassima", {
    from: 0,
    size: 2,
    area: "CIVILE",
    sort_field: "data_pubblicazione",
    sort_order: "desc",
  });

  const provvedimentoId = search.data.provvedimento.items[0]?.id;
  const massimaId = massime.data.massima.items[0]?.id;
  if (!provvedimentoId || !massimaId) throw new Error("ricerche senza risultati: impossibile campionare il dettaglio");

  await gql("view-provvedimento", "viewProvvedimento", { id: [provvedimentoId], area: "CIVILE" });
  await gql("view-massima", "viewMassima", { id: [massimaId], area: "CIVILE" });
  await save("provvedimento-timeline", { method: "GET", path: `provvedimento/${provvedimentoId}/timeline` });
  await save("provvedimento-processing", { method: "GET", path: `provvedimento/${provvedimentoId}/processing` });
  await save("provvedimento-testo", { method: "GET", path: `provvedimento/${provvedimentoId}/document/testo` });
  await save("provvedimento-document", {
    method: "GET",
    path: `provvedimento/${provvedimentoId}/document`,
    accept: "application/pdf",
  });
  await save("massima-document", { method: "GET", path: `massima/${massimaId}/document`, accept: "application/pdf" });

  await save("provvedimento-autocomplete", {
    method: "GET",
    path: "provvedimento/autocomplete",
    query: { q: "LOCAZIONE", area: "CIVILE" },
  });
  await save("massima-autocomplete", {
    method: "GET",
    path: "massima/autocomplete",
    query: { q: "LOCAZIONE", area: "CIVILE" },
  });
  await save("provvedimento-occurrence", { method: "GET", path: "provvedimento/occurrence/CIVILE/parola_chiave" });
  await save("massima-occurrence", { method: "GET", path: "massima/occurrence/CIVILE/parola_chiave" });
  await save("materia", { method: "GET", path: "materia", query: { area: "CIVILE" } });
  await save("ruolo", { method: "GET", path: "ruolo", query: { area: "CIVILE" } });
  await save("ufficio-geografia", { method: "GET", path: "ufficio/geografia" });
  await save("ufficio-query", { method: "GET", path: "ufficio", query: { q: "BOLOGNA" } });
  await save("giudice-query", { method: "GET", path: "giudice", query: { q: "ROSSI" } });
  await save("parola-chiave-query", { method: "GET", path: "parola_chiave", query: { q: "LOCAZ", area: "CIVILE" } });
  await save("riferimento-normativo-query", { method: "GET", path: "riferimento_normativo", query: { q: "1453" } });
  await save("monitor-published", { method: "GET", path: "monitor/published" });
  await save("archive-occurrences-root", { method: "POST", path: "archive/occurrences", json: { area: "CIVILE" } });
  await save("archive-occurrences-distretto", {
    method: "POST",
    path: "archive/occurrences",
    json: { distretto: "BOLOGNA", area: "CIVILE" },
  });
  await save("provvedimento-filter", { method: "GET", path: "provvedimento/filter" });
  await save("massima-filter", { method: "GET", path: "massima/filter" });
  await gql("fascicolo-home", "homeFascicoloQuery", {});
  await gql("fascicolo-tree", "Fascicolo", {});
  await gql("fascicolo-by-provvedimento", "fascicoloByProvvedimento", { provvedimento_id: provvedimentoId });
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
