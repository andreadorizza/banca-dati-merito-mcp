/**
 * Live end-to-end check through the MCP server, with the saved session.
 * About ten BDP requests, paced like any other use. Run after `login`:
 *
 *   node scripts/smoke.ts
 */
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { createServer } from "../src/server.ts";

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await createServer().connect(serverTransport);
const client = new Client({ name: "smoke", version: "0" });
await client.connect(clientTransport);

const call = async (name: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  const result = await client.callTool({ name, arguments: args });
  const content = z.array(z.object({ type: z.literal("text"), text: z.string() })).parse(result.content);
  const text = content.map((c) => c.text).join("\n");
  if (result.isError) throw new Error(`${name}: ${text}`);
  console.log(`✔ ${name}`);
  return JSON.parse(text);
};

const Page = z.object({ totale: z.number(), risultati: z.array(z.object({ id: z.string() }).loose()) });

const stato = z.object({ stato: z.string() }).loose().parse(await call("stato_sessione"));
assert.equal(stato.stato, "valida", "serve una sessione valida: esegui prima `login`");

const criteri = z
  .object({ criteri: z.array(z.object({ campo: z.string(), valore: z.string() })) })
  .parse(await call("risolvi_criteri", { testo: "tribunale di bologna" }));
const ufficio = criteri.criteri.find((c) => c.campo === "ufficio" && c.valore === "TRIBUNALE DI BOLOGNA");
assert.ok(ufficio, "risolvi_criteri non propone TRIBUNALE DI BOLOGNA");

const provvedimenti = Page.parse(
  await call("cerca_provvedimenti", {
    criteri: [ufficio],
    testo: { valore: "decreto ingiuntivo opposizione", modalita: "tutte" },
    date: { campo: "data_pubblicazione", da: "2024-01-01" },
    quanti: 3,
  }),
);
assert.ok(provvedimenti.totale > 0, "nessun provvedimento per una ricerca che ne ha");
const provvedimentoId = provvedimenti.risultati[0]?.id;
assert.ok(provvedimentoId);

await call("leggi_provvedimento", { id: provvedimentoId });
const testo = z
  .object({ lunghezza_totale: z.number(), testo: z.string() })
  .parse(await call("leggi_testo_provvedimento", { id: provvedimentoId, max_caratteri: 2000 }));
assert.ok(testo.lunghezza_totale > 500 && testo.testo.length > 0, "testo vuoto");

const frase = Page.parse(
  await call("cerca_provvedimenti", { testo: { valore: "decreto ingiuntivo", modalita: "frase_esatta" }, quanti: 1 }),
);
const tutte = Page.parse(
  await call("cerca_provvedimenti", { testo: { valore: "decreto ingiuntivo", modalita: "almeno_una" }, quanti: 1 }),
);
assert.ok(frase.totale < tutte.totale, "la frase esatta dovrebbe restringere rispetto ad almeno una parola");

const abstract = Page.parse(await call("cerca_abstract", { testo: { valore: "locazione", modalita: "tutte" }, quanti: 2 }));
const abstractId = abstract.risultati[0]?.id;
assert.ok(abstractId);
await call("leggi_abstract", { id: abstractId });

console.log("\nSmoke test superato.");
await client.close();
