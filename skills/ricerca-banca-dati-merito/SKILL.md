---
name: ricerca-banca-dati-merito
description: Metodo per cercare, leggere e citare la giurisprudenza di merito della Banca Dati di Merito del Ministero della Giustizia (bdp.giustizia.it) con il server MCP banca-dati-merito. Usala quando l'utente chiede sentenze, ordinanze o decreti di tribunali e corti d'appello italiane, abstract, precedenti o orientamenti di merito, o i provvedimenti di un ufficio o di un giudice.
---

# Ricerca nella Banca Dati di Merito

La Banca Dati di Merito (BDP) raccoglie i provvedimenti civili dei tribunali e delle
corti d'appello, pseudonimizzati, e gli abstract che ne sintetizzano i principi. Gli
strumenti del server `banca-dati-merito` la interrogano con la sessione dell'utente.

## Prima di tutto: gli strumenti ci sono?

Il server gira solo sul computer dell'utente, perché la sessione con la BDP non deve
uscirne. Funziona nell'app desktop di Claude con l'estensione installata, in Claude Code
con il plugin e negli altri client MCP locali; non funziona in claude.ai dal browser né
nelle app per smartphone.

Se gli strumenti del server (`stato_sessione`, `cerca_provvedimenti` e gli altri) non
sono disponibili, non cercarli tra i connettori e non provare altre strade: dillo subito
all'utente, spiegando che deve aprire la conversazione nell'app desktop di Claude, con
l'estensione Banca Dati di Merito installata, oppure usare Claude Code. Non inventare
risultati.

## Poi: la sessione

1. Chiama `stato_sessione`.
2. Se è `assente` o `scaduta`, chiama `accedi`: si apre una finestra del browser in cui
   l'utente entra con SPID, CIE, CNS o eIDAS. Dillo all'utente e aspetta che confermi.
3. La sessione dura circa due ore. Se uno strumento risponde che è scaduta, ripeti
   `accedi` e poi la richiesta.

## Il metodo

1. **Chiarisci la domanda.** Materia, ufficio o distretto, periodo, tipo di
   provvedimento, principio cercato. Se l'utente cerca un provvedimento preciso,
   chiedi gli estremi: ufficio, numero e anno, oppure numero di R.G.
2. **Traduci i nomi in valori esatti.** I criteri funzionano solo con il valore che usa
   la BDP ("TRIBUNALE DI BOLOGNA", non "Tribunale di Bologna" o "Bologna"). Usa
   `risolvi_criteri` con il nome come lo dice l'utente e scegli il valore e il campo
   giusti tra quelli proposti. Per vedere tutte le opzioni usa `elenca_uffici` (uffici
   per distretto) o `elenca_valori` (materie, ruoli).
3. **Cerca gli orientamenti negli abstract, le decisioni nei provvedimenti.** Per "qual è
   l'orientamento su…" parti da `cerca_abstract`; per "trova le sentenze che…" usa
   `cerca_provvedimenti`.
4. **Leggi prima di citare.** Gli estratti dei risultati sono frammenti. Prima di
   attribuire un principio a un provvedimento, leggilo con `leggi_testo_provvedimento`
   (a blocchi, se è lungo) e cita il passaggio.
5. **Rispondi con gli estremi.** Per ogni provvedimento: ufficio, tipo, numero e anno,
   R.G., data. Segnala se un abstract ha precedenti conformi o difformi.

## Scrivere una buona ricerca

- **Testo libero.** `modalita: "tutte"` restringe (tutte le parole), `"almeno_una"`
  allarga (basta una parola), `"frase_esatta"` cerca la formula tale e quale. Parti da
  `"tutte"` con due o tre parole caratterizzanti.
- **Criteri di campo.** Combinali con il testo per restringere: ufficio, distretto,
  materia, tipo, presidente, relatore, giudice assegnatario. Si sommano in AND.
- **Parole chiave.** Molti provvedimenti hanno solo la parola chiave generica "ALTRE
  IPOTESI": un filtro per parola chiave può escludere decisioni pertinenti. Usalo per
  restringere, non come unica condizione.
- **Date.** `data` è la data di deposito della minuta, `data_pubblicazione` quella di
  pubblicazione. Formato AAAA-MM-GG.
- **Esclusioni.** `escludi` toglie i risultati con un certo valore (per esempio una
  materia vicina che inquina i risultati).
- **Quanti risultati.** 20 per chiamata, al massimo 50. La BDP mostra solo i primi
  10.000 risultati di una ricerca: se sono di più, restringi invece di sfogliare.

## Citare

Non esiste un unico formato per citare la giurisprudenza di merito: segui quello
dell'utente, se ne ha uno. In mancanza, un formato diffuso è:

> Trib. Bologna, sent. 14 ottobre 2025, n. 2571, R.G. n. 7688/2024

Abbreviazioni comuni: Trib. (Tribunale), App. (Corte d'appello), sent., ord., decr.
Indica quale data usi (deposito o pubblicazione) se l'utente non lo specifica.

## Cautele

- **Un abstract non è una massima ufficiale.** È una sintesi pubblicata nella BDP, non
  una massima di un massimario. Non presentarlo come tale.
- **Le parti sono pseudonimizzate** (`Parte_1`, `Controparte_1`, `C.F._1`). Non cercare
  di identificarle.
- **La BDP non è completa.** Assenza di risultati non significa assenza di precedenti.
- **Non inventare.** Se un provvedimento o un passaggio non compare nei risultati o nel
  testo letto, dillo.
- **Non fare scansioni massive.** Ogni chiamata usa la sessione personale dell'utente:
  cerca in modo mirato.

## L'area personale dell'utente

`cartelle_personali`, `leggi_cartella_personale` e `ricerche_salvate` leggono le
raccolte che l'utente ha creato nella BDP. Sono in sola lettura: il server non crea,
modifica né cancella nulla. Nelle ricerche, `solo_cartelle_personali` limita i
risultati ai documenti salvati nelle cartelle e `note_personali` cerca nelle note
dell'utente.
