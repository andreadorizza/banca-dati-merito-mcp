import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { createServer } from "../src/server.ts";

const connect = async (): Promise<Client> => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
};

/** Tools that change something on the user's machine; every other tool only reads. */
const LOCAL_SIDE_EFFECTS = new Set(["accedi", "scarica_documento"]);

describe("MCP server", () => {
  before(async () => {
    process.env.BDM_HOME = await mkdtemp(join(tmpdir(), "bdm-test-"));
  });

  it("marks every BDP tool read-only, except the two with local side effects", async () => {
    const { tools } = await (await connect()).listTools();
    assert.ok(tools.length >= 15);
    for (const tool of tools) {
      assert.equal(tool.annotations?.readOnlyHint, !LOCAL_SIDE_EFFECTS.has(tool.name), tool.name);
      assert.equal(tool.inputSchema.type, "object", tool.name);
      assert.ok(tool.description && tool.description.length > 40, tool.name);
    }
  });

  it("tells the model to read the full text before citing a search result", async () => {
    // Claude Desktop cannot load the skill, so the tool descriptions must carry this rule.
    const { tools } = await (await connect()).listTools();
    for (const name of ["cerca_provvedimenti", "cerca_abstract"]) {
      assert.match(tools.find((t) => t.name === name)?.description ?? "", /leggi_testo_provvedimento/, name);
    }
  });

  it("lists the same tools as the Claude Desktop manifest", async () => {
    const { tools } = await (await connect()).listTools();
    const manifest = z
      .object({ tools: z.array(z.object({ name: z.string() })) })
      .parse(JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8")));
    assert.deepEqual(
      manifest.tools.map((t) => t.name).sort(),
      tools.map((t) => t.name).sort(),
    );
  });

  it("answers a data call without a session with the login hint, not a crash", async () => {
    const result = await (await connect()).callTool({ name: "cerca_provvedimenti", arguments: {} });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.content), /accedi/);
  });

  it("rejects paging beyond BDP's result window before calling BDP", async () => {
    const result = await (await connect()).callTool({
      name: "cerca_provvedimenti",
      arguments: { da: 9990, quanti: 20 },
    });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.content), /10000 risultati/);
  });
});
