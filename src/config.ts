import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { BdpError } from "./errors.ts";

export const BDP_HOST = "bdp.giustizia.it";
export const BDP_ORIGIN = `https://${BDP_HOST}`;
export const API_PATH = "/api/bdm/frontoffice";
/** Entry point of BDP's own login: redirects to the Ministry's identity provider (SPID, CIE, CNS, eIDAS). */
export const LOGIN_URL = `${BDP_ORIGIN}${API_PATH}/azure`;

/**
 * Searches return results only in CIVILE today, although BDP's statistics already
 * count some PENALE decisions; hence a parameter with this default.
 */
export const DEFAULT_AREA = "CIVILE";

export const DEFAULT_RESULTS = 20;
export const MAX_RESULTS = 50;
/** BDP pages at most the first 10,000 hits of a search (an Elasticsearch result window). */
export const RESULT_WINDOW = 10_000;

const DEFAULT_MIN_INTERVAL_MS = 1000;
const FLOOR_MIN_INTERVAL_MS = 250;

const APP_NAME = "banca-dati-merito-mcp";

/**
 * An environment value as clients actually pass it. Claude Desktop forwards an
 * empty or unresolved `${user_config.x}` literally and does not expand `${HOME}`
 * in defaults, so those placeholders are resolved (or treated as unset) here.
 */
const envValue = (name: string): string | undefined => {
  const raw = process.env[name]?.trim();
  if (!raw || /\$\{user_config\.[^}]*\}/.test(raw)) return undefined;
  return raw
    .replace(/^~(?=$|[/\\])/, homedir())
    .replace(/\$\{HOME\}|\$HOME\b/g, homedir())
    .replace(/\$\{(DOCUMENTS|DESKTOP)\}/g, (_, dir: string) => join(homedir(), dir === "DOCUMENTS" ? "Documents" : "Desktop"));
};

/** Milliseconds between the start of two BDP requests. Configurable, never below the floor. */
export const minIntervalMs = (): number => {
  const raw = envValue("BDM_MIN_INTERVAL_MS");
  if (raw === undefined) return DEFAULT_MIN_INTERVAL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`BDM_MIN_INTERVAL_MS non è un numero: ${raw}`);
  }
  return Math.max(FLOOR_MIN_INTERVAL_MS, parsed);
};

/** Per-user folder for the session file and the dedicated browser profile. */
export const appDir = (): string => {
  const override = envValue("BDM_HOME");
  if (override) return override;
  switch (process.platform) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", APP_NAME);
    case "win32":
      return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), APP_NAME);
    default:
      return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), APP_NAME);
  }
};

export const sessionFile = (): string => join(appDir(), "sessione.json");
export const browserProfileDir = (): string => join(appDir(), "browser-profile");

export const downloadDir = (): string => {
  const configured = envValue("BDM_DOWNLOAD_DIR");
  if (configured === undefined) return join(homedir(), "Downloads", "banca-dati-merito");
  // A relative path would land wherever the client started the server (often "/").
  if (!isAbsolute(configured)) {
    throw new BdpError("parametri", `La cartella per i PDF deve essere un percorso assoluto: ${configured}`);
  }
  return configured;
};
