import { App, Modal, Notice, Setting } from "obsidian";
import { DebugLog } from "./DebugLog";

export class DebugLogModal extends Modal {
	constructor(app: App, private readonly log: DebugLog) {
		super(app);
	}

	onOpen() {
		this.setTitle("OAuth debug log");
		const text = this.log.toString() || "No entries yet. Turn on debug mode, then fetch a token.";

		const area = this.contentEl.createEl("textarea", { text });
		area.readOnly = true;
		area.rows = 20;
		area.setCssStyles({ width: "100%", fontFamily: "var(--font-monospace)" });

		new Setting(this.contentEl)
			.addButton((b) =>
				b.setButtonText("Copy").setCta().onClick(async () => {
					await navigator.clipboard.writeText(text);
					new Notice("Debug log copied to clipboard");
				}),
			)
			.addButton((b) =>
				b.setButtonText("Clear").onClick(() => {
					this.log.clear();
					this.close();
				}),
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}
