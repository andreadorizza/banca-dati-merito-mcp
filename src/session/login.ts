import { mkdir } from "node:fs/promises";
import type { BrowserContext, Request } from "playwright-core";
import { z } from "zod";
import { API_PATH, BDP_ORIGIN, browserProfileDir, LOGIN_URL } from "../config.ts";
import { BdpError } from "../errors.ts";
import { saveSession, type Session, type StoredCookie } from "./store.ts";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_MS = 1500;
const BROWSER_CHANNELS = ["chrome", "msedge"] as const;
/** Headers the browser sends that BDP's session may be bound to. */
const REPLAYED_HINTS = ["sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform"] as const;

const CurrentUserSchema = z.object({
  upn: z.string().nullish(),
  /** Unix seconds. */
  exp: z.number().nullish(),
});

export type LoginState =
  | { status: "inattivo" }
  | { status: "in_corso"; startedAt: string }
  | { status: "riuscito"; finishedAt: string; expiresAt: string | null }
  | { status: "fallito"; finishedAt: string; error: string };

let state: LoginState = { status: "inattivo" };
let running: Promise<Session> | null = null;

export const loginState = (): LoginState => state;

const launch = async (): Promise<BrowserContext> => {
  const { chromium } = await import("playwright-core");
  const profile = browserProfileDir();
  await mkdir(profile, { recursive: true, mode: 0o700 });
  const failures: string[] = [];
  for (const channel of BROWSER_CHANNELS) {
    try {
      // A dedicated persistent profile: separate from the user's own browsing, and
      // it keeps the identity provider's sign-in between logins.
      return await chromium.launchPersistentContext(profile, { channel, headless: false, viewport: null });
    } catch (error) {
      failures.push(`${channel}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
  throw new BdpError(
    "login_fallito",
    `Non trovo Google Chrome né Microsoft Edge per aprire il login. Installane uno e riprova. (${failures.join("; ")})`,
  );
};

const currentUser = async (context: BrowserContext): Promise<z.infer<typeof CurrentUserSchema> | null> => {
  try {
    const response = await context.request.get(`${BDP_ORIGIN}${API_PATH}/user/current`, { failOnStatusCode: false });
    if (!response.ok()) return null;
    const parsed = CurrentUserSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    // The browser may be mid-redirect between identity-provider pages; try again next poll.
    return null;
  }
};

const waitForSignIn = async (context: BrowserContext): Promise<z.infer<typeof CurrentUserSchema>> => {
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (context.pages().length === 0) {
      throw new BdpError("login_fallito", "La finestra del login è stata chiusa prima di completare l'accesso.");
    }
    const user = await currentUser(context);
    if (user?.upn) return user;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new BdpError("login_fallito", "Accesso non completato entro 5 minuti.");
};

/** Captures the exact headers the browser sends to BDP's API, after sign-in. */
const captureBrowserHeaders = async (
  context: BrowserContext,
): Promise<{ userAgent: string; clientHints: Record<string, string> }> => {
  const page = context.pages()[0] ?? (await context.newPage());
  const apiRequest = context.waitForEvent("request", {
    predicate: (req: Request) => req.url().startsWith(`${BDP_ORIGIN}${API_PATH}/`),
    timeout: 30_000,
  });
  await page.goto(`${BDP_ORIGIN}/`, { waitUntil: "domcontentloaded" });
  const headers = await (await apiRequest).allHeaders();
  const userAgent = headers["user-agent"];
  if (!userAgent) throw new BdpError("login_fallito", "Il browser non ha inviato uno User-Agent.");
  const clientHints: Record<string, string> = {};
  for (const name of REPLAYED_HINTS) {
    const value = headers[name];
    if (value) clientHints[name] = value;
  }
  return { userAgent, clientHints };
};

const runLogin = async (): Promise<Session> => {
  const context = await launch();
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    // With a still-valid sign-in in the dedicated profile, BDP logs in without a new CIE/SPID step.
    const alreadySignedIn = (await currentUser(context))?.upn;
    if (!alreadySignedIn) await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    const user = await waitForSignIn(context);
    const { userAgent, clientHints } = await captureBrowserHeaders(context);
    const cookies: StoredCookie[] = (await context.cookies(`${BDP_ORIGIN}${API_PATH}/`)).map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires,
    }));
    const session: Session = {
      version: 1,
      capturedAt: new Date().toISOString(),
      expiresAt: user.exp ? new Date(user.exp * 1000).toISOString() : null,
      userAgent,
      clientHints,
      cookies,
    };
    await saveSession(session);
    return session;
  } finally {
    await context.close().catch(() => undefined);
  }
};

/** Starts a login in the background and returns at once; the MCP server polls `loginState`. */
export const startLogin = (): LoginState => {
  if (running) return state;
  state = { status: "in_corso", startedAt: new Date().toISOString() };
  running = runLogin();
  running
    .then((session) => {
      state = { status: "riuscito", finishedAt: new Date().toISOString(), expiresAt: session.expiresAt };
    })
    .catch((error: unknown) => {
      state = {
        status: "fallito",
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    })
    .finally(() => {
      running = null;
    });
  return state;
};

/** Blocking login for the CLI. */
export const login = async (): Promise<Session> => {
  startLogin();
  if (!running) throw new BdpError("login_fallito", "Login non avviato.");
  return running;
};
