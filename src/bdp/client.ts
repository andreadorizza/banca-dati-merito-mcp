import { z } from "zod";
import { DEFAULT_AREA } from "../config.ts";
import { BdpError } from "../errors.ts";
import type { Session } from "../session/store.ts";
import {
  CARTELLA_PERSONALE,
  CARTELLE_DEL_PROVVEDIMENTO,
  CARTELLE_DELL_ABSTRACT,
  CARTELLE_PERSONALI,
  searchAbstractDocument,
  searchProvvedimentiDocument,
  VIEW_ABSTRACT,
  VIEW_PROVVEDIMENTO,
} from "./graphql.ts";
import { DOCUMENT_DEADLINE_MS, request, type RequestOptions, type RequestSpec } from "./http.ts";
import type { Target } from "./query.ts";
import {
  AbstractDettaglioSchema,
  AbstractRisultatoSchema,
  ArchivioSchema,
  CartellaSchema,
  CartelleDiDocumentoSchema,
  CartelleSchema,
  GeografiaSchema,
  GraphQlEnvelopeSchema,
  OccorrenzeSchema,
  pageOf,
  ProvvedimentoDettaglioSchema,
  ProvvedimentoRisultatoSchema,
  PubblicazioniSchema,
  RicercheSalvateSchema,
  SuggerimentiSchema,
  TimelineSchema,
  ValoriSchema,
} from "./schemas.ts";

/** What every BDP call needs: the user's session and the MCP request's cancellation signal. */
export type BdpContext = { session: Session; signal?: AbortSignal | undefined };

/** BDP's REST paths name the abstract `massima`. */
const REST_TARGET = { provvedimenti: "provvedimento", abstract: "massima" } as const satisfies Record<Target, string>;

const parse = <T extends z.ZodType>(schema: T, value: unknown, what: string): z.infer<T> => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BdpError("risposta_inattesa", `Risposta inattesa da ${what}: ${z.prettifyError(parsed.error)}`, {
      cause: parsed.error,
    });
  }
  return parsed.data;
};

const getJson = async <T extends z.ZodType>(ctx: BdpContext, spec: RequestSpec, schema: T): Promise<z.infer<T>> => {
  const response = await request(ctx.session, spec, { signal: ctx.signal });
  let body: unknown;
  try {
    body = JSON.parse(response.body.toString("utf8"));
  } catch (error) {
    throw new BdpError("risposta_inattesa", `${spec.path} non ha restituito JSON.`, { cause: error });
  }
  return parse(schema, body, spec.path);
};

const graphql = async <T extends z.ZodType>(
  ctx: BdpContext,
  query: string,
  variables: Record<string, unknown>,
  schema: T,
): Promise<z.infer<T>> => {
  const envelope = await getJson(ctx, { method: "POST", path: "graphql", json: { query, variables } }, GraphQlEnvelopeSchema);
  if (envelope.errors && envelope.errors.length > 0) {
    throw new BdpError("http", `Errore GraphQL della Banca Dati: ${envelope.errors.map((e) => e.message).join("; ")}`);
  }
  return parse(schema, envelope.data, "graphql");
};

export const SORT_KEYS = ["rilevanza", "data", "data_pubblicazione"] as const;
export type SortField = (typeof SORT_KEYS)[number];

const SORT_FIELDS = {
  rilevanza: "_score",
  data: "data",
  data_pubblicazione: "data_pubblicazione",
} as const satisfies Record<SortField, string>;

export type SearchParams = {
  area: string;
  q: string;
  from: number;
  size: number;
  sortField: SortField;
  sortOrder: "asc" | "desc";
  soloCartellePersonali: boolean;
  notePersonali: string | undefined;
};

const searchVariables = (params: SearchParams, withQuery: boolean): Record<string, unknown> => {
  const base = {
    from: params.from,
    size: params.size,
    area: params.area,
    sort_field: SORT_FIELDS[params.sortField],
    sort_order: params.sortOrder,
  };
  return withQuery
    ? { ...base, q: params.q, collated: params.soloCartellePersonali, note_personali: params.notePersonali }
    : base;
};

const hasFilters = (params: SearchParams): boolean =>
  params.q !== "" || params.soloCartellePersonali || Boolean(params.notePersonali);

export const searchProvvedimenti = async (ctx: BdpContext, params: SearchParams) => {
  const withQuery = hasFilters(params);
  const data = await graphql(
    ctx,
    searchProvvedimentiDocument(withQuery),
    searchVariables(params, withQuery),
    z.object({ provvedimento: pageOf(ProvvedimentoRisultatoSchema) }),
  );
  return data.provvedimento;
};

export const searchAbstract = async (ctx: BdpContext, params: SearchParams) => {
  const withQuery = hasFilters(params);
  const data = await graphql(
    ctx,
    searchAbstractDocument(withQuery),
    searchVariables(params, withQuery),
    z.object({ massima: pageOf(AbstractRisultatoSchema) }),
  );
  return data.massima;
};

export const getProvvedimento = async (ctx: BdpContext, id: string, area = DEFAULT_AREA) => {
  const data = await graphql(ctx, VIEW_PROVVEDIMENTO, { id: [id], area }, z.object({ provvedimento: pageOf(ProvvedimentoDettaglioSchema) }));
  return data.provvedimento.items.at(0) ?? null;
};

export const getAbstract = async (ctx: BdpContext, id: string, area = DEFAULT_AREA) => {
  const data = await graphql(ctx, VIEW_ABSTRACT, { id: [id], area }, z.object({ massima: pageOf(AbstractDettaglioSchema) }));
  return data.massima.items.at(0) ?? null;
};

