# Glossario

I termini usati dal server, dagli strumenti e dalla documentazione. Dove la Banca
Dati di Merito (BDP) usa un nome diverso nella sua interfaccia o nelle sue API, è
indicato.

**Provvedimento**
: Una decisione di un ufficio giudiziario di merito pubblicata nella BDP: sentenza,
  ordinanza o decreto, in forma pseudonimizzata.
  _Da evitare_: sentenza (è solo uno dei tipi).

**Abstract**
: La sintesi, pubblicata nella BDP, di un principio affermato in un provvedimento.
  Si chiama `massima` nelle API della BDP; qui si usa "abstract", come
  nell'interfaccia della BDP, perché non ha il valore di una massima ufficiale di un
  massimario.
  _Da evitare_: massima.

**Precedente conforme / difforme**
: Un altro abstract che la BDP collega a un abstract perché afferma lo stesso
  principio, o il principio opposto.

**Fascicolo**
: Il fascicolo processuale presso l'ufficio giudiziario, come in "giudice
  assegnatario fascicolo". Non indica mai una cartella personale.

**Cartella personale**
: Una raccolta di provvedimenti e abstract che l'utente crea nella propria area della
  BDP. Si chiama `fascicolo` nelle API della BDP; qui si usa "cartella personale",
  come nell'interfaccia, per non confonderla con il fascicolo processuale.
  _Da evitare_: fascicolo.

**Ufficio**
: L'ufficio giudiziario che ha emesso il provvedimento, per esempio "TRIBUNALE DI
  BOLOGNA" o "CORTE DI APPELLO DI BOLOGNA".

**Distretto**
: Il distretto di corte d'appello a cui appartiene l'ufficio.

**Area**
: Il settore della BDP in cui cercare. Oggi esiste solo `CIVILE`.

**Criterio**
: Una condizione di ricerca su un campo della BDP, per esempio ufficio, materia o
  parola chiave, con il valore esatto usato dalla BDP.

**Estremi**
: I dati che identificano un provvedimento: ufficio, tipo, numero e anno, numero di
  ruolo generale (R.G.) e date.

**Sessione**
: L'accesso alla BDP ottenuto con SPID, CIE, CNS o eIDAS. Dura circa due ore e resta
  solo sul computer dell'utente.
