export interface Connection {
	id: string;
	/** Display label only */
	name: string;
	tokenUrl: string;
	clientId: string;
	/** Name of the SecretStorage entry holding the client_secret */
	clientSecretName: string;
	/** Name of the SecretStorage entry the fetched access token is written to */
	targetSecretName: string;
	refreshIntervalMinutes: number;
	/** ID of another plugin to reload after each successful refresh; empty = none */
	reloadPluginId: string;
	/** Ask the user before reloading that plugin */
	confirmBeforeReload: boolean;
}

export interface OAuthTokenFetcherSettings {
	connections: Connection[];
	/** Record full request/response details (including secrets); always off after a restart */
	debugMode: boolean;
}

export const DEFAULT_SETTINGS: OAuthTokenFetcherSettings = { connections: [], debugMode: false };

export function newConnection(): Connection {
	return {
		id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
		name: "",
		tokenUrl: "",
		clientId: "",
		clientSecretName: "",
		targetSecretName: "",
		refreshIntervalMinutes: 60,
		reloadPluginId: "",
		confirmBeforeReload: true,
	};
}

export function isConfigured(c: Connection): boolean {
	return Boolean(c.tokenUrl && c.clientId && c.clientSecretName && c.targetSecretName);
}

export function displayName(c: Connection): string {
	return c.name || c.targetSecretName || "Unnamed connection";
}

/** Fills defaults and converts the pre-connections flat settings format into one connection. */
export function migrateSettings(data: unknown): OAuthTokenFetcherSettings {
	const raw = (data ?? {}) as Record<string, unknown>;
	// A saved debugMode is ignored on purpose: it resets to off on every restart.
	const debugMode = false;

	if (Array.isArray(raw.connections)) {
		return {
			connections: raw.connections.map((c) => ({ ...newConnection(), ...(c as Partial<Connection>) })),
			debugMode,
		};
	}

	const legacy = ["tokenUrl", "clientId", "clientSecretName", "targetSecretName"] as const;
	if (!legacy.some((key) => raw[key])) return { connections: [], debugMode };

	const connection: Connection = { ...newConnection(), name: "Default" };
	for (const key of legacy) connection[key] = (raw[key] as string | null) ?? "";
	if (typeof raw.refreshIntervalMinutes === "number") connection.refreshIntervalMinutes = raw.refreshIntervalMinutes;
	if (typeof raw.reloadPluginId === "string") connection.reloadPluginId = raw.reloadPluginId;
	if (typeof raw.confirmBeforeReload === "boolean") connection.confirmBeforeReload = raw.confirmBeforeReload;
	return { connections: [connection], debugMode };
}
