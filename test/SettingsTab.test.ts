/**
 * @jest-environment jsdom
 */
import { OAuthTokenFetcherSettingTab } from "../src/SettingsTab";
import { DEFAULT_SETTINGS, OAuthTokenFetcherSettings } from "../src/settings";
import type OAuthTokenFetcherPlugin from "../src/main";

/** Fake plugin: only the surface SettingsTab.ts actually touches. */
function makeFakePlugin() {
	return {
		app: {},
		settings: { ...DEFAULT_SETTINGS } as OAuthTokenFetcherSettings,
		saveSettings: jest.fn().mockResolvedValue(undefined),
		rescheduleTokenRefresh: jest.fn(),
		fetchTokenNow: jest.fn().mockResolvedValue(undefined),
		listReloadablePlugins: jest.fn().mockReturnValue([{ id: "demo", name: "Demo" }]),
	};
}

function setInputValue(input: HTMLInputElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event("input"));
}

function setSecretValue(input: HTMLInputElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event("change"));
}

/** The settings tab's onChange handlers are async (they await saveSettings()); let them settle. */
const flushMicrotasks = () => Promise.resolve().then(() => Promise.resolve());

describe("OAuthTokenFetcherSettingTab", () => {
	function render() {
		const plugin = makeFakePlugin();
		const tab = new OAuthTokenFetcherSettingTab({} as any, plugin as unknown as OAuthTokenFetcherPlugin);
		tab.display();
		return { plugin, tab };
	}

	it("renders one setting row per configuration field plus the fetch-now button", () => {
		const { tab } = render();

		const names = Array.from(tab.containerEl.querySelectorAll(".setting-item-name")).map((el) => el.textContent);

		expect(names).toEqual([
			"Token URL",
			"Client ID",
			"Client secret",
			"Target secret",
			"Refresh interval (minutes)",
			"Plugin to reload",
			"Confirm before reloading",
			"Fetch now",
		]);
	});

	it("saves the chosen plugin to reload and the confirmation toggle", async () => {
		const { tab, plugin } = render();
		const rows = tab.containerEl.querySelectorAll(".setting-item");
		const select = rows[5].querySelector("select") as HTMLSelectElement;
		const toggle = rows[6].querySelector("input") as HTMLInputElement;

		expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "demo"]);

		select.value = "demo";
		select.dispatchEvent(new Event("change"));
		toggle.checked = false;
		toggle.dispatchEvent(new Event("change"));
		await flushMicrotasks();

		expect(plugin.settings.reloadPluginId).toBe("demo");
		expect(plugin.settings.confirmBeforeReload).toBe(false);
	});

	it("updates tokenUrl and saves settings when the user types a new Token URL", async () => {
		const { tab, plugin } = render();
		const rows = tab.containerEl.querySelectorAll(".setting-item");
		const tokenUrlInput = rows[0].querySelector("input") as HTMLInputElement;

		setInputValue(tokenUrlInput, "https://internal.example.com/oauth/token");
		await flushMicrotasks();

		expect(plugin.settings.tokenUrl).toBe("https://internal.example.com/oauth/token");
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	});

	it("updates the client secret name when a secret is selected", async () => {
		const { tab, plugin } = render();
		const rows = tab.containerEl.querySelectorAll(".setting-item");
		const clientSecretInput = rows[2].querySelector("input.secret-component") as HTMLInputElement;

		setSecretValue(clientSecretInput, "my-client-secret");
		await flushMicrotasks();

		expect(plugin.settings.clientSecretName).toBe("my-client-secret");
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	});

	it("only reschedules the refresh timer for valid positive numbers", async () => {
		const { tab, plugin } = render();
		const rows = tab.containerEl.querySelectorAll(".setting-item");
		const intervalInput = rows[4].querySelector("input") as HTMLInputElement;

		setInputValue(intervalInput, "not-a-number");
		await flushMicrotasks();
		expect(plugin.rescheduleTokenRefresh).not.toHaveBeenCalled();

		setInputValue(intervalInput, "30");
		await flushMicrotasks();
		expect(plugin.settings.refreshIntervalMinutes).toBe(30);
		expect(plugin.rescheduleTokenRefresh).toHaveBeenCalledTimes(1);
	});

	it("triggers an immediate fetch when the Fetch now button is clicked", () => {
		const { tab, plugin } = render();
		const rows = tab.containerEl.querySelectorAll(".setting-item");
		const fetchButton = rows[7].querySelector("button") as HTMLButtonElement;

		fetchButton.click();

		expect(plugin.fetchTokenNow).toHaveBeenCalledTimes(1);
	});
});
