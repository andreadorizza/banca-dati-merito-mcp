# 0002. Un'implementazione nuova in TypeScript

Esistevano già due progetti per la BDP:
[mcp-bdm-civile](https://glama.ai/mcp/servers/avvocati-e-mac/mcp-bdm-civile), che
pilota il sito con un browser in background, e
[mcp-bdm](https://github.com/slimmanolesta/mcp-bdm), un client Python delle API del
sito, ben verificato ma pensato per Windows e dichiarato "riferimento, non prodotto".

Abbiamo scritto un client nuovo in TypeScript invece di estendere uno dei due:

- Claude Desktop esegue le estensioni Node con il proprio runtime, quindi un
  pacchetto MCPB si installa con un clic. Un server Python richiede Python su ogni
  computer.
- Il perimetro è più ampio: abstract, criteri tramite autocompletamento, timeline,
  archivio, statistiche e area personale in sola lettura, oltre alla ricerca dei
  provvedimenti.
- Le risposte della BDP sono validate con schemi espliciti, così un cambiamento del
  sito produce un errore chiaro invece di campi vuoti.

Il contratto delle API (operazioni GraphQL, sintassi della query, intestazioni
richieste) è stato ricavato dal codice pubblico del sito e verificato con chiamate
reali. Il README di mcp-bdm ha confermato in modo indipendente due comportamenti non
ovvi: la sessione legata allo User-Agent e la durata di circa due ore.
