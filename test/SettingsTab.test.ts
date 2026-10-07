/**
 * @jest-environment jsdom
 */
import { Setting } from "obsidian";
import { ConnectionModal } from "../src/ConnectionModal";
import { OAuthTokenFetcherSettingTab } from "../src/SettingsTab";
import { Connection, newConnection } from "../src/settings";
import type OAuthTokenFetcherPlugin from "../src/main";

jest.mock("../src/ConnectionModal", () => ({
	ConnectionModal: jest.fn().mockImplementation(() => ({ open: jest.fn() })),
}));

/** Fake plugin: only the surface SettingsTab.ts actually touches. */
function makeFakePlugin(connections: Connection[]) {
	return {
		app: {},
		settings: { connections, debugMode: false },
		saveSettings: jest.fn().mockResolvedValue(undefined),
		rescheduleTokenRefresh: jest.fn(),
		fetchTokenNow: jest.fn().mockResolvedValue(undefined),
		fetchAllNow: jest.fn().mockResolvedValue(undefined),
		showDebugLog: jest.fn(),
		listReloadablePlugins: jest.fn().mockReturnValue([{ id: "demo", name: "Demo" }]),
	};
}

/** The tab's async handlers await saveSettings(); let them settle. */
const flushMicrotasks = () => Promise.resolve().then(() => Promise.resolve());

const COL = { name: 0, url: 1, target: 2, refresh: 3, reload: 4, actions: 5 };

function conn(overrides: Partial<Connection> = {}): Connection {
	return { ...newConnection(), ...overrides };
}

