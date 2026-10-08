import { App, ExtraButtonComponent, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import { ConnectionModal } from "./ConnectionModal";
import type OAuthTokenFetcherPlugin from "./main";
import { Connection, newConnection } from "./settings";

const COLUMNS = ["Name", "Token URL", "Target secret", "Refresh", "Reload plugin", ""];

export class OAuthTokenFetcherSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: OAuthTokenFetcherPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Connections",
				desc: "OAuth token requests, each optionally reloading a plugin afterwards.",
				render: (setting) => this.renderConnections(setting),
			},
			{
				name: "Debug mode",
				desc: "Record full request and response details, including secrets, for troubleshooting. Turns off again after a restart.",
				control: { type: "toggle", key: "debugMode" },
			},
			{
				name: "View debug log",
				desc: "Open the recorded log to read or copy it. It is kept in memory only.",
				action: () => this.plugin.showDebugLog(),
			},
		];
	}

	private renderConnections(setting: Setting): () => void {
		// On update() Obsidian may re-run render() on the same row, so drop the previous output first.
		setting.controlEl.empty();
		for (const child of Array.from(setting.settingEl.children)) {
			if (child.hasClass("oauth-fetcher-table-wrap")) child.remove();
		}

		setting.settingEl.addClass("oauth-fetcher-connections");
		setting
			.addButton((button) =>
				button
					.setButtonText("Add connection")
					.setCta()
					.onClick(() => this.openModal("Add connection", newConnection())),
			)
			.addButton((button) =>
				button.setButtonText("Fetch all now").onClick(async () => {
					await this.plugin.fetchAllNow();
				}),
			);

		const wrap = setting.settingEl.createDiv({ cls: "oauth-fetcher-table-wrap" });
		const cleanup = () => wrap.remove();
		const { connections } = this.plugin.settings;
		if (connections.length === 0) {
			wrap.createDiv({ cls: "oauth-fetcher-empty", text: "No connections yet. Add one to get started." });
			return cleanup;
		}

		const table = wrap.createEl("table", { cls: "oauth-fetcher-table" });
		const headRow = table.createEl("thead").createEl("tr");
		for (const title of COLUMNS) headRow.createEl("th", { text: title });

		const tbody = table.createEl("tbody");
		const plugins = this.plugin.listReloadablePlugins();
		for (const connection of connections) this.renderRow(tbody, connection, plugins);
		return cleanup;
	}

	private renderRow(tbody: HTMLElement, connection: Connection, plugins: Array<{ id: string; name: string }>): void {
		const row = tbody.createEl("tr");
		const reloadName = plugins.find((p) => p.id === connection.reloadPluginId)?.name ?? connection.reloadPluginId;

		row.createEl("td", { text: connection.name || "Unnamed" });
		row.createEl("td", { text: connection.tokenUrl || "Not set", cls: "oauth-fetcher-url" });
		row.createEl("td", { text: connection.targetSecretName || "Not set" });
		row.createEl("td", { text: connection.refreshOnExpiry ? "On expiry" : `${connection.refreshIntervalMinutes} min` });
		row.createEl("td", reloadName ? { text: reloadName } : { text: "None", cls: "oauth-fetcher-muted" });

		const actions = row.createEl("td").createDiv({ cls: "oauth-fetcher-actions" });
		new ExtraButtonComponent(actions)
			.setIcon("refresh-cw")
			.setTooltip("Fetch now")
			.onClick(async () => {
				await this.plugin.fetchTokenNow(connection.id);
			});
		new ExtraButtonComponent(actions)
			.setIcon("pencil")
			.setTooltip("Edit")
			.onClick(() => this.openModal("Edit connection", { ...connection }));
		new ExtraButtonComponent(actions)
			.setIcon("trash-2")
			.setTooltip("Delete")
			.onClick(async () => {
				const { connections } = this.plugin.settings;
				connections.splice(connections.indexOf(connection), 1);
				await this.plugin.saveSettings();
				this.plugin.rescheduleTokenRefresh();
				this.update();
			});
	}

	private openModal(heading: string, connection: Connection): void {
		new ConnectionModal(this.app, connection, this.plugin.listReloadablePlugins(), heading, async (updated) => {
			const { connections } = this.plugin.settings;
			const index = connections.findIndex((c) => c.id === updated.id);
			if (index >= 0) connections[index] = updated;
			else connections.push(updated);
			await this.plugin.saveSettings();
			this.plugin.rescheduleTokenRefresh();
			this.update();
		}).open();
	}
}
