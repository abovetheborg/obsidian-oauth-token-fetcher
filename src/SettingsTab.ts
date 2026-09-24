import { App, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import type OAuthTokenFetcherPlugin from "./main";

export class OAuthTokenFetcherSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: OAuthTokenFetcherPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Token URL")
			.setDesc("OAuth2 token endpoint (client_credentials grant)")
			.addText((text) =>
				text
					.setPlaceholder("https://internal.example.com/oauth/token")
					.setValue(this.plugin.settings.tokenUrl)
					.onChange(async (value) => {
						this.plugin.settings.tokenUrl = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Client ID")
			.setDesc("OAuth2 client_id")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.clientId)
					.onChange(async (value) => {
						this.plugin.settings.clientId = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Client secret")
			.setDesc("Select the SecretStorage entry holding the OAuth2 client_secret")
			.addComponent((el) =>
				new SecretComponent(this.app, el)
					.setValue(this.plugin.settings.clientSecretName)
					.onChange(async (value) => {
						this.plugin.settings.clientSecretName = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Target secret")
			.setDesc("SecretStorage entry the refreshed access token is written to (other plugins read this)")
			.addComponent((el) =>
				new SecretComponent(this.app, el)
					.setValue(this.plugin.settings.targetSecretName)
					.onChange(async (value) => {
						this.plugin.settings.targetSecretName = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Refresh interval (minutes)")
			.setDesc("How often to fetch a new token")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.refreshIntervalMinutes))
					.onChange(async (value) => {
						const minutes = Number(value);
						if (Number.isFinite(minutes) && minutes > 0) {
							this.plugin.settings.refreshIntervalMinutes = minutes;
							await this.plugin.saveSettings();
							this.plugin.rescheduleTokenRefresh();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Fetch now")
			.setDesc("Manually trigger a token refresh")
			.addButton((button) =>
				button.setButtonText("Fetch now").onClick(async () => {
					await this.plugin.fetchTokenNow();
				}),
			);
	}
}