const TEXT_CACHE_SIZE = 5;
const TEXT_CACHE_TTL_MS = 10 * 60 * 1000;
/**
 * Long decisions are read in chunks, one tool call each; without this cache every
 * chunk would download the whole text from BDP again.
 */
const textCache = new Map<string, { text: string; at: number }>();

export const getTestoProvvedimento = async (ctx: BdpContext, id: string): Promise<string> => {
  const cached = textCache.get(id);
  if (cached && Date.now() - cached.at < TEXT_CACHE_TTL_MS) return cached.text;
  const response = await request(
    ctx.session,
    { method: "GET", path: `provvedimento/${encodeURIComponent(id)}/document/testo` },
    { signal: ctx.signal },
  );
  const text = response.body.toString("utf8");
  if (!response.contentType.startsWith("text/plain") || text.trim() === "") {
    throw new BdpError(
      "risposta_inattesa",
      `Il testo del provvedimento ${id} non è disponibile (${response.contentType || "senza tipo"}, ${response.body.length} byte).`,
    );
  }
  textCache.delete(id);
  textCache.set(id, { text, at: Date.now() });
  for (const key of textCache.keys()) {
    if (textCache.size <= TEXT_CACHE_SIZE) break;
    textCache.delete(key);
  }
  return text;
};

export const getDocumento = async (
  ctx: BdpContext,
  target: Target,
  id: string,
  onProgress?: RequestOptions["onProgress"],
): Promise<Buffer> => {
  const options: RequestOptions = { deadlineMs: DOCUMENT_DEADLINE_MS, signal: ctx.signal };
  if (onProgress) options.onProgress = onProgress;
  const response = await request(
    ctx.session,
    { method: "GET", path: `${REST_TARGET[target]}/${encodeURIComponent(id)}/document`, accept: "application/pdf" },
    options,
  );
  if (!response.contentType.includes("pdf")) {
    throw new BdpError("risposta_inattesa", `Il documento richiesto non è un PDF (${response.contentType}).`);
  }
  return response.body;
};

export const getTimeline = (ctx: BdpContext, id: string) =>
  getJson(ctx, { method: "GET", path: `provvedimento/${encodeURIComponent(id)}/timeline` }, TimelineSchema);

export const suggest = (ctx: BdpContext, target: Target, text: string, area: string) =>
  getJson(
    ctx,
    { method: "GET", path: `${REST_TARGET[target]}/autocomplete`, query: { q: text.toUpperCase(), area } },
    SuggerimentiSchema,
  );

export const getOccorrenze = (ctx: BdpContext, target: Target, area: string, campo: string) =>
  getJson(
    ctx,
    { method: "GET", path: `${REST_TARGET[target]}/occurrence/${encodeURIComponent(area)}/${encodeURIComponent(campo)}` },
    OccorrenzeSchema,
  );

export const LIST_KEYS = ["materia", "ruolo"] as const;
export type ListSource = (typeof LIST_KEYS)[number];

export const listValues = (ctx: BdpContext, source: ListSource, area: string) =>
  getJson(ctx, { method: "GET", path: source, query: { area } }, ValoriSchema);

/** Every court office with its district; BDP's own front end caches this list. */
export const getGeografia = (ctx: BdpContext) => getJson(ctx, { method: "GET", path: "ufficio/geografia" }, GeografiaSchema);

export const LOOKUP_KEYS = ["ufficio", "giudice", "parola_chiave", "riferimento_normativo"] as const;
export type LookupSource = (typeof LOOKUP_KEYS)[number];

const LOOKUP_SOURCES = {
  ufficio: { path: "ufficio", needsArea: false },
  giudice: { path: "giudice", needsArea: false },
  parola_chiave: { path: "parola_chiave", needsArea: true },
  riferimento_normativo: { path: "riferimento_normativo", needsArea: false },
} as const satisfies Record<LookupSource, { path: string; needsArea: boolean }>;

export const lookupValues = (ctx: BdpContext, source: LookupSource, text: string, area: string) => {
  const { path, needsArea } = LOOKUP_SOURCES[source];
  return getJson(ctx, { method: "GET", path, query: needsArea ? { q: text, area } : { q: text } }, ValoriSchema);
};

export const getPubblicazioni = (ctx: BdpContext) =>
  getJson(ctx, { method: "GET", path: "monitor/published" }, PubblicazioniSchema);

export type ArchivioParams = {
  area: string;
  distretto?: string | undefined;
  ufficio?: string | undefined;
  materia?: string | undefined;
  anno?: string | undefined;
  mese?: string | undefined;
};

export const getArchivio = (ctx: BdpContext, params: ArchivioParams) =>
  getJson(ctx, { method: "POST", path: "archive/occurrences", json: params }, ArchivioSchema);

export const getRicercheSalvate = (ctx: BdpContext, target: Target) =>
  getJson(ctx, { method: "GET", path: `${REST_TARGET[target]}/filter` }, RicercheSalvateSchema);

export const getCartellePersonali = async (ctx: BdpContext) =>
  (await graphql(ctx, CARTELLE_PERSONALI, {}, CartelleSchema)).cartelle;

export const getCartellaPersonale = async (ctx: BdpContext, id: string) =>
  (await graphql(ctx, CARTELLA_PERSONALE, { id }, CartellaSchema)).cartella;

export const getCartelleDelDocumento = async (ctx: BdpContext, target: Target, id: string) => {
  const result =
    target === "provvedimenti"
      ? await graphql(ctx, CARTELLE_DEL_PROVVEDIMENTO, { provvedimento_id: id }, CartelleDiDocumentoSchema)
      : await graphql(ctx, CARTELLE_DELL_ABSTRACT, { massima_id: id }, CartelleDiDocumentoSchema);
  return result.cartelle ?? [];
};