describe("OAuthTokenFetcherSettingTab", () => {
	beforeEach(() => (ConnectionModal as unknown as jest.Mock).mockClear());

	function render(connections: Connection[] = [conn()]) {
		const plugin = makeFakePlugin(connections);
		const tab = new OAuthTokenFetcherSettingTab({} as any, plugin as unknown as OAuthTokenFetcherPlugin);
		const rerender = () => {
			tab.containerEl.empty();
			const definition = tab.getSettingDefinitions()[0] as unknown as { render: (setting: Setting) => void };
			definition.render(new Setting(tab.containerEl));
		};
		jest.spyOn(tab, "update").mockImplementation(rerender);
		rerender();
		return { plugin, tab };
	}

	const rows = (tab: OAuthTokenFetcherSettingTab) => Array.from(tab.containerEl.querySelectorAll("tbody tr"));
	const cellText = (row: Element, index: number) => row.children[index].textContent;
	const icon = (root: Element, tooltip: string) => root.querySelector(`[title="${tooltip}"]`) as HTMLElement;
	const button = (root: Element, text: string) =>
		Array.from(root.querySelectorAll("button")).find((b) => b.textContent === text) as HTMLButtonElement;
	const modalCall = () => (ConnectionModal as unknown as jest.Mock).mock.calls[0];

	it("renders a header and one summary row per connection", () => {
		const { tab } = render([
			conn({
				name: "Prod",
				tokenUrl: "https://example.com/token",
				targetSecretName: "prod-token",
				refreshIntervalMinutes: 30,
				reloadPluginId: "demo",
			}),
			conn({ name: "" }),
		]);

		expect(Array.from(tab.containerEl.querySelectorAll("th")).map((th) => th.textContent)).toEqual([
			"Name",
			"Token URL",
			"Target secret",
			"Refresh",
			"Reload plugin",
			"",
		]);
		const [first, second] = rows(tab);
		expect(cellText(first, COL.name)).toBe("Prod");
		expect(cellText(first, COL.url)).toBe("https://example.com/token");
		expect(cellText(first, COL.target)).toBe("prod-token");
		expect(cellText(first, COL.refresh)).toBe("30 min");
		expect(cellText(first, COL.reload)).toBe("Demo");
		expect(cellText(second, COL.name)).toBe("Unnamed");
		expect(cellText(second, COL.url)).toBe("Not set");
		expect(cellText(second, COL.reload)).toBe("None");
	});

	it("shows an empty state instead of a table when there are no connections", () => {
		const { tab } = render([]);

		expect(tab.containerEl.querySelector("table")).toBeNull();
		expect(tab.containerEl.textContent).toContain("No connections yet");
	});

	it("opens the form with a new connection and adds it when saved", async () => {
		const { tab, plugin } = render([]);

		button(tab.containerEl, "Add connection").click();
		const [, connection, , heading, onSave] = modalCall();
		expect(heading).toBe("Add connection");

		await onSave(connection);
		await flushMicrotasks();

		expect(plugin.settings.connections).toEqual([connection]);
		expect(plugin.saveSettings).toHaveBeenCalled();
		expect(plugin.rescheduleTokenRefresh).toHaveBeenCalled();
		expect(rows(tab)).toHaveLength(1);
	});

	it("opens the form with a copy of the connection and replaces it when saved", async () => {
		const original = conn({ name: "Old" });
		const { tab, plugin } = render([original, conn({ name: "Other" })]);

		icon(rows(tab)[0], "Edit").click();
		const [, copy, , heading, onSave] = modalCall();
		expect(heading).toBe("Edit connection");
		expect(copy).toEqual(original);
		expect(copy).not.toBe(original);

		await onSave({ ...copy, name: "New" });
		await flushMicrotasks();

		expect(plugin.settings.connections.map((c) => c.name)).toEqual(["New", "Other"]);
		expect(cellText(rows(tab)[0], COL.name)).toBe("New");
	});

	it("deletes only the clicked connection", async () => {
		const [a, b] = [conn({ name: "A" }), conn({ name: "B" })];
		const { tab, plugin } = render([a, b]);

		icon(rows(tab)[0], "Delete").click();
		await flushMicrotasks();

		expect(plugin.settings.connections).toEqual([b]);
		expect(plugin.rescheduleTokenRefresh).toHaveBeenCalled();
		expect(rows(tab)).toHaveLength(1);
	});

	it("fetches the clicked connection, or all connections", () => {
		const [a, b] = [conn(), conn()];
		const { tab, plugin } = render([a, b]);

		icon(rows(tab)[1], "Fetch now").click();
		expect(plugin.fetchTokenNow).toHaveBeenCalledWith(b.id);

		button(tab.containerEl, "Fetch all now").click();
		expect(plugin.fetchAllNow).toHaveBeenCalledTimes(1);
	});

	it("does not duplicate rows or buttons when rendered again on the same row", () => {
		const { plugin } = render([conn({ name: "A" })]);
		const tab = new OAuthTokenFetcherSettingTab({} as any, plugin as unknown as OAuthTokenFetcherPlugin);
		const setting = new Setting(tab.containerEl);
		const definition = tab.getSettingDefinitions()[0] as unknown as { render: (s: Setting) => () => void };

		definition.render(setting);
		definition.render(setting);

		expect(setting.settingEl.querySelectorAll("tbody tr")).toHaveLength(1);
		expect(setting.settingEl.querySelectorAll(".oauth-fetcher-table-wrap")).toHaveLength(1);
		expect(button(setting.settingEl, "Add connection")).toBeDefined();
		expect(setting.controlEl.querySelectorAll("button")).toHaveLength(2);
	});

	it("removes its table when the returned cleanup runs", () => {
		const { plugin } = render([conn()]);
		const tab = new OAuthTokenFetcherSettingTab({} as any, plugin as unknown as OAuthTokenFetcherPlugin);
		const setting = new Setting(tab.containerEl);
		const definition = tab.getSettingDefinitions()[0] as unknown as { render: (s: Setting) => () => void };

		definition.render(setting)();

		expect(setting.settingEl.querySelector(".oauth-fetcher-table-wrap")).toBeNull();
	});

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
});
