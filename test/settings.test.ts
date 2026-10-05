import { migrateSettings } from "../src/settings";

describe("migrateSettings", () => {
	it("returns no connections for empty or missing data", () => {
		expect(migrateSettings(null).connections).toEqual([]);
		expect(migrateSettings({}).connections).toEqual([]);
	});

	it("converts the legacy flat settings into one connection", () => {
		const { connections } = migrateSettings({
			tokenUrl: "https://example.com/token",
			clientId: "id",
			clientSecretName: null,
			targetSecretName: "tt-secret",
			refreshIntervalMinutes: 30,
			reloadPluginId: "demo",
			confirmBeforeReload: false,
		});

		expect(connections).toHaveLength(1);
		expect(connections[0]).toMatchObject({
			name: "Default",
			tokenUrl: "https://example.com/token",
			clientId: "id",
			clientSecretName: "",
			targetSecretName: "tt-secret",
			refreshIntervalMinutes: 30,
			reloadPluginId: "demo",
			confirmBeforeReload: false,
		});
		expect(connections[0].id).toBeTruthy();
	});

	it("keeps existing connections and fills in missing fields", () => {
		const { connections } = migrateSettings({ connections: [{ id: "x", name: "A", tokenUrl: "u" }] });

		expect(connections[0]).toMatchObject({ id: "x", name: "A", tokenUrl: "u", refreshIntervalMinutes: 60, confirmBeforeReload: true });
	});
});
