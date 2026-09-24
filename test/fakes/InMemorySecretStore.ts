import { SecretStore } from "../../src/SecretStore";

/** In-memory SecretStore for tests. */
export class InMemorySecretStore implements SecretStore {
	private readonly secrets = new Map<string, string>();

	seed(id: string, secret: string): void {
		this.secrets.set(id, secret);
	}

	getSecret(id: string): string | null {
		return this.secrets.get(id) ?? null;
	}

	setSecret(id: string, secret: string): void {
		this.secrets.set(id, secret);
	}
}
