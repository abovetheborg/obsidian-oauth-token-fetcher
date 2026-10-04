import { Notice, Plugin } from "obsidian";
import { ObsidianHttpClient } from "./ObsidianHttpClient";
import { ModalConfirmer, ObsidianPluginReloader } from "./ObsidianPluginReloader";
import { ObsidianSecretStore } from "./ObsidianSecretStore";
import { InstalledPlugin, reloadAfterRefresh } from "./PluginReloader";
import { Scheduler, WindowScheduler } from "./Scheduler";
import { DEFAULT_SETTINGS, OAuthTokenFetcherSettings } from "./settings";
import { OAuthTokenFetcherSettingTab } from "./SettingsTab";
import { consoleLogger, TokenFetcher } from "./TokenFetcher";

export default class OAuthTokenFetcherPlugin extends Plugin {
	settings: OAuthTokenFetcherSettings = DEFAULT_SETTINGS;
	private scheduler: Scheduler = new WindowScheduler();
	private cancelRefresh: (() => void) | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new OAuthTokenFetcherSettingTab(this.app, this));

		this.addCommand({
			id: "fetch-oauth-token-now",
			name: "Fetch OAuth token now",
			callback: () => this.fetchTokenNow(),
		});

		this.rescheduleTokenRefresh();
		// Kick off an initial fetch so the token is fresh right after load.
		void this.fetchTokenNow({ reloadPlugin: false });
	}

	onunload() {
		this.cancelRefresh?.();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	rescheduleTokenRefresh(): void {
		this.cancelRefresh?.();
		const intervalMs = this.settings.refreshIntervalMinutes * 60 * 1000;
		this.cancelRefresh = this.scheduler.scheduleRepeating(() => void this.fetchTokenNow(), intervalMs);
	}

	listReloadablePlugins(): InstalledPlugin[] {
		return new ObsidianPluginReloader(this.app, this.manifest.id).listPlugins();
	}

	async fetchTokenNow({ reloadPlugin = true } = {}): Promise<void> {
		if (!this.settings.tokenUrl || !this.settings.clientId || !this.settings.clientSecretName || !this.settings.targetSecretName) {
			new Notice("OAuth Token Fetcher: configure the plugin settings before fetching a token.");
			return;
		}

		const fetcher = new TokenFetcher(
			{
				tokenUrl: this.settings.tokenUrl,
				clientId: this.settings.clientId,
				clientSecretName: this.settings.clientSecretName,
				targetSecretName: this.settings.targetSecretName,
			},
			new ObsidianHttpClient(),
			new ObsidianSecretStore(this.app),
		);

		try {
			await fetcher.fetchAndStoreToken();
		} catch (error) {
			console.error("[oauth-token-fetcher] Failed to refresh token", error);
			new Notice(`OAuth Token Fetcher: failed to refresh token (${(error as Error).message})`);
			return;
		}

		if (reloadPlugin) {
			await reloadAfterRefresh(
				this.settings,
				new ObsidianPluginReloader(this.app, this.manifest.id),
				new ModalConfirmer(this.app),
				consoleLogger,
			);
		}
	}
}
