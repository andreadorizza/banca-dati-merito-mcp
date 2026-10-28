import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MAX_RESULTS, RESULT_WINDOW } from "./config.ts";
import { registerPersonalTools } from "./tools/personal.ts";
import { registerReadTools } from "./tools/read.ts";
import { registerSearchTools } from "./tools/search.ts";
import { registerSessionTools } from "./tools/session.ts";
import { registerValueTools } from "./tools/values.ts";

/** Resolves from both src/ and dist/: the package root is one level up. */
const { version } = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")));

const INSTRUCTIONS = `Server non ufficiale per la Banca Dati di Merito del Ministero della Giustizia (bdp.giustizia.it): provvedimenti civili di tribunali e corti d'appello, pseudonimizzati, e i relativi abstract.

- Sessione: se uno strumento risponde che la sessione manca o è scaduta, usa \`accedi\`, chiedi all'utente di completare l'accesso nella finestra del browser, verifica con \`stato_sessione\` e ripeti. La sessione dura circa due ore.
- Criteri: ufficio, distretto, giudici, materia e parole chiave funzionano solo con il valore esatto della Banca Dati. Ricavalo con \`risolvi_criteri\` prima di cercare.
- Orientamenti: \`cerca_abstract\`. Decisioni: \`cerca_provvedimenti\`. Prima di attribuire un principio a un provvedimento, leggine il testo con \`leggi_testo_provvedimento\`.
- Un abstract è una sintesi pubblicata dalla Banca Dati, non una massima ufficiale.
- Le parti sono pseudonimizzate (Parte_1, Controparte_1): non cercare di identificarle.
- Al massimo ${MAX_RESULTS} risultati per chiamata; la Banca Dati mostra solo i primi ${RESULT_WINDOW} di una ricerca. Cerca in modo mirato: ogni chiamata usa la sessione personale dell'utente.
- Cita con gli estremi: ufficio, tipo, numero e anno, R.G., data.`;

export const createServer = (): McpServer => {
  const server = new McpServer({ name: "banca-dati-merito", version }, { instructions: INSTRUCTIONS });
  registerSessionTools(server);
  registerSearchTools(server);
  registerReadTools(server);
  registerValueTools(server);
  registerPersonalTools(server);
  return server;
};

export const serve = async (): Promise<void> => {
  await createServer().connect(new StdioServerTransport());
};
