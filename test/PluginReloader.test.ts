import { Confirmer, InstalledPlugin, PluginReloader, reloadAfterRefresh } from "../src/PluginReloader";

const logger = { info: () => undefined, error: jest.fn() };

function makeReloader(plugins: InstalledPlugin[] = [{ id: "demo", name: "Demo" }]) {
	return { listPlugins: () => plugins, reload: jest.fn().mockResolvedValue(undefined) } satisfies PluginReloader;
}

const answer = (value: boolean): Confirmer => ({ confirm: jest.fn().mockResolvedValue(value) });

describe("reloadAfterRefresh", () => {
	it("does nothing when no plugin is configured", async () => {
		const reloader = makeReloader();
		const confirmer = answer(true);

		const result = await reloadAfterRefresh(
			{ reloadPluginId: "", confirmBeforeReload: true },
			reloader,
			confirmer,
			logger,
		);

		expect(result).toBe(false);
		expect(confirmer.confirm).not.toHaveBeenCalled();
		expect(reloader.reload).not.toHaveBeenCalled();
	});

	it("reloads after the user confirms", async () => {
		const reloader = makeReloader();

		const result = await reloadAfterRefresh(
			{ reloadPluginId: "demo", confirmBeforeReload: true },
			reloader,
			answer(true),
			logger,
		);

		expect(result).toBe(true);
		expect(reloader.reload).toHaveBeenCalledWith("demo");
	});

	it("does not reload when the user declines", async () => {
		const reloader = makeReloader();

		const result = await reloadAfterRefresh(
			{ reloadPluginId: "demo", confirmBeforeReload: true },
			reloader,
			answer(false),
			logger,
		);

		expect(result).toBe(false);
		expect(reloader.reload).not.toHaveBeenCalled();
	});

	it("reloads without asking when confirmation is disabled", async () => {
		const reloader = makeReloader();
		const confirmer = answer(false);

		await reloadAfterRefresh({ reloadPluginId: "demo", confirmBeforeReload: false }, reloader, confirmer, logger);

		expect(confirmer.confirm).not.toHaveBeenCalled();
		expect(reloader.reload).toHaveBeenCalledWith("demo");
	});

	it("ignores a configured plugin that is no longer installed/enabled", async () => {
		const reloader = makeReloader([]);

		const result = await reloadAfterRefresh(
			{ reloadPluginId: "demo", confirmBeforeReload: false },
			reloader,
			answer(true),
			logger,
		);

		expect(result).toBe(false);
		expect(reloader.reload).not.toHaveBeenCalled();
	});

	it("logs and returns false when the reload fails", async () => {
		const reloader = makeReloader();
		reloader.reload.mockRejectedValue(new Error("boom"));

		const result = await reloadAfterRefresh(
			{ reloadPluginId: "demo", confirmBeforeReload: false },
			reloader,
			answer(true),
			logger,
		);

		expect(result).toBe(false);
		expect(logger.error).toHaveBeenCalled();
	});
});
