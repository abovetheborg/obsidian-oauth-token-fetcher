import {
	App,
	ButtonComponent,
	DropdownComponent,
	PluginSettingTab,
	SecretComponent,
	Setting,
	TextComponent,
	ToggleComponent,
} from "obsidian";
import type OAuthTokenFetcherPlugin from "./main";
import { Connection, newConnection } from "./settings";

const COLUMNS = [
	"Name",
	"Token URL",
	"Client ID",
	"Client secret",
	"Target secret",
	"Refresh (min)",
	"Plugin to reload",
	"Confirm reload",
	"",
];

export class OAuthTokenFetcherSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: OAuthTokenFetcherPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Connections")
			.setDesc(
				"Each connection fetches an OAuth2 client_credentials token into its target secret and can reload a plugin afterwards",
			)
			.addButton((button) =>
				button.setButtonText("Add connection").onClick(async () => {
					this.plugin.settings.connections.push(newConnection());
					await this.plugin.saveSettings();
					this.plugin.rescheduleTokenRefresh();
					this.display();
				}),
			)
			.addButton((button) =>
				button.setButtonText("Fetch all now").onClick(async () => {
					await this.plugin.fetchAllNow();
				}),
			);

		const doc = containerEl.ownerDocument;
		const wrapper = containerEl.appendChild(doc.createElement("div"));
		wrapper.style.overflowX = "auto";
		const table = wrapper.appendChild(doc.createElement("table"));
		const headRow = table.appendChild(doc.createElement("thead")).appendChild(doc.createElement("tr"));
		for (const title of COLUMNS) {
			headRow.appendChild(doc.createElement("th")).textContent = title;
		}

		const tbody = table.appendChild(doc.createElement("tbody"));
		for (const connection of this.plugin.settings.connections) {
			this.renderRow(tbody, connection);
		}
	}

	private renderRow(tbody: HTMLElement, connection: Connection): void {
		const doc = tbody.ownerDocument;
		const row = tbody.appendChild(doc.createElement("tr"));
		const cell = () => row.appendChild(doc.createElement("td"));
		const save = () => this.plugin.saveSettings();

		const textCell = (key: "name" | "tokenUrl" | "clientId", placeholder = "") =>
			new TextComponent(cell())
				.setPlaceholder(placeholder)
				.setValue(connection[key])
				.onChange(async (value) => {
					connection[key] = value.trim();
					await save();
				});

		textCell("name", "My API");
		textCell("tokenUrl", "https://example.com/oauth/token");
		textCell("clientId");

		for (const key of ["clientSecretName", "targetSecretName"] as const) {
			new SecretComponent(this.app, cell()).setValue(connection[key]).onChange(async (value) => {
				connection[key] = value;
				await save();
			});
		}

		new TextComponent(cell())
			.setValue(String(connection.refreshIntervalMinutes))
			.onChange(async (value) => {
				const minutes = Number(value);
				if (Number.isFinite(minutes) && minutes > 0) {
					connection.refreshIntervalMinutes = minutes;
					await save();
					this.plugin.rescheduleTokenRefresh();
				}
			});

		const dropdown = new DropdownComponent(cell()).addOption("", "None");
		for (const p of this.plugin.listReloadablePlugins()) dropdown.addOption(p.id, p.name);
		dropdown.setValue(connection.reloadPluginId).onChange(async (value) => {
			connection.reloadPluginId = value;
			await save();
		});

		new ToggleComponent(cell()).setValue(connection.confirmBeforeReload).onChange(async (value) => {
			connection.confirmBeforeReload = value;
			await save();
		});

		const actions = cell();
		new ButtonComponent(actions).setButtonText("Fetch").onClick(async () => {
			await this.plugin.fetchTokenNow(connection.id);
		});
		new ButtonComponent(actions).setButtonText("Delete").setWarning().onClick(async () => {
			const { connections } = this.plugin.settings;
			connections.splice(connections.indexOf(connection), 1);
			await save();
			this.plugin.rescheduleTokenRefresh();
			this.display();
		});
	}
}
