import { App, Modal, Notice, SecretComponent, Setting } from "obsidian";
import { InstalledPlugin } from "./PluginReloader";
import { Connection, DEFAULT_GRANT_TYPE } from "./settings";

/** Form for adding or editing one connection; works on the copy it is given. */
export class ConnectionModal extends Modal {
	constructor(
		app: App,
		private readonly connection: Connection,
		private readonly plugins: InstalledPlugin[],
		private readonly heading: string,
		private readonly onSave: (connection: Connection) => void | Promise<void>,
	) {
		super(app);
	}

	onOpen() {
		this.setTitle(this.heading);
		const c = this.connection;
		let interval = String(c.refreshIntervalMinutes);

		const text = (name: string, desc: string, key: "name" | "tokenUrl" | "grantType" | "clientId" | "scope", placeholder = "") =>
			new Setting(this.contentEl)
				.setName(name)
				.setDesc(desc)
				.addText((t) =>
					t
						.setPlaceholder(placeholder)
						.setValue(c[key])
						.onChange((value) => {
							c[key] = value.trim();
						}),
				);

		const secret = (name: string, desc: string, key: "clientSecretName" | "targetSecretName") =>
			new Setting(this.contentEl)
				.setName(name)
				.setDesc(desc)
				.addComponent((el) =>
					new SecretComponent(this.app, el).setValue(c[key]).onChange((value) => {
						c[key] = value;
					}),
				);

		text("Name", "A label for this connection.", "name", "My API");
		text("Token URL", "OAuth2 token endpoint (client_credentials grant).", "tokenUrl", "https://example.com/oauth/token");
		text("Grant type", "OAuth2 grant_type sent with the request.", "grantType", DEFAULT_GRANT_TYPE);
		text("Client ID", "OAuth2 client_id.", "clientId");
		secret("Client secret", "Secret holding the OAuth2 client_secret.", "clientSecretName");
		secret("Target secret", "Secret the access token is written to.", "targetSecretName");
		text("Scope", "Optional. Space-delimited scopes to request; leave empty to omit.", "scope", "read write");

		new Setting(this.contentEl)
			.setName("Refresh interval")
			.setDesc("Minutes between token refreshes.")
			.addText((t) =>
				t.setValue(interval).onChange((value) => {
					interval = value;
				}),
			);

		new Setting(this.contentEl)
			.setName("Refresh at token expiry")
			.setDesc("Schedule the next refresh from the token's expires_in. Falls back to the interval if the server omits it.")
			.addToggle((t) =>
				t.setValue(c.refreshOnExpiry).onChange((value) => {
					c.refreshOnExpiry = value;
				}),
			);

		new Setting(this.contentEl)
			.setName("Plugin to reload")
			.setDesc("Reload this plugin after each token refresh so it picks up the new token.")
			.addDropdown((d) => {
				d.addOption("", "None");
				for (const p of this.plugins) d.addOption(p.id, p.name);
				d.setValue(c.reloadPluginId).onChange((value) => {
					c.reloadPluginId = value;
				});
			});

		new Setting(this.contentEl)
			.setName("Confirm before reloading")
			.setDesc("Ask before the plugin is reloaded.")
			.addToggle((t) =>
				t.setValue(c.confirmBeforeReload).onChange((value) => {
					c.confirmBeforeReload = value;
				}),
			);

		new Setting(this.contentEl)
			.addButton((b) =>
				b.setButtonText("Save").setCta().onClick(async () => {
					const minutes = Number(interval);
					if (!Number.isFinite(minutes) || minutes <= 0) {
						new Notice("Refresh interval must be a positive number of minutes.");
						return;
					}
					c.refreshIntervalMinutes = minutes;
					await this.onSave(c);
					this.close();
				}),
			)
			.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
	}

	onClose() {
		this.contentEl.empty();
	}
}
