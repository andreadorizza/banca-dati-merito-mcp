/**
 * BDP's search parameter `q` is a Lucene-style query string, built by the site's
 * own front end as `field:"value"` clauses joined by AND/OR/NOT, with date ranges
 * written `field:[DD/MM/YYYY TO DD/MM/YYYY]`. This module builds it from typed
 * criteria so the model never writes the syntax by hand.
 */

import { BdpError } from "../errors.ts";

export const TARGETS = ["provvedimenti", "abstract"] as const;
export type Target = (typeof TARGETS)[number];

/**
 * Fields a criterion can filter on. Names are BDP's own. Personal notes are not
 * here: BDP takes them as a separate `note_personali` variable, not inside `q`.
 */
export const PROVVEDIMENTO_FIELDS = [
  "tipo",
  "ufficio",
  "distretto",
  "materia",
  "ruolo",
  "numero_provvedimento",
  "anno_provvedimento",
  "numero_ruolo",
  "anno_ruolo",
  "sub_procedimento",
  "presidente",
  "relatore",
  "giudice_assegnatario_fascicolo",
  "parola_chiave",
  "riferimento_normativo",
] as const;

/** Only abstracts carry a title and the procedural party. */
export const ABSTRACT_FIELDS = [...PROVVEDIMENTO_FIELDS, "titolo", "parte_processuale"] as const;

export const TEXT_MODES = ["almeno_una", "tutte", "frase_esatta"] as const;
export type TextMode = (typeof TEXT_MODES)[number];

export const DATE_FIELDS = ["data", "data_pubblicazione"] as const;
export type DateField = (typeof DATE_FIELDS)[number];

export type Criterion<F extends string> = { campo: F; valore: string };

export type QueryInput<F extends string> = {
  criteri?: readonly Criterion<F>[] | undefined;
  escludi?: readonly Criterion<F>[] | undefined;
  testo?: { valore: string; modalita: TextMode } | undefined;
  date?: { campo: DateField; da?: string | undefined; a?: string | undefined } | undefined;
};

/** The full-text field depends on the target: decisions are searched on their pseudonymised text. */
const TEXT_FIELDS = {
  provvedimenti: { any: "anonymized_testo", all: "anonymized_testo_all_words" },
  abstract: { any: "testo", all: "testo_all_words" },
} as const satisfies Record<Target, { any: string; all: string }>;

const EARLIEST = "01/01/1900";

const quote = (value: string): string => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

const clause = (field: string, value: string): string => `${field}:${quote(value)}`;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD (what models produce reliably) to BDP's DD/MM/YYYY. */
export const toBdpDate = (iso: string): string => {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new BdpError("parametri", `Data non valida (atteso AAAA-MM-GG): ${iso}`);
  const [, year, month, day] = match;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    throw new BdpError("parametri", `Data inesistente: ${iso}`);
  }
  return `${day}/${month}/${year}`;
};

const today = (): string => new Date().toISOString().slice(0, 10);

const textClause = (target: Target, { valore, modalita }: NonNullable<QueryInput<string>["testo"]>): string => {
  const fields = TEXT_FIELDS[target];
  switch (modalita) {
    case "almeno_una":
      return clause(fields.any, valore);
    case "tutte":
      return clause(fields.all, valore);
    case "frase_esatta":
      // BDP's own convention: an exact phrase is the value wrapped in an extra pair of quotes.
      return clause(fields.any, `"${valore.replaceAll('"', "")}"`);
    default: {
      const exhaustive: never = modalita;
      return exhaustive;
    }
  }
};

/** Returns "" when there is nothing to filter on (BDP then lists the latest items). */
export const buildQuery = <F extends string>(target: Target, input: QueryInput<F>): string => {
  const positive: string[] = [];
  for (const { campo, valore } of input.criteri ?? []) positive.push(clause(campo, valore));
  if (input.testo && input.testo.valore.trim() !== "") positive.push(textClause(target, input.testo));
  if (input.date && (input.date.da || input.date.a)) {
    const from = input.date.da ? toBdpDate(input.date.da) : EARLIEST;
    const to = toBdpDate(input.date.a ?? today());
    // ISO dates compare correctly as strings; an inverted range would silently match nothing.
    if (input.date.da && input.date.da > (input.date.a ?? today())) {
      throw new BdpError("parametri", `Intervallo di date invertito: da ${input.date.da} a ${input.date.a ?? "oggi"}.`);
    }
    positive.push(`${input.date.campo}:[${from} TO ${to}]`);
  }
  const negative = (input.escludi ?? []).map(({ campo, valore }) => `NOT ${clause(campo, valore)}`);
  if (positive.length === 0 && negative.length > 0) {
    throw new BdpError("parametri", "Le esclusioni richiedono almeno un criterio, un testo o un intervallo di date.");
  }
  return [...positive, ...negative].join(" AND ");
};
