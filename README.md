# Obsidian OAuth Token Fetcher

Periodically fetches OAuth2 `client_credentials` access tokens from one or
more configurable token endpoints and stores them in Obsidian's
[SecretStorage](https://docs.obsidian.md/plugins/guides/secret-storage), so
other plugins can read them by secret name.

## Settings

Connections are managed in a table: one row per OAuth connection, with
"Add connection", per-row "Fetch"/"Delete" and "Fetch all now" buttons. Each
row has:

- **Name** — display label only.
- **Token URL** — the OAuth2 token endpoint (client_credentials grant).
- **Client ID** — OAuth2 `client_id`.
- **Client secret** — name of the SecretStorage entry holding the `client_secret`.
- **Target secret** — name of the SecretStorage entry the fetched access token
  is written to. Other plugins read this via `app.secretStorage.getSecret(name)`.
- **Refresh (min)** — how often the token is refreshed (default 60).
- **Plugin to reload** — optional other enabled plugin that is reloaded after a
  successful refresh, so it picks up the new token.
- **Confirm reload** — ask for confirmation before that reload (default on).

The command palette entry `Fetch all OAuth tokens now` refreshes every
connection. Settings saved by older versions (a single flat connection) are
migrated automatically into one connection named "Default".

## Development

```bash
npm install
npm run dev     # watch build with esbuild
npm run build   # type-check + production build
```

## Testing

All OAuth/network/secret-storage logic is behind small interfaces
(`HttpClient`, `SecretStore`, `Scheduler`) so tests run against in-memory fakes
instead of a real token endpoint or Obsidian's runtime — no real API usage is
burned and no `obsidian` module needs to be loaded:

- `test/fakes/FakeOAuthServer.ts` — simulates the token endpoint in memory.
- `test/fakes/InMemorySecretStore.ts` — in-memory stand-in for SecretStorage.
- `test/fakes/FakeScheduler.ts` — manually-advanced clock instead of real timers.

The settings tab (`SettingsTab.ts`) is tested the same way: `test/mocks/obsidian.ts`
provides minimal fakes of `PluginSettingTab`/`Setting`/`SecretComponent` backed by
real jsdom elements, so `test/SettingsTab.test.ts` renders the actual settings UI
and simulates real user input (typing, selecting a secret, clicking "Fetch now")
without launching Obsidian. This test file runs under the `jsdom` environment via
a `@jest-environment jsdom` docblock; the rest of the suite runs under `node`.

```bash
npm test
```

## Manual testing in Obsidian

`test-vault/` is a ready-made vault with this plugin and a demo consumer plugin
(`demo/secret-target-demo`) symlinked in. A local mock OAuth2 endpoint
(`demo/mock-oauth-server.mjs`) lets you try the full workflow without a real provider.

1. Build and watch: `npm install && npm run dev` (creates `main.js`, which the vault symlinks to).
2. Start the mock endpoint in another terminal: `npm run mock-server`
   (override with `PORT`, `CLIENT_ID`, `CLIENT_SECRET`).
3. In Obsidian, open `test-vault/` as a vault and enable both community plugins
   (turn off Restricted Mode if prompted).
4. In **OAuth Token Fetcher** settings, click "Add connection" and fill in the row:
   - Token URL: `http://localhost:8080/token`
   - Client ID: `test-client`
   - Client secret: a SecretStorage entry whose value is `test-secret`
   - Target secret: `tt-secret`
5. In **secret-target-demo** settings, set "Secret to display" to `tt-secret`.
6. Click the row's "Fetch" button (or run `Fetch all OAuth tokens now`).
   To test the reload, set "Plugin to reload" to Secret Target Demo first; its
   status bar `loads: N` counter increases after a confirmed reload. The mock server logs each
   request, and the demo plugin's status bar shows the new `mock-token-N-...` value
   within 5 seconds.
7. After code changes, reload the plugin in Obsidian.
