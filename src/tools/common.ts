import { z } from "zod";
import { DEFAULT_AREA, DEFAULT_RESULTS, MAX_RESULTS, RESULT_WINDOW } from "../config.ts";
import { TARGETS } from "../bdp/query.ts";

export const areaParam = z
  .string()
  .trim()
  .min(1)
  .default(DEFAULT_AREA)
  .transform((value) => value.toUpperCase())
  .describe(
    "Area della Banca Dati. Le ricerche oggi restituiscono risultati solo in CIVILE; le statistiche contano anche PENALE.",
  );

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

/** BDP zero-pads docket numbers ("00002084"); lawyers write "2084". */
const unpad = (value: number | string | null | undefined): string =>
  value === null || value === undefined ? "" : String(value).replace(/^0+(?=\d)/, "");

const pair = (numero: number | string | null | undefined, anno: number | string | null | undefined): string | null => {
  const n = unpad(numero);
  if (n === "") return null;
  const a = unpad(anno);
  return a === "" ? n : `${n}/${a}`;
};

/** Number and general-docket reference as lawyers write them: "2571/2025", "7688/2024-1". */
export const formatEstremi = (item: Estremi): { numero: string | null; rg: string | null } => {
  const rg = pair(item.numero_ruolo, item.anno_ruolo);
  const sub = unpad(item.sub_procedimento);
  return {
    numero: pair(item.numero_provvedimento, item.anno_provvedimento),
    rg: rg && sub !== "" ? `${rg}-${sub}` : rg,
  };
};

const NAMED_ENTITIES: Record<string, string> = { nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">", amp: "&" };

/** BDP highlights hits with `<mark>` and escapes characters as entities (`&#x2F;`); the model reads plain text. */
export const cleanSnippet = (html: string): string =>
  html
    .replace(/<\/?mark>/gi, "**")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim();

export const snippets = (value: readonly string[] | null | undefined): string[] =>
  (value ?? []).map(cleanSnippet).filter((s) => s !== "");
