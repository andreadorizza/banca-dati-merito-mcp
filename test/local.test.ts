import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, describe, it } from "node:test";
import { z } from "zod";
import { request } from "../src/bdp/http.ts";
import { sessionFile } from "../src/config.ts";
import { BdpError } from "../src/errors.ts";
import { loadSession, saveSession, type Session } from "../src/session/store.ts";
import { safeFileName } from "../src/tools/read.ts";

const SESSION: Session = {
  version: 1,
  capturedAt: "2026-10-29T06:00:00.000Z",
  expiresAt: "2026-10-29T08:00:00.000Z",
  userAgent: "Mozilla/5.0 test",
  clientHints: {},
  cookies: [],
};

const isCode = (code: BdpError["code"]) => (error: unknown): boolean => error instanceof BdpError && error.code === code;

describe("session file", () => {
  before(async () => {
    process.env.BDM_HOME = await mkdtemp(join(tmpdir(), "bdm-local-"));
  });

  it("round-trips and is readable only by the user", async () => {
    await saveSession(SESSION);
    assert.deepEqual(await loadSession(), SESSION);
    if (process.platform !== "win32") assert.equal((await stat(sessionFile())).mode & 0o777, 0o600);
  });

  it("treats a corrupt file as no session, so the model gets the login hint", async () => {
    await writeFile(sessionFile(), "{ truncated");
    await assert.rejects(loadSession(), isCode("sessione_assente"));
  });
});

describe("request", () => {
  it("never sends a request the client already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      request(SESSION, { method: "GET", path: "materia" }, { signal: controller.signal }),
      isCode("annullata"),
    );
  });
});

describe("safeFileName", () => {
  it("keeps names inside the download folder and valid on every OS", () => {
    assert.equal(safeFileName("../../etc/passwd"), "etcpasswd");
    assert.equal(safeFileName("Trib. Bologna 2571/2025"), "Trib._Bologna_25712025");
    assert.equal(safeFileName("NUL"), "documento_NUL");
    assert.equal(safeFileName("///"), "documento");
  });
});

describe("release metadata", () => {
  const version = async (path: string): Promise<string> =>
    z.object({ version: z.string() }).parse(JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"))).version;

  it("uses one version in package.json, the MCPB manifest, the plugin and the README", async () => {
    const pkg = await version("../package.json");
    assert.equal(await version("../manifest.json"), pkg);
    assert.equal(await version("../.claude-plugin/plugin.json"), pkg);
    const plugin = await readFile(new URL("../.claude-plugin/plugin.json", import.meta.url), "utf8");
    assert.ok(plugin.includes(`banca-dati-merito-mcp@${pkg}`), "plugin.json must pin the npm version");
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    for (const match of readme.matchAll(/banca-dati-merito-mcp@([\d.]+)/g)) assert.equal(match[1], pkg);
  });
});
