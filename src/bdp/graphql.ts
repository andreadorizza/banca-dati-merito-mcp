/**
 * GraphQL documents for BDP's `/graphql` endpoint. Field names are BDP's own, as
 * its front end requests them; the selection is ours. Collaborators' email
 * addresses and user ids on personal notes are deliberately not requested.
 */

const PROVVEDIMENTO_ESTREMI = `
  id
  area
  tipo
  ufficio
  numero_provvedimento
  anno_provvedimento
  numero_ruolo
  anno_ruolo
  sub_procedimento
  data
  data_pubblicazione`;

const PROVVEDIMENTO_METADATI = `
  ${PROVVEDIMENTO_ESTREMI}
  distretto
  materia
  ruolo
  presidente
  relatore
  giudice_assegnatario_fascicolo
  parola_chiave
  riferimento_normativo`;

const ABSTRACT_ESTREMI = `
  id
  area
  titolo
  tipo
  ufficio
  numero_provvedimento
  anno_provvedimento
  numero_ruolo
  anno_ruolo
  sub_procedimento
  data
  data_pubblicazione`;

const ABSTRACT_METADATI = `
  ${ABSTRACT_ESTREMI}
  distretto
  materia
  ruolo
  parola_chiave
  riferimento_normativo`;

const LIST_VARIABLES = "$from: Int, $size: Int, $area: String, $sort_field: String, $sort_order: String";
const LIST_ARGUMENTS = "from: $from, size: $size, area: $area, sort_field: $sort_field, sort_order: $sort_order";
const QUERY_VARIABLES = "$q: String, $collated: Boolean, $note_personali: String";
const QUERY_ARGUMENTS = "q: $q, collated: $collated, note_personali: $note_personali";

/**
 * BDP's front end uses a separate operation without `q` to list the latest items,
 * so a search with no filters does the same instead of sending `q: null`.
 */
const listOperation = (root: "provvedimento" | "massima", withQuery: boolean, selection: string): string => {
  const variables = withQuery ? `${LIST_VARIABLES}, ${QUERY_VARIABLES}` : LIST_VARIABLES;
  const args = withQuery ? `${LIST_ARGUMENTS}, ${QUERY_ARGUMENTS}` : LIST_ARGUMENTS;
  return `query Cerca(${variables}) {
  ${root}(${args}) {
    count
    items {${selection}
    }
  }
}`;
};

const SEARCH_PROVVEDIMENTO_ITEM = `
  ${PROVVEDIMENTO_METADATI}
  estratto
  abstract: massimaByProvvedimento { id titolo }`;

const SEARCH_ABSTRACT_ITEM = `
  ${ABSTRACT_METADATI}
  testo
  estratto
  provvedimento: provvedimentoByMassima { id }`;

export const searchProvvedimentiDocument = (withQuery: boolean): string =>
  listOperation("provvedimento", withQuery, SEARCH_PROVVEDIMENTO_ITEM);

export const searchAbstractDocument = (withQuery: boolean): string =>
  listOperation("massima", withQuery, SEARCH_ABSTRACT_ITEM);

const NOTE_SUL_DOCUMENTO = `
  anonymized_document_note {
    text
    page_number
    color
    author { name family_name }
    last_update_date
  }`;

export const VIEW_PROVVEDIMENTO = `query Provvedimento($id: [String], $area: String) {
  provvedimento(id: $id, area: $area, from: 0, size: 1) {
    count
    items {
      ${PROVVEDIMENTO_METADATI}
      esito
      stato
      annotazione
      note
      ${NOTE_SUL_DOCUMENTO}
      abstract: massimaByProvvedimento { ${ABSTRACT_ESTREMI} }
      provvedimento_precedente { ${PROVVEDIMENTO_ESTREMI} }
      provvedimento_successivo { ${PROVVEDIMENTO_ESTREMI} }
    }
  }
}`;

export const VIEW_ABSTRACT = `query Abstract($id: [String], $area: String) {
  massima(id: $id, area: $area, from: 0, size: 1) {
    count
    items {
      ${ABSTRACT_METADATI}
      testo
      esito
      annotazione
      note
      precedente_conforme { ${ABSTRACT_ESTREMI} }
      precedente_difforme { ${ABSTRACT_ESTREMI} }
      provvedimento: provvedimentoByMassima { ${PROVVEDIMENTO_ESTREMI} }
    }
  }
}`;

export const CARTELLE_PERSONALI = `query CartellePersonali {
  cartelle: fascicolo {
    id
    name
    percorso: fascicoloPath { id name }
    sottocartelle: fascicoloByFascicolo {
      id
      name
      sottocartelle: fascicoloByFascicolo { id name }
    }
  }
}`;

export const CARTELLA_PERSONALE = `query CartellaPersonale($id: String!) {
  cartella: fascicolo(id: $id) {
    id
    name
    percorso: fascicoloPath { id name }
    sottocartelle: fascicoloByFascicolo { id name }
    provvedimenti: provvedimentoByFascicolo { ${PROVVEDIMENTO_ESTREMI} materia note }
    abstract: massimaByFascicolo { ${ABSTRACT_ESTREMI} materia note }
  }
}`;

export const CARTELLE_DEL_PROVVEDIMENTO = `query CartelleDelProvvedimento($provvedimento_id: String) {
  cartelle: fascicolo(provvedimento_id: $provvedimento_id) { id name }
}`;

export const CARTELLE_DELL_ABSTRACT = `query CartelleDellAbstract($massima_id: String) {
  cartelle: fascicolo(massima_id: $massima_id) { id name }
}`;
