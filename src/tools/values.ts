import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getArchivio,
  getOccorrenze,
  getPubblicazioni,
  LIST_KEYS,
  listValues,
  LOOKUP_KEYS,
  lookupValues,
} from "../bdp/client.ts";
import { requireSession } from "../session/status.ts";
import { areaParam, READ_ONLY, targetParam } from "./common.ts";
import { ok, run } from "./result.ts";

const MESI = [
  "GENNAIO",
  "FEBBRAIO",
  "MARZO",
  "APRILE",
  "MAGGIO",
  "GIUGNO",
  "LUGLIO",
  "AGOSTO",
  "SETTEMBRE",
  "OTTOBRE",
  "NOVEMBRE",
  "DICEMBRE",
] as const;

export const registerValueTools = (server: McpServer): void => {
  server.registerTool(
    "elenca_valori",
    {
      title: "Elenca valori",
      description:
        "Elenca tutti i valori ammessi di un campo: materie, ruoli, oppure gli uffici giudiziari raggruppati per distretto. Utile per scegliere un criterio quando non si sa come lo chiama la Banca Dati.",
      inputSchema: {
        campo: z.enum(LIST_KEYS).describe("materia, ruolo oppure uffici_per_distretto."),
        area: areaParam,
      },
      annotations: READ_ONLY,
    },
    ({ campo, area }) => run(async () => ok(await listValues(await requireSession(), campo, area))),
  );

  server.registerTool(
    "cerca_valori",
    {
      title: "Cerca valori",
      description:
        "Cerca i valori di un singolo campo che contengono un testo: uffici, giudici, parole chiave o riferimenti normativi (per esempio '1453' per l'art. 1453 c.c.). Per risolvere un nome senza sapere il campo usa risolvi_criteri.",
      inputSchema: {
        campo: z.enum(LOOKUP_KEYS),
        testo: z.string().trim().min(2).max(200),
        area: areaParam,
      },
      annotations: READ_ONLY,
    },
    ({ campo, testo, area }) => run(async () => ok(await lookupValues(await requireSession(), campo, testo, area))),
  );

  server.registerTool(
    "frequenze_parole_chiave",
    {
      title: "Frequenza delle parole chiave",
      description: "Restituisce le parole chiave più usate nei provvedimenti o negli abstract, con il numero di occorrenze.",
      inputSchema: { tipo: targetParam.default("provvedimenti"), area: areaParam },
      annotations: READ_ONLY,
    },
    ({ tipo, area }) => run(async () => ok(await getOccorrenze(await requireSession(), tipo, area, "parola_chiave"))),
  );

  server.registerTool(
    "pubblicazioni",
    {
      title: "Provvedimenti pubblicati",
      description: "Restituisce quanti provvedimenti e abstract la Banca Dati ha pubblicato, per distretto e ufficio.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    () => run(async () => ok(await getPubblicazioni(await requireSession()))),
  );

  server.registerTool(
    "archivio",
    {
      title: "Archivio",
      description:
        "Naviga l'archivio della Banca Dati come nella sezione Archivio del sito: senza parametri restituisce i conteggi per distretto; aggiungendo distretto, ufficio, anno e mese scende di livello. Per elencare i provvedimenti di un ufficio in un periodo usa cerca_provvedimenti con il criterio ufficio e le date.",
      inputSchema: {
        area: areaParam,
        distretto: z.string().trim().min(1).optional(),
        ufficio: z.string().trim().min(1).optional(),
        materia: z.string().trim().min(1).optional(),
        anno: z.number().int().min(1900).max(2100).optional(),
        mese: z.enum(MESI).optional(),
      },
      annotations: READ_ONLY,
    },
    ({ area, distretto, ufficio, materia, anno, mese }) =>
      run(async () =>
        ok(
          await getArchivio(await requireSession(), {
            area,
            distretto,
            ufficio,
            materia,
            anno: anno === undefined ? undefined : String(anno),
            mese,
          }),
        ),
      ),
  );
};
