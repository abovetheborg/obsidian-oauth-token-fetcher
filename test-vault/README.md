# Test Vault

This vault exists only for manually testing the OAuth Token Fetcher plugin.
The plugin folder is symlinked to the built `main.js`/`manifest.json` in the
repo root, so running `npm run dev` (watch build) and reloading the plugin in
Obsidian picks up changes immediately.

## secret-target-demo

`secret-target-demo` (source in [../demo/secret-target-demo](../demo/secret-target-demo))
is a second, unbundled demo plugin that simulates "another plugin" consuming
the secret. Set its "Secret to display" setting to the same name as OAuth
Token Fetcher's "Target secret", and its status bar item polls SecretStorage
every 5 seconds — watch it change after OAuth Token Fetcher runs a refresh.
