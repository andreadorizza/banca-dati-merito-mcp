import https from "node:https";
import { API_PATH, BDP_HOST, BDP_ORIGIN, minIntervalMs } from "../config.ts";
import { BdpError } from "../errors.ts";
import { cookieHeader, type Session } from "../session/store.ts";
import { caBundle, isMissingIntermediateError, learnIntermediateFromAia } from "./tls.ts";

export type QueryParams = Record<string, string | number | undefined>;

export type RequestSpec =
  | { method: "GET"; path: string; query?: QueryParams; accept?: string }
  | { method: "POST"; path: string; query?: QueryParams; json: unknown };

export type RawResponse = { status: number; contentType: string; body: Buffer };

export type RequestOptions = {
  /**
   * Total time allowed, separate from the idle timeout: BDP builds document PDFs
   * on the fly, taking over 10 seconds to start and about 6 KB/s after that.
   */
  deadlineMs?: number;
  onProgress?: (received: number, total: number | undefined) => void;
};

const IDLE_TIMEOUT_MS = 40_000;
const DEFAULT_DEADLINE_MS = 60_000;
export const DOCUMENT_DEADLINE_MS = 180_000;
const MAX_BODY_BYTES = 50 * 1024 * 1024;

/**
 * One BDP request at a time, with a minimum gap between starts, for the whole
 * process. This protects the user's own account from an agent stuck in a loop.
 */
class Throttle {
  private tail: Promise<unknown> = Promise.resolve();
  private lastStart = 0;

  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(async () => {
      const wait = this.lastStart + minIntervalMs() - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.lastStart = Date.now();
      return task();
    });
    this.tail = next.catch(() => undefined);
    return next;
  }
}

const throttle = new Throttle();

const buildPath = (path: string, query: QueryParams | undefined): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return `${API_PATH}/${path}${qs ? `?${qs}` : ""}`;
};

const headersFor = (session: Session, spec: RequestSpec): Record<string, string> => {
  const base: Record<string, string> = {
    Accept: spec.method === "GET" && spec.accept ? spec.accept : "application/json, text/plain, */*",
    "Accept-Language": "it-IT,it;q=0.9",
    Cookie: cookieHeader(session),
    Referer: `${BDP_ORIGIN}/`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": session.userAgent,
    ...session.clientHints,
  };
  switch (spec.method) {
    case "GET":
      return base;
    case "POST":
      return { ...base, "Content-Type": "application/json", Origin: BDP_ORIGIN };
    default: {
      const exhaustive: never = spec;
      return exhaustive;
    }
  }
};

const send = (session: Session, spec: RequestSpec, options: RequestOptions): Promise<RawResponse> =>
  new Promise((resolve, reject) => {
    const payload = spec.method === "POST" ? Buffer.from(JSON.stringify(spec.json)) : undefined;
    const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
    const req = https.request(
      {
        host: BDP_HOST,
        path: buildPath(spec.path, spec.query),
        method: spec.method,
        headers: payload ? { ...headersFor(session, spec), "Content-Length": payload.length } : headersFor(session, spec),
        ca: caBundle(),
        timeout: IDLE_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        const length = Number(res.headers["content-length"]);
        const total = Number.isFinite(length) ? length : undefined;
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            req.destroy(new Error(`risposta oltre ${MAX_BODY_BYTES} byte`));
            return;
          }
          chunks.push(chunk);
          options.onProgress?.(size, total);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            contentType: res.headers["content-type"] ?? "",
            body: Buffer.concat(chunks),
          }),
        );
        res.on("error", reject);
      },
    );
    const deadline = setTimeout(
      () => req.destroy(new Error(`risposta non completata entro ${deadlineMs / 1000} secondi`)),
      deadlineMs,
    );
    req.on("close", () => clearTimeout(deadline));
    req.on("timeout", () => req.destroy(new Error(`nessun dato per ${IDLE_TIMEOUT_MS / 1000} secondi`)));
    req.on("error", reject);
    req.end(payload);
  });

const sendWithTlsRecovery = async (session: Session, spec: RequestSpec, options: RequestOptions): Promise<RawResponse> => {
  try {
    return await send(session, spec, options);
  } catch (error) {
    if (!isMissingIntermediateError(error)) throw error;
    if (!(await learnIntermediateFromAia(BDP_HOST))) throw error;
    return send(session, spec, options);
  }
};

/** BDP signals a missing or expired session in three different ways. */
const isAuthFailure = (response: RawResponse): boolean =>
  response.status === 401 ||
  response.status === 403 ||
  (response.status >= 300 && response.status < 400) ||
  response.body.subarray(0, 64).toString("utf8").toLowerCase().includes("jwt non presente");

export const request = async (session: Session, spec: RequestSpec, options: RequestOptions = {}): Promise<RawResponse> => {
  let response: RawResponse;
  try {
    response = await throttle.run(() => sendWithTlsRecovery(session, spec, options));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new BdpError("rete", `Richiesta a ${spec.path} non riuscita: ${reason}`, { cause: error });
  }
  if (isAuthFailure(response)) {
    throw new BdpError("sessione_scaduta", "La sessione della Banca Dati di Merito è scaduta o non è valida.");
  }
  if (response.status >= 400) {
    const snippet = response.body.subarray(0, 200).toString("utf8");
    throw new BdpError("http", `La Banca Dati ha risposto ${response.status} a ${spec.path}: ${snippet}`);
  }
  return response;
};
