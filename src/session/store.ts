import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { API_PATH, BDP_HOST, sessionFile } from "../config.ts";
import { BdpError } from "../errors.ts";

const StoredCookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string(),
  path: z.string(),
  /** Unix seconds; -1 for a browser-session cookie. */
  expires: z.number(),
});

export type StoredCookie = z.infer<typeof StoredCookieSchema>;

const SessionSchema = z.object({
  version: z.literal(1),
  capturedAt: z.iso.datetime(),
  /** From BDP's `user/current` `exp`; null when BDP did not report one. */
  expiresAt: z.iso.datetime().nullable(),
  /**
   * BDP binds the session to the browser that logged in: the same cookies with a
   * different User-Agent get 401 on data endpoints. So we replay the exact headers
   * that browser sent.
   */
  userAgent: z.string().min(1),
  clientHints: z.record(z.string(), z.string()),
  cookies: z.array(StoredCookieSchema),
});

export type Session = z.infer<typeof SessionSchema>;

export const loadSession = async (): Promise<Session | null> => {
  let raw: string;
  try {
    raw = await readFile(sessionFile(), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  const parsed = SessionSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new BdpError(
      "sessione_assente",
      `Il file di sessione ${sessionFile()} non è valido. Ripeti l'accesso con \`accedi\`.`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
};

export const saveSession = async (session: Session): Promise<void> => {
  const file = sessionFile();
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
  // `mode` applies only on creation; enforce it on an existing file too.
  // On Windows this is a no-op, and the per-user %APPDATA% ACL protects the file.
  await chmod(file, 0o600);
};

export const clearSession = async (): Promise<void> => {
  await rm(sessionFile(), { force: true });
};

const domainMatches = (cookieDomain: string, host: string): boolean => {
  const domain = cookieDomain.startsWith(".") ? cookieDomain.slice(1) : cookieDomain;
  return host === domain || host.endsWith(`.${domain}`);
};

/** RFC 6265 §5.1.4, for requests under the API path. */
const pathMatches = (cookiePath: string, requestPath: string): boolean =>
  requestPath === cookiePath ||
  requestPath.startsWith(cookiePath.endsWith("/") ? cookiePath : `${cookiePath}/`);

/**
 * Cookies a browser would send to BDP's API. Selection is by rule, not by name,
 * so a cookie BDP adds or renames after a login still travels.
 * Names containing ":" come from the identity provider's pages and would break the header.
 */
export const cookieHeader = (session: Session, now = Date.now()): string =>
  session.cookies
    .filter(
      (cookie) =>
        domainMatches(cookie.domain, BDP_HOST) &&
        !cookie.name.includes(":") &&
        pathMatches(cookie.path, `${API_PATH}/`) &&
        (cookie.expires === -1 || cookie.expires * 1000 > now),
    )
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

export const isExpired = (session: Session, now = Date.now()): boolean =>
  session.expiresAt !== null && Date.parse(session.expiresAt) <= now;
