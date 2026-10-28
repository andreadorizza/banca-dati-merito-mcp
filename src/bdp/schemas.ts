import { z } from "zod";

/**
 * BDP's response shapes. Every response is parsed against these at the boundary,
 * so a change on BDP's side surfaces as an explicit error instead of empty fields.
 * Fields BDP may omit are nullish; unknown extra fields are dropped.
 */

const text = z.string().nullish();
const textList = z.array(z.string()).nullish();
/** BDP serialises numbers such as `numero_provvedimento` inconsistently. */
const numberLike = z.union([z.number(), z.string()]).nullish();

export const ProvvedimentoEstremiSchema = z.object({
  id: z.string(),
  area: text,
  tipo: text,
  ufficio: text,
  numero_provvedimento: numberLike,
  anno_provvedimento: numberLike,
  numero_ruolo: numberLike,
  anno_ruolo: numberLike,
  sub_procedimento: numberLike,
  data: text,
  data_pubblicazione: text,
});

const ProvvedimentoMetadatiSchema = ProvvedimentoEstremiSchema.extend({
  distretto: text,
  materia: text,
  ruolo: text,
  presidente: text,
  relatore: text,
  giudice_assegnatario_fascicolo: text,
  parola_chiave: textList,
  riferimento_normativo: textList,
});

export const AbstractEstremiSchema = z.object({
  id: z.string(),
  area: text,
  titolo: text,
  tipo: text,
  ufficio: text,
  numero_provvedimento: numberLike,
  anno_provvedimento: numberLike,
  numero_ruolo: numberLike,
  anno_ruolo: numberLike,
  sub_procedimento: numberLike,
  data: text,
  data_pubblicazione: text,
});

const AbstractMetadatiSchema = AbstractEstremiSchema.extend({
  distretto: text,
  materia: text,
  ruolo: text,
  parola_chiave: textList,
  riferimento_normativo: textList,
});

/** Highlighted snippets: BDP returns either one string or a list. */
const estratto = z.union([z.string(), z.array(z.string())]).nullish();

export const ProvvedimentoRisultatoSchema = ProvvedimentoMetadatiSchema.extend({
  estratto,
  abstract: z.array(z.object({ id: z.string(), titolo: text })).nullish(),
});

export const AbstractRisultatoSchema = AbstractMetadatiSchema.extend({
  testo: text,
  estratto,
  provvedimento: z.object({ id: z.string() }).nullish(),
});

const NotaSulDocumentoSchema = z.object({
  text: text,
  page_number: numberLike,
  color: text,
  author: z.object({ name: text, family_name: text }).nullish(),
  last_update_date: text,
});

export const ProvvedimentoDettaglioSchema = ProvvedimentoMetadatiSchema.extend({
  esito: text,
  stato: text,
  annotazione: text,
  note: text,
  anonymized_document_note: z.array(NotaSulDocumentoSchema).nullish(),
  abstract: z.array(AbstractEstremiSchema).nullish(),
  provvedimento_precedente: z.array(ProvvedimentoEstremiSchema).nullish(),
  provvedimento_successivo: z.array(ProvvedimentoEstremiSchema).nullish(),
});

export const AbstractDettaglioSchema = AbstractMetadatiSchema.extend({
  testo: text,
  esito: text,
  annotazione: text,
  note: text,
  precedente_conforme: z.array(AbstractEstremiSchema).nullish(),
  precedente_difforme: z.array(AbstractEstremiSchema).nullish(),
  provvedimento: ProvvedimentoEstremiSchema.nullish(),
});

export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ count: z.number(), items: z.array(item) });

const CartellaRiferimentoSchema = z.object({ id: z.string(), name: text });

export const CartelleSchema = z.object({
  cartelle: z.array(
    CartellaRiferimentoSchema.extend({
      percorso: z.array(CartellaRiferimentoSchema).nullish(),
      sottocartelle: z
        .array(CartellaRiferimentoSchema.extend({ sottocartelle: z.array(CartellaRiferimentoSchema).nullish() }))
        .nullish(),
    }),
  ),
});

export const CartellaSchema = z.object({
  cartella: CartellaRiferimentoSchema.extend({
    percorso: z.array(CartellaRiferimentoSchema).nullish(),
    sottocartelle: z.array(CartellaRiferimentoSchema).nullish(),
    provvedimenti: z.array(ProvvedimentoEstremiSchema.extend({ materia: text, note: text })).nullish(),
    abstract: z.array(AbstractEstremiSchema.extend({ materia: text, note: text })).nullish(),
  }).nullable(),
});

export const CartelleDiDocumentoSchema = z.object({ cartelle: z.array(CartellaRiferimentoSchema).nullish() });

export const GraphQlEnvelopeSchema = z.object({
  data: z.unknown().nullish(),
  errors: z.array(z.object({ message: z.string() })).nullish(),
});

/** `provvedimento/autocomplete` and `massima/autocomplete`. */
export const SuggerimentiSchema = z.array(z.object({ type: z.string(), text: z.string(), label: z.string() }));
