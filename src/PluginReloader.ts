import { Logger } from "./TokenFetcher";

export interface InstalledPlugin {
	id: string;
	name: string;
}

export interface PluginReloader {
	/** Enabled plugins that can be reloaded (excludes this plugin). */
	listPlugins(): InstalledPlugin[];
	reload(pluginId: string): Promise<void>;
}

export interface Confirmer {
	confirm(message: string): Promise<boolean>;
}

export interface ReloadSettings {
	reloadPluginId: string;
	confirmBeforeReload: boolean;
}

/** Reloads the configured plugin after a successful token refresh, optionally asking first. */
export async function reloadAfterRefresh(
	settings: ReloadSettings,
	reloader: PluginReloader,
	confirmer: Confirmer,
	logger: Logger,
): Promise<boolean> {
	const target = reloader.listPlugins().find((p) => p.id === settings.reloadPluginId);
	if (!target) return false;

	if (settings.confirmBeforeReload) {
		const ok = await confirmer.confirm(`The OAuth token was refreshed. Reload "${target.name}" now?`);
		if (!ok) return false;
	}

	try {
		await reloader.reload(target.id);
		logger.info(`Reloaded plugin "${target.id}"`);
		return true;
	} catch (error) {
		logger.error(`Failed to reload plugin "${target.id}"`, error);
		return false;
	}
}
