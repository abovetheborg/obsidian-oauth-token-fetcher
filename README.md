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
