import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { z } from "zod";
import {
  AbstractDettaglioSchema,
  AbstractRisultatoSchema,
  ArchivioSchema,
  CartelleDiDocumentoSchema,
  CartelleSchema,
  GeografiaSchema,
  OccorrenzeSchema,
  pageOf,
  ProvvedimentoDettaglioSchema,
  ProvvedimentoRisultatoSchema,
  PubblicazioniSchema,
  RicercheSalvateSchema,
  SuggerimentiSchema,
  TimelineSchema,
  ValoriSchema,
} from "../src/bdp/schemas.ts";
import { cleanSnippet, formatEstremi } from "../src/tools/common.ts";

const fixture = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

const graphqlData = <T extends z.ZodType>(schema: T) => z.object({ data: schema });

/**
 * Every fixture is a sanitised live response to this client's own request,
 * recorded with scripts/record.ts. Each must parse with the schema the client uses.
 */
const CASES = {
  "search-provvedimento-phrase": graphqlData(z.object({ provvedimento: pageOf(ProvvedimentoRisultatoSchema) })),
  "search-provvedimento-all-words": graphqlData(z.object({ provvedimento: pageOf(ProvvedimentoRisultatoSchema) })),
  "last-provvedimento": graphqlData(z.object({ provvedimento: pageOf(ProvvedimentoRisultatoSchema) })),
  "search-massima": graphqlData(z.object({ massima: pageOf(AbstractRisultatoSchema) })),
  "last-massima": graphqlData(z.object({ massima: pageOf(AbstractRisultatoSchema) })),
  "view-provvedimento": graphqlData(z.object({ provvedimento: pageOf(ProvvedimentoDettaglioSchema) })),
  "view-massima": graphqlData(z.object({ massima: pageOf(AbstractDettaglioSchema) })),
  "cartelle-personali": graphqlData(CartelleSchema),
  "cartelle-del-provvedimento": graphqlData(CartelleDiDocumentoSchema),
  "provvedimento-timeline": TimelineSchema,
  "provvedimento-autocomplete": SuggerimentiSchema,
  "massima-autocomplete": SuggerimentiSchema,
  "provvedimento-occurrence": OccorrenzeSchema,
  "massima-occurrence": OccorrenzeSchema,
  materia: ValoriSchema,
  ruolo: ValoriSchema,
  "ufficio-query": ValoriSchema,
  "giudice-query": ValoriSchema,
  "parola-chiave-query": ValoriSchema,
  "riferimento-normativo-query": ValoriSchema,
  "ufficio-geografia": GeografiaSchema,
  "monitor-published": PubblicazioniSchema,
  "archive-occurrences-root": ArchivioSchema,
  "archive-occurrences-distretto": ArchivioSchema,
  "provvedimento-filter": RicercheSalvateSchema,
  "massima-filter": RicercheSalvateSchema,
} as const satisfies Record<string, z.ZodType>;

describe("schemas match recorded BDP responses", () => {
  for (const [name, schema] of Object.entries(CASES)) {
    it(name, async () => {
      const parsed = schema.safeParse(await fixture(name));
      assert.ok(parsed.success, parsed.success ? "" : z.prettifyError(parsed.error));
    });
  }

  it("search results keep the fields the tools read", async () => {
    const page = CASES["search-provvedimento-phrase"].parse(await fixture("search-provvedimento-phrase"));
    const item = page.data.provvedimento.items[0];
    assert.ok(item?.id && item.ufficio && item.data_pubblicazione);
    assert.ok(Array.isArray(item.estratto) && Array.isArray(item.abstract));
  });
});

describe("formatting", () => {
  it("writes numbers as lawyers do, without BDP's zero padding", () => {
    assert.deepEqual(
      formatEstremi({ numero_provvedimento: "1238", anno_provvedimento: "2019", numero_ruolo: "00002084", anno_ruolo: "2018", sub_procedimento: "" }),
      { numero: "1238/2019", rg: "2084/2018" },
    );
    assert.deepEqual(
      formatEstremi({ numero_ruolo: "00000161", anno_ruolo: "2020", sub_procedimento: "1" }),
      { numero: null, rg: "161/2020-1" },
    );
  });

  it("turns BDP's highlighted HTML into plain text", () => {
    assert.equal(
      cleanSnippet("l’opposizione al <mark>decreto ingiuntivo</mark> n. 2317&#x2F;2017 sia  \nfondata &amp; accolta"),
      "l’opposizione al **decreto ingiuntivo** n. 2317/2017 sia fondata & accolta",
    );
  });
});
