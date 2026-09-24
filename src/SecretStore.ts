/**
 * Abstraction over secret storage so production code can use Obsidian's
 * `app.secretStorage` while tests supply an in-memory implementation.
 */
export interface SecretStore {
	getSecret(id: string): Promise<string | null> | string | null;
	setSecret(id: string, secret: string): Promise<void> | void;
}
