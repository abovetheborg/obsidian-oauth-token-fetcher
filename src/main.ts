import { Notice, Plugin } from "obsidian";
import { ModalConfirmer, ObsidianPluginReloader } from "./ObsidianPluginReloader";
import { ObsidianHttpClient } from "./ObsidianHttpClient";
import { ObsidianSecretStore } from "./ObsidianSecretStore";
import { InstalledPlugin, reloadAfterRefresh } from "./PluginReloader";
import { Scheduler, WindowScheduler } from "./Scheduler";
import { displayName, isConfigured, migrateSettings, OAuthTokenFetcherSettings } from "./settings";
import { OAuthTokenFetcherSettingTab } from "./SettingsTab";
import { consoleLogger, TokenFetcher } from "./TokenFetcher";

interface FetchOptions {
	/** Reload the connection's configured plugin after a successful refresh */
	reloadPlugin?: boolean;
	/** Show a notice when the connection is incomplete (off for background fetches) */
	notifyIfUnconfigured?: boolean;
}

export default class OAuthTokenFetcherPlugin extends Plugin {
	settings: OAuthTokenFetcherSettings = { connections: [] };
	private scheduler: Scheduler = new WindowScheduler();
	private cancelRefreshes: Array<() => void> = [];

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new OAuthTokenFetcherSettingTab(this.app, this));

		this.addCommand({
			id: "fetch-oauth-token-now",
			name: "Fetch all OAuth tokens now",
			callback: () => this.fetchAllNow(),
		});

		this.rescheduleTokenRefresh();
		// Initial fetch so tokens are fresh right after load; no reload prompt at startup.
		for (const c of this.settings.connections) {
			void this.fetchTokenNow(c.id, { reloadPlugin: false, notifyIfUnconfigured: false });
		}
	}

	onunload() {
		this.cancelAllRefreshes();
	}

	async loadSettings() {
		this.settings = migrateSettings(await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** Rebuilds one timer per connection; call after connections or intervals change. */
	rescheduleTokenRefresh(): void {
		this.cancelAllRefreshes();
		for (const c of this.settings.connections) {
			const intervalMs = c.refreshIntervalMinutes * 60 * 1000;
			this.cancelRefreshes.push(
				this.scheduler.scheduleRepeating(
					() => void this.fetchTokenNow(c.id, { notifyIfUnconfigured: false }),
					intervalMs,
				),
			);
		}
	}

	listReloadablePlugins(): InstalledPlugin[] {
		return new ObsidianPluginReloader(this.app, this.manifest.id).listPlugins();
	}

	async fetchAllNow(): Promise<void> {
		for (const c of [...this.settings.connections]) {
			await this.fetchTokenNow(c.id);
		}
	}

	async fetchTokenNow(connectionId: string, { reloadPlugin = true, notifyIfUnconfigured = true }: FetchOptions = {}): Promise<void> {
		const connection = this.settings.connections.find((c) => c.id === connectionId);
		if (!connection) return;
		const label = displayName(connection);

		if (!isConfigured(connection)) {
			if (notifyIfUnconfigured) {
				new Notice(`OAuth Token Fetcher: configure "${label}" before fetching a token.`);
			}
			return;
		}

		const fetcher = new TokenFetcher(
			{
				tokenUrl: connection.tokenUrl,
				clientId: connection.clientId,
				clientSecretName: connection.clientSecretName,
				targetSecretName: connection.targetSecretName,
			},
			new ObsidianHttpClient(),
			new ObsidianSecretStore(this.app),
		);

		try {
			await fetcher.fetchAndStoreToken();
		} catch (error) {
			console.error(`[oauth-token-fetcher] Failed to refresh token for "${label}"`, error);
			new Notice(`OAuth Token Fetcher: failed to refresh "${label}" (${(error as Error).message})`);
			return;
		}

		if (reloadPlugin) {
			await reloadAfterRefresh(
				connection,
				new ObsidianPluginReloader(this.app, this.manifest.id),
				new ModalConfirmer(this.app),
				consoleLogger,
			);
		}
	}

	private cancelAllRefreshes() {
		this.cancelRefreshes.forEach((cancel) => cancel());
		this.cancelRefreshes = [];
	}
}
