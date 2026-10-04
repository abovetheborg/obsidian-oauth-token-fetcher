# Obsidian OAuth Token Fetcher

Periodically fetches an OAuth2 `client_credentials` access token from a
configurable token endpoint and stores it in Obsidian's
[SecretStorage](https://docs.obsidian.md/plugins/guides/secret-storage), so
other plugins can read it by secret name.

## Settings

- **Token URL** — the OAuth2 token endpoint (client_credentials grant).
- **Client ID** — OAuth2 `client_id`.
- **Client secret** — name of the SecretStorage entry holding the `client_secret`.
- **Target secret** — name of the SecretStorage entry the fetched access token
  is written to. Other plugins read this via `app.secretStorage.getSecret(name)`.
- **Refresh interval (minutes)** — how often the token is refreshed (default 60).

A "Fetch now" button and a command palette entry (`Fetch OAuth token now`) let
you trigger a manual refresh.

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
4. In **OAuth Token Fetcher** settings:
   - Token URL: `http://localhost:8080/token`
   - Client ID: `test-client`
   - Client secret: a SecretStorage entry whose value is `test-secret`
   - Target secret: `tt-secret`
5. In **secret-target-demo** settings, set "Secret to display" to `tt-secret`.
6. Click "Fetch now" (or run `Fetch OAuth token now`). The mock server logs each
   request, and the demo plugin's status bar shows the new `mock-token-N-...` value
   within 5 seconds.
7. After code changes, reload the plugin in Obsidian.
