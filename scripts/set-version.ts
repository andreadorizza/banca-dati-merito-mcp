/**
 * Sets one version everywhere it is written: package.json and its lock file, the
 * Claude Desktop manifest, the Claude Code plugin (version and npx pin), and the
 * README's pinned commands. test/local.test.ts fails if any of them drift.
 *
 *   node scripts/set-version.ts 0.2.0
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const PACKAGE = "banca-dati-merito-mcp";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Uso: node scripts/set-version.ts X.Y.Z");
  process.exit(2);
}

const editJson = async (file: string, edit: (json: Record<string, unknown>) => void): Promise<void> => {
  const path = join(ROOT, file);
  const json: Record<string, unknown> = JSON.parse(await readFile(path, "utf8"));
  edit(json);
  await writeFile(path, `${JSON.stringify(json, null, 2)}\n`);
};

const editText = async (file: string, edit: (text: string) => string): Promise<void> => {
  const path = join(ROOT, file);
  await writeFile(path, edit(await readFile(path, "utf8")));
};

const pin = (text: string): string => text.replaceAll(new RegExp(`${PACKAGE}@\\d+\\.\\d+\\.\\d+`, "g"), `${PACKAGE}@${version}`);

await editJson("package.json", (json) => {
  json.version = version;
});
await editJson("package-lock.json", (json) => {
  json.version = version;
  const packages = json.packages;
  if (packages && typeof packages === "object" && "" in packages) {
    const root: unknown = Reflect.get(packages, "");
    if (root && typeof root === "object") Reflect.set(root, "version", version);
  }
});
await editJson("manifest.json", (json) => {
  json.version = version;
});
await editJson(".claude-plugin/plugin.json", (json) => {
  json.version = version;
});
await editText(".claude-plugin/plugin.json", pin);
await editText("README.md", pin);

console.log(`Versione ${version}. Ora: npm test, commit, git tag -a v${version} -m v${version}, git push --follow-tags (solo i tag annotati vengono inviati).`);
