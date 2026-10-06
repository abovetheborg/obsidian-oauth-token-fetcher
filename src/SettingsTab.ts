import {
	App,
	ButtonComponent,
	DropdownComponent,
	PluginSettingTab,
	SecretComponent,
	Setting,
	SettingDefinitionItem,
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

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Connections",
				desc: "Manage OAuth token requests and optional plugin reloads.",
				render: (setting) => this.renderConnections(setting),
			},
			{
				name: "Debug mode",
				desc: "Record full request and response details, including secrets, for troubleshooting. Kept in memory until Obsidian quits.",
				control: { type: "toggle", key: "debugMode" },
			},
			{
				name: "View debug log",
				desc: "Open the recorded log to read or copy it. It is kept in memory only.",
				action: () => this.plugin.showDebugLog(),
			},
		];
	}

	private renderConnections(setting: Setting): void {
			new Setting(setting.controlEl)
				.setName("Connections")
				.addButton((button) =>
					button.setButtonText("Add connection").onClick(async () => {
						this.plugin.settings.connections.push(newConnection());
						await this.plugin.saveSettings();
						this.plugin.rescheduleTokenRefresh();
						this.update();
					}),
				)
				.addButton((button) =>
					button.setButtonText("Fetch all now").onClick(async () => {
						await this.plugin.fetchAllNow();
					}),
				);

			const wrapper = setting.controlEl.createDiv();
			wrapper.setCssStyles({ overflowX: "auto" });
			const table = wrapper.createEl("table");
			const headRow = table.createEl("thead").createEl("tr");
			for (const title of COLUMNS) headRow.createEl("th", { text: title });

			const tbody = table.createEl("tbody");
			for (const connection of this.plugin.settings.connections) this.renderRow(tbody, connection);
	}

	private renderRow(tbody: HTMLElement, connection: Connection): void {
			const row = tbody.createEl("tr");
			const cell = () => row.createEl("td");
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
		new ButtonComponent(actions).setButtonText("Delete").setDestructive().onClick(async () => {
			const { connections } = this.plugin.settings;
			connections.splice(connections.indexOf(connection), 1);
			await save();
			this.plugin.rescheduleTokenRefresh();
			this.update();
		});
	}
}
