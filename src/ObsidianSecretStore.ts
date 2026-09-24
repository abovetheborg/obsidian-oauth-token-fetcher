import type { App } from "obsidian";
import { SecretStore } from "./SecretStore";

/** Production SecretStore backed by Obsidian's `app.secretStorage`. */
export class ObsidianSecretStore implements SecretStore {
	constructor(private readonly app: App) {}

	getSecret(id: string): Promise<string | null> | string | null {
		return this.app.secretStorage.getSecret(id);
	}

	setSecret(id: string, secret: string): Promise<void> | void {
		return this.app.secretStorage.setSecret(id, secret);
	}
}
