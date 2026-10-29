import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getArchivio,
  getGeografia,
  getOccorrenze,
  getPubblicazioni,
  LIST_KEYS,
  listValues,
  LOOKUP_KEYS,
  lookupValues,
} from "../bdp/client.ts";
import { BdpError } from "../errors.ts";
import { areaParam, READ_ONLY, targetParam } from "./common.ts";
import { ok, withBdp } from "./result.ts";

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

const distrettoParam = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.toUpperCase())
  .describe("Distretto di corte d'appello, per esempio BOLOGNA.");

const upper = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.toUpperCase());

/** A filter that matches nothing is a typo, not an empty district: say so instead of returning []. */
const unknownDistrict = (distretto: string, known: Iterable<string>): BdpError =>
  new BdpError(
    "parametri",
    `Distretto sconosciuto: ${distretto}. Distretti presenti: ${[...new Set(known)].sort((a, b) => a.localeCompare(b, "it")).join(", ")}.`,
  );

const counts = (rows: readonly { text: string; value: number }[]) =>
  rows.map(({ text, value }) => ({ voce: text === "" ? "(non indicata)" : text, conteggio: value }));

/** What BDP breaks the counts down by, depending on how deep the request goes. */
const archiveLevel = (p: { distretto?: string | undefined; ufficio?: string | undefined }) =>
  p.ufficio ? "materie" : p.distretto ? "uffici" : "distretti";

export const registerValueTools = (server: McpServer): void => {
  server.registerTool(
    "elenca_valori",
    {
      title: "Elenca valori",
      description:
        "Elenca tutti i valori ammessi di materia o ruolo, nella forma esatta da usare come criterio di ricerca.",
      inputSchema: { campo: z.enum(LIST_KEYS), area: areaParam },
      annotations: READ_ONLY,
    },
    ({ campo, area }, { signal }) => withBdp(signal, async (ctx) => ok({ campo, valori: await listValues(ctx, campo, area) })),
  );

  server.registerTool(
    "elenca_uffici",
    {
      title: "Elenca uffici giudiziari",
      description:
        "Elenca gli uffici giudiziari presenti nella Banca Dati, raggruppati per distretto di corte d'appello. Con `distretto` restituisce solo gli uffici di quel distretto.",
      inputSchema: { distretto: distrettoParam.optional() },
      annotations: READ_ONLY,
    },
    ({ distretto }, { signal }) =>
      withBdp(signal, async (ctx) => {
        const rows = await getGeografia(ctx);
        if (distretto && !rows.some((r) => r.distretto === distretto)) {
          throw unknownDistrict(distretto, rows.map((r) => r.distretto));
        }
        const grouped = new Map<string, string[]>();
        for (const row of rows) {
          if (distretto && row.distretto !== distretto) continue;
          grouped.set(row.distretto, [...(grouped.get(row.distretto) ?? []), row.ufficio]);
        }
        return ok(
          [...grouped]
            .sort(([a], [b]) => a.localeCompare(b, "it"))
            .map(([d, uffici]) => ({ distretto: d, uffici: uffici.sort((a, b) => a.localeCompare(b, "it")) })),
        );
      }),
  );

  server.registerTool(
    "cerca_valori",
    {
      title: "Cerca valori",
      description:
        "Cerca i valori di un singolo campo che contengono un testo: uffici, giudici, parole chiave o riferimenti normativi (per esempio '1453' trova 'ART. 1453 C.C.'). Per risolvere un nome senza sapere il campo usa risolvi_criteri.",
      inputSchema: {
        campo: z.enum(LOOKUP_KEYS),
        testo: z.string().trim().min(2).max(200),
        area: areaParam,
      },
      annotations: READ_ONLY,
    },
    ({ campo, testo, area }, { signal }) =>
      withBdp(signal, async (ctx) => ok({ campo, valori: await lookupValues(ctx, campo, testo, area) })),
  );

  server.registerTool(
    "frequenze_parole_chiave",
    {
      title: "Frequenza delle parole chiave",
      description: "Restituisce le parole chiave più usate nei provvedimenti o negli abstract, con il numero di documenti.",
      inputSchema: { tipo: targetParam.default("provvedimenti"), area: areaParam },
      annotations: READ_ONLY,
    },
    ({ tipo, area }, { signal }) =>
      withBdp(signal, async (ctx) => ok(counts(await getOccorrenze(ctx, tipo, area, "parola_chiave")))),
  );

  server.registerTool(
    "pubblicazioni",
    {
      title: "Provvedimenti pubblicati",
      description:
        "Quanti provvedimenti e abstract la Banca Dati ha pubblicato: totali per distretto oppure, con `distretto`, per ciascun ufficio del distretto. Riporta anche aree diverse da CIVILE.",
      inputSchema: { distretto: distrettoParam.optional() },
      annotations: READ_ONLY,
    },
    ({ distretto }, { signal }) =>
      withBdp(signal, async (ctx) => {
        const rows = await getPubblicazioni(ctx);
        if (distretto) {
          if (!rows.some((r) => r.distretto === distretto)) throw unknownDistrict(distretto, rows.map((r) => r.distretto));
          return ok(
            rows
              .filter((r) => r.distretto === distretto)
              .map((r) => ({ ufficio: r.ufficio, area: r.area, provvedimenti: r.provvedimento_count, abstract: r.massima_count })),
          );
        }
        const totals = new Map<string, { distretto: string; area: string; provvedimenti: number; abstract: number }>();
        for (const r of rows) {
          const key = `${r.distretto}|${r.area}`;
          const t = totals.get(key) ?? { distretto: r.distretto, area: r.area, provvedimenti: 0, abstract: 0 };
          t.provvedimenti += r.provvedimento_count;
          t.abstract += r.massima_count;
          totals.set(key, t);
        }
        return ok([...totals.values()].sort((a, b) => b.provvedimenti - a.provvedimenti));
      }),
  );

  server.registerTool(
    "archivio",
    {
      title: "Archivio",
      description:
        "Conteggi dell'archivio della Banca Dati, come nella sezione Archivio del sito. Senza parametri: per distretto. Con distretto: per ufficio. Con ufficio: per materia, eventualmente limitati a un anno e a un mese. Per elencare i provvedimenti usa cerca_provvedimenti con il criterio ufficio e le date.",
      inputSchema: {
        area: areaParam,
        distretto: distrettoParam.optional(),
        ufficio: upper.optional().describe("Ufficio esatto, per esempio TRIBUNALE DI BOLOGNA."),
        materia: upper.optional(),
        anno: z.number().int().min(1900).max(2100).optional(),
        mese: z.enum(MESI).optional(),
      },
      annotations: READ_ONLY,
    },
    (params, { signal }) =>
      withBdp(signal, async (ctx) => {
        const result = await getArchivio(ctx, {
          area: params.area,
          distretto: params.distretto,
          ufficio: params.ufficio,
          materia: params.materia,
          anno: params.anno === undefined ? undefined : String(params.anno),
          mese: params.mese,
        });
        const empty = result.provvedimentoOccurrences.length === 0 && result.massimaOccurrences.length === 0;
        return ok({
          livello: archiveLevel(params),
          provvedimenti: counts(result.provvedimentoOccurrences),
          abstract: counts(result.massimaOccurrences),
          ...(empty && (params.distretto || params.ufficio)
            ? { nota: "Nessun conteggio: controlla distretto e ufficio con elenca_uffici." }
            : {}),
        });
      }),
  );
};
