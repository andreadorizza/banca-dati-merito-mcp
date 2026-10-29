/**
 * Every failure the server reports. `code` drives the hint shown to the model;
 * `message` is Italian because it reaches the user.
 */
export const BDP_ERROR_CODES = [
  "sessione_assente",
  "sessione_scaduta",
  "login_fallito",
  "http",
  "risposta_inattesa",
  "rete",
  "parametri",
  "annullata",
] as const;

export type BdpErrorCode = (typeof BDP_ERROR_CODES)[number];

export class BdpError extends Error {
  override readonly name = "BdpError";
  readonly code: BdpErrorCode;

  constructor(code: BdpErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}

const LOGIN = "lo strumento `accedi` dal client, oppure `banca-dati-merito-mcp login` da terminale";

const HINTS = {
  sessione_assente: `Accedi alla Banca Dati di Merito con ${LOGIN}.`,
  sessione_scaduta: `La sessione dura circa due ore. Rinnovala con ${LOGIN}, poi ripeti la richiesta.`,
  login_fallito: `Riprova con ${LOGIN}. Se il problema persiste, controlla che Chrome o Edge siano installati.`,
  http: "Riprova più tardi. Se l'errore si ripete, la Banca Dati potrebbe aver cambiato il suo funzionamento.",
  risposta_inattesa:
    "La Banca Dati ha risposto in un formato diverso da quello atteso: probabilmente ha cambiato il suo funzionamento. Segnala il problema nel repository del progetto.",
  rete: "Controlla la connessione a internet e riprova.",
  parametri: "Correggi i parametri e riprova.",
  annullata: "La richiesta è stata annullata dal client prima di completarsi.",
} as const satisfies Record<BdpErrorCode, string>;

export const hintFor = (code: BdpErrorCode): string => HINTS[code];
