/**
 * @jest-environment jsdom
 */
import { Notice } from "obsidian";
import { ConnectionModal } from "../src/ConnectionModal";
import { newConnection } from "../src/settings";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Test-only state exposed by test/mocks/obsidian.ts. */
const notices = () => (Notice as unknown as { messages: string[] }).messages;

function open(onSave = jest.fn()) {
	const connection = { ...newConnection(), name: "Prod", tokenUrl: "https://example.com/token" };
	const modal = new ConnectionModal({} as any, connection, [{ id: "demo", name: "Demo" }], "Edit connection", onSave);
	modal.open();
	return { modal, connection, onSave };
}

const el = (modal: ConnectionModal) => modal.contentEl;
const inputs = (modal: ConnectionModal) => Array.from(el(modal).querySelectorAll("input"));
const type = (input: HTMLInputElement, value: string) => {
	input.value = value;
	// Text inputs listen for "input", secret inputs for "change".
	input.dispatchEvent(new Event("input"));
	input.dispatchEvent(new Event("change"));
};
const button = (modal: ConnectionModal, text: string) =>
	Array.from(el(modal).querySelectorAll("button")).find((b) => b.textContent === text) as HTMLButtonElement;

describe("ConnectionModal", () => {
	beforeEach(() => (notices().length = 0));

	it("sets the title and one labelled row per field", () => {
		const { modal } = open();

		expect((modal as unknown as { title: string }).title).toBe("Edit connection");
		const names = Array.from(el(modal).querySelectorAll(".setting-item-name")).map((n) => n.textContent);
		expect(names.filter(Boolean)).toEqual([
			"Name",
			"Token URL",
			"Client ID",
			"Client secret",
			"Target secret",
			"Refresh interval",
			"Plugin to reload",
			"Confirm before reloading",
		]);
	});

	it("saves the edited values and closes", async () => {
		const { modal, connection, onSave } = open();
		const [name, url, clientId, clientSecret, target, interval] = inputs(modal);

		type(name, " Staging ");
		type(url, "https://staging.example.com/token");
		type(clientId, "my-client");
		type(clientSecret, "client-secret");
		type(target, "staging-token");
		type(interval, "15");
		const select = el(modal).querySelector("select") as HTMLSelectElement;
		select.value = "demo";
		select.dispatchEvent(new Event("change"));
		const toggle = el(modal).querySelector('input[type="checkbox"]') as HTMLInputElement;
		toggle.checked = false;
		toggle.dispatchEvent(new Event("change"));

		button(modal, "Save").click();
		await flush();

		expect(onSave).toHaveBeenCalledWith(connection);
		expect(connection).toMatchObject({
			name: "Staging",
			tokenUrl: "https://staging.example.com/token",
			clientId: "my-client",
			clientSecretName: "client-secret",
			targetSecretName: "staging-token",
			refreshIntervalMinutes: 15,
			reloadPluginId: "demo",
			confirmBeforeReload: false,
		});
		expect(el(modal).children).toHaveLength(0);
	});

	it("rejects an invalid refresh interval and stays open", async () => {
		const { modal, onSave } = open();
		const interval = inputs(modal)[5];

		for (const bad of ["abc", "0", "-5"]) {
			type(interval, bad);
			button(modal, "Save").click();
			await flush();
		}

		expect(onSave).not.toHaveBeenCalled();
		expect(notices()).toHaveLength(3);
		expect(el(modal).children.length).toBeGreaterThan(0);
	});

	it("does not save when cancelled", async () => {
		const { modal, onSave } = open();

		button(modal, "Cancel").click();
		await flush();

		expect(onSave).not.toHaveBeenCalled();
		expect(el(modal).children).toHaveLength(0);
	});
});
