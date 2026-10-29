# Rilascio di una nuova versione

I rilasci partono da un tag `vX.Y.Z`. Il workflow
[`release.yml`](../.github/workflows/release.yml) pubblica su npm con il *trusted
publishing* (l'identità OIDC di GitHub Actions, senza token salvati, con
[provenance](https://docs.npmjs.com/generating-provenance-statements)) e crea la release
GitHub con il pacchetto `.mcpb` per Claude Desktop.

```
node scripts/set-version.ts 0.2.0
npm run check
git commit -am "chore: release 0.2.0"
git tag -a v0.2.0 -m v0.2.0
git push --follow-tags
```

`set-version.ts` aggiorna la versione in `package.json`, `package-lock.json`,
`manifest.json`, `.claude-plugin/plugin.json` e nei comandi del README; un test blocca il
rilascio se una di queste è rimasta indietro. Il workflow controlla anche che il tag
corrisponda a `package.json`.

## Configurazione una tantum

Il pacchetto su npm deve fidarsi di questo workflow:

```
npm trust github banca-dati-merito-mcp --file release.yml --repo andreadorizza/banca-dati-merito-mcp --env npm --allow-publish
```

Dopo il primo rilascio riuscito dal workflow, nelle impostazioni del pacchetto su
npmjs.com si può scegliere "Require two-factor authentication and disallow tokens": da
quel momento si pubblica solo dal workflow o con l'autenticazione a due fattori.

## Se un rilascio fallisce a metà

Rilanciare il job: il passo npm salta una versione già pubblicata e la release GitHub
viene aggiornata invece di essere creata di nuovo. Una versione già pubblicata su npm non
si può ripubblicare: per correggerla, rilasciare la successiva.
