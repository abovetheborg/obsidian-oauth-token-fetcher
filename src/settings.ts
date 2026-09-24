export interface OAuthTokenFetcherSettings {
	tokenUrl: string;
	clientId: string;
	/** Name of the SecretStorage entry holding the client_secret */
	clientSecretName: string;
	/** Name of the SecretStorage entry the fetched access token is written to */
	targetSecretName: string;
	refreshIntervalMinutes: number;
}

export const DEFAULT_SETTINGS: OAuthTokenFetcherSettings = {
	tokenUrl: "",
	clientId: "",
	clientSecretName: "",
	targetSecretName: "",
	refreshIntervalMinutes: 60,
};
