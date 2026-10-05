import { HttpClient } from "./HttpClient";
import { SecretStore } from "./SecretStore";

export interface TokenFetcherConfig {
	/** OAuth2 token endpoint, e.g. https://internal.example.com/oauth/token */
	tokenUrl: string;
	/** OAuth2 client_id (not secret, safe to store in plugin settings) */
	clientId: string;
	/** Name of the secret in SecretStorage holding the client_secret */
	clientSecretName: string;
	/** Name of the secret in SecretStorage to write the fetched access token to */
	targetSecretName: string;
	/** Optional extra form fields to send with the token request (e.g. scope) */
	extraParams?: Record<string, string>;
}

export interface Logger {
	info(message: string): void;
	error(message: string, error?: unknown): void;
}

export const consoleLogger: Logger = {
	info: () => undefined,
	error: (message, error) => console.error(`[oauth-token-fetcher] ${message}`, error ?? ""),
};

/**
 * Fetches an OAuth2 client-credentials token from `tokenUrl` and stores the
 * resulting access_token into SecretStorage under `targetSecretName`.
 */
export class TokenFetcher {
	constructor(
		private readonly config: TokenFetcherConfig,
		private readonly http: HttpClient,
		private readonly secrets: SecretStore,
		private readonly logger: Logger = consoleLogger,
	) {}

	async fetchAndStoreToken(): Promise<void> {
		const clientSecret = await this.secrets.getSecret(this.config.clientSecretName);
		if (!clientSecret) {
			throw new Error(
				`No secret found named "${this.config.clientSecretName}". Configure it in the plugin settings.`,
			);
		}

		const response = await this.http.postForm(this.config.tokenUrl, {
			grant_type: "client_credentials",
			client_id: this.config.clientId,
			client_secret: clientSecret,
			...this.config.extraParams,
		});

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Token endpoint returned HTTP ${response.status}`);
		}

		const accessToken = this.extractAccessToken(response.json);
		if (!accessToken) {
			throw new Error("Token endpoint response did not contain an access_token");
		}

		await this.secrets.setSecret(this.config.targetSecretName, accessToken);
		this.logger.info(`Stored refreshed token under secret "${this.config.targetSecretName}"`);
	}

	private extractAccessToken(body: unknown): string | null {
		if (typeof body !== "object" || body === null) return null;
		const token = (body as Record<string, unknown>).access_token;
		return typeof token === "string" && token.length > 0 ? token : null;
	}
}
