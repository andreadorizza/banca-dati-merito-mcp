import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildQuery, toBdpDate } from "../src/bdp/query.ts";

describe("buildQuery", () => {
  it("joins criteria with AND, in BDP's field:\"value\" form", () => {
    const q = buildQuery("provvedimenti", {
      criteri: [
        { campo: "ufficio", valore: "TRIBUNALE DI BOLOGNA" },
        { campo: "parola_chiave", valore: "DECRETO INGIUNTIVO" },
      ],
    });
    assert.equal(q, 'ufficio:"TRIBUNALE DI BOLOGNA" AND parola_chiave:"DECRETO INGIUNTIVO"');
  });

  it("maps each text mode to BDP's field for the target", () => {
    const text = (modalita: "almeno_una" | "tutte" | "frase_esatta") => ({ valore: "decreto ingiuntivo", modalita });
    assert.equal(buildQuery("provvedimenti", { testo: text("almeno_una") }), 'anonymized_testo:"decreto ingiuntivo"');
    assert.equal(
      buildQuery("provvedimenti", { testo: text("tutte") }),
      'anonymized_testo_all_words:"decreto ingiuntivo"',
    );
    assert.equal(
      buildQuery("provvedimenti", { testo: text("frase_esatta") }),
      'anonymized_testo:"\\"decreto ingiuntivo\\""',
    );
    assert.equal(buildQuery("abstract", { testo: text("tutte") }), 'testo_all_words:"decreto ingiuntivo"');
  });

  it("escapes quotes and backslashes so a value cannot break out of its clause", () => {
    const q = buildQuery("provvedimenti", { criteri: [{ campo: "materia", valore: 'A" OR materia:"B\\' }] });
    assert.equal(q, 'materia:"A\\" OR materia:\\"B\\\\"');
  });

  it("writes date ranges in DD/MM/YYYY and fills an open start", () => {
    assert.equal(
      buildQuery("provvedimenti", { date: { campo: "data_pubblicazione", da: "2024-01-01", a: "2024-12-31" } }),
      "data_pubblicazione:[01/01/2024 TO 31/12/2024]",
    );
    assert.equal(
      buildQuery("provvedimenti", { date: { campo: "data", a: "2020-02-29" } }),
      "data:[01/01/1900 TO 29/02/2020]",
    );
  });

  it("puts exclusions last as AND NOT", () => {
    const q = buildQuery("abstract", {
      testo: { valore: "locazione", modalita: "almeno_una" },
      escludi: [{ campo: "materia", valore: "CONDOMINIO" }],
    });
    assert.equal(q, 'testo:"locazione" AND NOT materia:"CONDOMINIO"');
  });

  it("rejects exclusions with nothing to exclude from", () => {
    assert.throws(() => buildQuery("provvedimenti", { escludi: [{ campo: "materia", valore: "X" }] }), RangeError);
  });

  it("returns an empty query when there are no filters", () => {
    assert.equal(buildQuery("provvedimenti", {}), "");
    assert.equal(buildQuery("provvedimenti", { testo: { valore: "  ", modalita: "tutte" } }), "");
  });
});

describe("toBdpDate", () => {
  it("rejects malformed and impossible dates", () => {
    assert.throws(() => toBdpDate("2024-1-5"), RangeError);
    assert.throws(() => toBdpDate("2023-02-29"), RangeError);
    assert.throws(() => toBdpDate("31/12/2024"), RangeError);
  });
});
