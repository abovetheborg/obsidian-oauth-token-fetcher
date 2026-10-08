# Obsidian OAuth Token Fetcher

Periodically fetches OAuth2 `client_credentials` access tokens from one or
more configurable token endpoints and stores them in Obsidian's
[SecretStorage](https://docs.obsidian.md/plugins/guides/secret-storage), so
other plugins can read them by secret name.

## Settings

Connections are listed in a table with one row per OAuth connection (name,
token URL, target secret, refresh interval, plugin to reload). Use **Add
connection** to open a form, and the row icons to fetch now, edit, or delete.
**Fetch all now** refreshes every connection. The form has:

- **Name** — display label only.
- **Token URL** — the OAuth2 token endpoint.
- **Grant type** — OAuth2 `grant_type` sent with the request (default `client_credentials`).
- **Client ID** — OAuth2 `client_id`.
- **Client secret** — name of the SecretStorage entry holding the `client_secret`.
- **Target secret** — name of the SecretStorage entry the fetched access token
  is written to. Other plugins read this via `app.secretStorage.getSecret(name)`.
- **Scope** — optional space-delimited OAuth2 `scope` sent with the request.
- **Refresh interval** — minutes between refreshes (default 60).
- **Refresh at token expiry** — instead of a fixed interval, refresh when the
  token's `expires_in` (seconds, RFC 6749) has elapsed. If the server omits
  `expires_in`, or a fetch fails, the refresh interval is used. Waits are at
  least 30 seconds, and the table shows "On expiry" for these connections.
- **Plugin to reload** — optional other enabled plugin that is reloaded after a
  successful refresh, so it picks up the new token.
- **Confirm before reloading** — ask for confirmation before that reload (default on).

The command palette entry `Fetch all OAuth tokens now` refreshes every
connection. Settings saved by older versions (a single flat connection) are
migrated automatically into one connection named "Default".

## Debug mode

Turn on **Debug mode** in the plugin settings (it is off again after every
restart), trigger a fetch, then use
**View debug log** (or the `Show OAuth debug log` command) and click **Copy**.
For each token request it records the URL, form fields, and the server's status,
response headers and body, which usually explains errors such as HTTP 401
(`error_description`, `WWW-Authenticate`). Values are logged as-is, **including the
client secret and returned tokens**, so treat copied logs as sensitive. Failed
fetches are always recorded (with or without debug mode); the request/response
detail needs debug mode on. The log is kept in memory only (last 200 entries)
and is cleared when Obsidian quits or the plugin is disabled.

## Network use and privacy

The plugin sends a `client_credentials` request (client ID and client secret)
only to the Token URL you configure on each connection. Client secrets and
fetched tokens are stored in Obsidian's SecretStorage, never in the plugin's
`data.json`. No telemetry or other network requests are made. "Plugin to
reload" uses Obsidian's internal plugin manager (not a public API) to disable
and re-enable the chosen plugin.

## Development

```bash
npm install
npm run dev     # watch build with esbuild
npm run build   # type-check + production build
```

## Releasing

Commit your changes first so the working tree is clean, then run:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

`npm version` updates `package.json`, `manifest.json`, and `versions.json`, then
creates a commit and matching version tag (without a `v` prefix). Pushing the
commit and tag runs `.github/workflows/release.yml`, which tests, builds,
attests, and publishes a GitHub release with `main.js` and `manifest.json`.
For the first submission only, add the plugin through the
[Obsidian Community directory](https://community.obsidian.md/) account page.
Subsequent releases are scanned automatically.

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
   (override with `PORT`, `CLIENT_ID`, `CLIENT_SECRET`, `SCOPES`, `REQUIRE_SCOPE=1`, `EXPIRES_IN` seconds).
   It follows RFC 6749 section 4.4: it requires `grant_type=client_credentials`,
   accepts credentials in the form body or an HTTP Basic header, validates the
   optional `scope` against `SCOPES` (default `read write`), and returns the
   granted `scope` plus standard `invalid_request` / `invalid_client` /
   `unsupported_grant_type` / `invalid_scope` errors.
3. In Obsidian, open `test-vault/` as a vault and enable both community plugins
   (turn off Restricted Mode if prompted).
4. In **OAuth Token Fetcher** settings, click "Add connection" and fill in the form:
   - Token URL: `http://localhost:8080/token`
   - Client ID: `test-client`
   - Client secret: a SecretStorage entry whose value is `test-secret`
   - Target secret: `tt-secret`
   - Scope: `read` (optional)
5. In **secret-target-demo** settings, set "Secret to display" to `tt-secret`.
6. Click the row's refresh icon (or run `Fetch all OAuth tokens now`).
   To test the reload, set "Plugin to reload" to Secret Target Demo first; its
   status bar `loads: N` counter increases after a confirmed reload. The mock server logs each
   request, and the demo plugin's status bar shows the new `mock-token-N-...` value
   within 5 seconds.
7. After code changes, reload the plugin in Obsidian.
