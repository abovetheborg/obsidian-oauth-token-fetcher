/**
 * @jest-environment jsdom
 */
import { Setting } from "obsidian";
import { OAuthTokenFetcherSettingTab } from "../src/SettingsTab";
import { Connection, newConnection } from "../src/settings";
import type OAuthTokenFetcherPlugin from "../src/main";

/** Fake plugin: only the surface SettingsTab.ts actually touches. */
function makeFakePlugin(connections: Connection[]) {
	return {
		app: {},
		settings: { connections, debugMode: false },
		showDebugLog: jest.fn(),
		saveSettings: jest.fn().mockResolvedValue(undefined),
		rescheduleTokenRefresh: jest.fn(),
		fetchTokenNow: jest.fn().mockResolvedValue(undefined),
		fetchAllNow: jest.fn().mockResolvedValue(undefined),
		listReloadablePlugins: jest.fn().mockReturnValue([{ id: "demo", name: "Demo" }]),
	};
}

function setInputValue(input: HTMLInputElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event("input"));
}

function fire(el: HTMLElement, type: string) {
	el.dispatchEvent(new Event(type));
}

/** The tab's onChange handlers are async (they await saveSettings()); let them settle. */
const flushMicrotasks = () => Promise.resolve().then(() => Promise.resolve());

// Column order in each table row.
const COL = { name: 0, url: 1, clientId: 2, clientSecret: 3, target: 4, interval: 5, plugin: 6, confirm: 7, actions: 8 };

describe("OAuthTokenFetcherSettingTab", () => {
	function render(connections: Connection[] = [newConnection()]) {
		const plugin = makeFakePlugin(connections);
		const tab = new OAuthTokenFetcherSettingTab({} as any, plugin as unknown as OAuthTokenFetcherPlugin);
		const rerender = () => {
			tab.containerEl.empty();
			const definition = tab.getSettingDefinitions()[0] as unknown as {
				render: (setting: Setting) => void;
			};
			definition.render(new Setting(tab.containerEl));
		};
		jest.spyOn(tab, "update").mockImplementation(rerender);
		rerender();
		return { plugin, tab };
	}

	const rows = (tab: OAuthTokenFetcherSettingTab) => Array.from(tab.containerEl.querySelectorAll("tbody tr"));
	const cell = (row: Element, index: number) => row.children[index] as HTMLElement;
	const button = (root: Element, text: string) =>
		Array.from(root.querySelectorAll("button")).find((b) => b.textContent === text) as HTMLButtonElement;

	it("exposes a debug mode toggle and a debug log action", () => {
		const { tab, plugin } = render();
		const definitions = tab.getSettingDefinitions() as unknown as Array<{
			name: string;
			control?: { key: string };
			action?: () => void;
		}>;

		expect(definitions.map((d) => d.name)).toEqual(["Connections", "Debug mode", "View debug log"]);
		expect(definitions[1].control?.key).toBe("debugMode");

		definitions[2].action?.();
		expect(plugin.showDebugLog).toHaveBeenCalledTimes(1);
	});

	it("renders a table header and one row per connection", () => {
		const { tab } = render([newConnection(), newConnection()]);

		const headers = Array.from(tab.containerEl.querySelectorAll("th")).map((th) => th.textContent);

		expect(headers).toEqual([
			"Name",
			"Token URL",
			"Client ID",
			"Client secret",
			"Target secret",
			"Refresh (min)",
			"Plugin to reload",
			"Confirm reload",
			"",
		]);
		expect(rows(tab)).toHaveLength(2);
	});

	it("updates the right connection and saves when the user types a Token URL", async () => {
		const { tab, plugin } = render([newConnection(), newConnection()]);

		setInputValue(cell(rows(tab)[1], COL.url).querySelector("input")!, "https://example.com/token");
		await flushMicrotasks();

		expect(plugin.settings.connections[0].tokenUrl).toBe("");
		expect(plugin.settings.connections[1].tokenUrl).toBe("https://example.com/token");
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	});

	it("updates the secret names when secrets are selected", async () => {
		const { tab, plugin } = render();
		const row = rows(tab)[0];

		const clientSecret = cell(row, COL.clientSecret).querySelector("input") as HTMLInputElement;
		clientSecret.value = "my-client-secret";
		fire(clientSecret, "change");
		const target = cell(row, COL.target).querySelector("input") as HTMLInputElement;
		target.value = "my-target";
		fire(target, "change");
		await flushMicrotasks();

		expect(plugin.settings.connections[0].clientSecretName).toBe("my-client-secret");
		expect(plugin.settings.connections[0].targetSecretName).toBe("my-target");
	});

	it("only reschedules the refresh timers for valid positive numbers", async () => {
		const { tab, plugin } = render();
		const input = cell(rows(tab)[0], COL.interval).querySelector("input") as HTMLInputElement;

		setInputValue(input, "abc");
		setInputValue(input, "-5");
		await flushMicrotasks();
		expect(plugin.rescheduleTokenRefresh).not.toHaveBeenCalled();

		setInputValue(input, "15");
		await flushMicrotasks();
		expect(plugin.settings.connections[0].refreshIntervalMinutes).toBe(15);
		expect(plugin.rescheduleTokenRefresh).toHaveBeenCalledTimes(1);
	});

	it("saves the chosen plugin to reload and the confirmation toggle", async () => {
		const { tab, plugin } = render();
		const row = rows(tab)[0];
		const select = cell(row, COL.plugin).querySelector("select") as HTMLSelectElement;
		const toggle = cell(row, COL.confirm).querySelector("input") as HTMLInputElement;

		expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "demo"]);

		select.value = "demo";
		fire(select, "change");
		toggle.checked = false;
		fire(toggle, "change");
		await flushMicrotasks();

		expect(plugin.settings.connections[0].reloadPluginId).toBe("demo");
		expect(plugin.settings.connections[0].confirmBeforeReload).toBe(false);
	});

	it("adds a new connection row and reschedules when Add connection is clicked", async () => {
		const { tab, plugin } = render([]);
		expect(rows(tab)).toHaveLength(0);

		button(tab.containerEl, "Add connection").click();
		await flushMicrotasks();

		expect(plugin.settings.connections).toHaveLength(1);
		expect(plugin.saveSettings).toHaveBeenCalled();
		expect(plugin.rescheduleTokenRefresh).toHaveBeenCalled();
		expect(rows(tab)).toHaveLength(1);
	});

	it("deletes only the clicked connection", async () => {
		const [a, b] = [newConnection(), newConnection()];
		const { tab, plugin } = render([a, b]);

		button(rows(tab)[0], "Delete").click();
		await flushMicrotasks();

		expect(plugin.settings.connections).toEqual([b]);
		expect(plugin.rescheduleTokenRefresh).toHaveBeenCalled();
		expect(rows(tab)).toHaveLength(1);
	});

	it("fetches the clicked connection, or all connections", () => {
		const [a, b] = [newConnection(), newConnection()];
		const { tab, plugin } = render([a, b]);

		button(rows(tab)[1], "Fetch").click();
		expect(plugin.fetchTokenNow).toHaveBeenCalledWith(b.id);

		button(tab.containerEl, "Fetch all now").click();
		expect(plugin.fetchAllNow).toHaveBeenCalledTimes(1);
	});
});
