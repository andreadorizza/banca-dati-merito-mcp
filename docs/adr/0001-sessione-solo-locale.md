# 0001. La sessione resta sul computer dell'utente

Il server gira solo in locale, via stdio, e la sessione della BDP non lascia mai il
computer di chi ha fatto l'accesso. Non esiste una versione remota o ospitata.

La sessione nasce da un accesso con identità digitale (SPID, CIE di livello 3, CNS,
eIDAS): chi la possiede agisce nella BDP come quella persona, comprese le sue cartelle
personali e le sue note. Un server condiviso dovrebbe custodire una sessione per ogni
avvocato, con tutto ciò che questo comporta in termini di sicurezza, audit e
responsabilità. Tenere la sessione in un file leggibile solo dall'utente, nella sua
cartella dati, elimina il problema invece di gestirlo.

Conseguenze: niente trasporto HTTP, niente integrazione lato server in altri
prodotti, e ogni utente fa il proprio accesso. Rivedere questa scelta richiede di
progettare la custodia delle sessioni, non solo di aggiungere un trasporto.
