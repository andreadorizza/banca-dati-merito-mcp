import { DEFAULT_AREA } from "../config.ts";
import { BdpError } from "../errors.ts";
import { request } from "../bdp/http.ts";
import { isExpired, loadSession, type Session } from "./store.ts";

export type SessionStatus =
  | { stato: "assente" }
  | { stato: "scaduta"; scadutaAlle: string | null }
  | { stato: "valida"; scadeAlle: string | null };

/**
 * `user/current` answers 200 even without a valid session, so the live check is a
 * real data call: the smallest one BDP has.
 */
const probe = (session: Session) =>
  request(session, { method: "GET", path: "materia", query: { area: DEFAULT_AREA } });

export const checkSession = async (): Promise<SessionStatus> => {
  const session = await loadSession();
  if (!session) return { stato: "assente" };
  if (isExpired(session)) return { stato: "scaduta", scadutaAlle: session.expiresAt };
  try {
    await probe(session);
  } catch (error) {
    if (error instanceof BdpError && error.code === "sessione_scaduta") {
      return { stato: "scaduta", scadutaAlle: session.expiresAt };
    }
    throw error;
  }
  return { stato: "valida", scadeAlle: session.expiresAt };
};

/** The session for a data call, or a typed error the tools turn into a hint. */
export const requireSession = async (): Promise<Session> => {
  const session = await loadSession();
  if (!session) throw new BdpError("sessione_assente", "Nessuna sessione salvata per la Banca Dati di Merito.");
  if (isExpired(session)) throw new BdpError("sessione_scaduta", "La sessione della Banca Dati di Merito è scaduta.");
  return session;
};
