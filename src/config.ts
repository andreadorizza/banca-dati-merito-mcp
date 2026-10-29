import { homedir } from "node:os";
import { join } from "node:path";

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

/** Milliseconds between the start of two BDP requests. Configurable, never below the floor. */
export const minIntervalMs = (): number => {
  const raw = process.env.BDM_MIN_INTERVAL_MS;
  if (raw === undefined || raw === "") return DEFAULT_MIN_INTERVAL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`BDM_MIN_INTERVAL_MS non è un numero: ${raw}`);
  }
  return Math.max(FLOOR_MIN_INTERVAL_MS, parsed);
};

/** Per-user folder for the session file and the dedicated browser profile. */
export const appDir = (): string => {
  const override = process.env.BDM_HOME;
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

export const downloadDir = (): string =>
  process.env.BDM_DOWNLOAD_DIR || join(homedir(), "Downloads", "banca-dati-merito");
