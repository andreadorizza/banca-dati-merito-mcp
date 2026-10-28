import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getCartellaPersonale, getCartellePersonali, getRicercheSalvate } from "../bdp/client.ts";
import { BdpError } from "../errors.ts";
import { requireSession } from "../session/status.ts";
import { formatEstremi, idParam, READ_ONLY, targetParam } from "./common.ts";
import { ok, run } from "./result.ts";

export const registerPersonalTools = (server: McpServer): void => {
  server.registerTool(
    "cartelle_personali",
    {
      title: "Cartelle personali",
      description:
        "Elenca le cartelle personali che l'utente ha creato nella Banca Dati (sola lettura), con le sottocartelle.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    () => run(async () => ok(await getCartellePersonali(await requireSession()))),
  );

  server.registerTool(
    "leggi_cartella_personale",
    {
      title: "Leggi cartella personale",
      description:
        "Restituisce il contenuto di una cartella personale dell'utente: provvedimenti, abstract e sottocartelle (sola lettura).",
      inputSchema: { id: idParam },
      annotations: READ_ONLY,
    },
    ({ id }) =>
      run(async () => {
        const cartella = await getCartellaPersonale(await requireSession(), id);
        if (!cartella) throw new BdpError("parametri", `Nessuna cartella personale con id ${id}.`);
        return ok({
          id: cartella.id,
          nome: cartella.name,
          percorso: cartella.percorso ?? [],
          sottocartelle: cartella.sottocartelle ?? [],
          provvedimenti: (cartella.provvedimenti ?? []).map((p) => ({
            id: p.id,
            tipo: p.tipo,
            ufficio: p.ufficio,
            ...formatEstremi(p),
            data_pubblicazione: p.data_pubblicazione,
            materia: p.materia,
            note_personali: p.note,
          })),
          abstract: (cartella.abstract ?? []).map((a) => ({
            id: a.id,
            titolo: a.titolo,
            ufficio: a.ufficio,
            ...formatEstremi(a),
            materia: a.materia,
            note_personali: a.note,
          })),
        });
      }),
  );

  server.registerTool(
    "ricerche_salvate",
    {
      title: "Ricerche salvate",
      description: "Elenca le ricerche che l'utente ha salvato nella Banca Dati (sola lettura).",
      inputSchema: { tipo: targetParam.default("provvedimenti") },
      annotations: READ_ONLY,
    },
    ({ tipo }) => run(async () => ok(await getRicercheSalvate(await requireSession(), tipo))),
  );
};
