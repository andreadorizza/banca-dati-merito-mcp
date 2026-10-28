import { z } from "zod";
import { DEFAULT_AREA, DEFAULT_RESULTS, MAX_RESULTS, RESULT_WINDOW } from "../config.ts";
import { TARGETS } from "../bdp/query.ts";

export const areaParam = z
  .string()
  .trim()
  .min(1)
  .default(DEFAULT_AREA)
  .transform((value) => value.toUpperCase())
  .describe("Area della Banca Dati. Oggi esiste solo CIVILE.");

export const targetParam = z
  .enum(TARGETS)
  .describe("provvedimenti (sentenze, ordinanze, decreti) oppure abstract (sintesi dei principi).");

export const idParam = z.string().trim().min(1).max(200).describe("Identificativo restituito dalle ricerche.");

export const pagingParams = {
  da: z
    .number()
    .int()
    .min(0)
    .max(RESULT_WINDOW - 1)
    .default(0)
    .describe("Posizione del primo risultato, per sfogliare (0 = dal primo)."),
  quanti: z
    .number()
    .int()
    .min(1)
    .max(MAX_RESULTS)
    .default(DEFAULT_RESULTS)
    .describe(`Quanti risultati restituire (predefinito ${DEFAULT_RESULTS}, massimo ${MAX_RESULTS}).`),
};

export const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

type Estremi = {
  numero_provvedimento?: number | string | null | undefined;
  anno_provvedimento?: number | string | null | undefined;
  numero_ruolo?: number | string | null | undefined;
  anno_ruolo?: number | string | null | undefined;
  sub_procedimento?: number | string | null | undefined;
};

const pair = (numero: unknown, anno: unknown): string | null =>
  numero !== null && numero !== undefined && numero !== "" ? `${numero}${anno ? `/${anno}` : ""}` : null;

/** Number and general-docket reference as lawyers write them: "2571/2025", "7688/2024-1". */
export const formatEstremi = (item: Estremi): { numero: string | null; rg: string | null } => {
  const rg = pair(item.numero_ruolo, item.anno_ruolo);
  return {
    numero: pair(item.numero_provvedimento, item.anno_provvedimento),
    rg: rg && item.sub_procedimento ? `${rg}-${item.sub_procedimento}` : rg,
  };
};

/** BDP highlights search hits with HTML; the model reads plain text. */
export const cleanSnippet = (html: string): string =>
  html
    .replace(/<\/?(mark|em|b|strong)>/gi, "**")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

export const snippets = (value: string | readonly string[] | null | undefined): string[] =>
  (typeof value === "string" ? [value] : (value ?? [])).map(cleanSnippet).filter((s) => s !== "");
