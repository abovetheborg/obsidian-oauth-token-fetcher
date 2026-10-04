import { App, Modal, Setting } from "obsidian";
import { Confirmer, InstalledPlugin, PluginReloader } from "./PluginReloader";

/** Obsidian's undocumented plugin manager; not part of the public typings. */
interface InternalPluginManager {
	manifests: Record<string, { id: string; name: string }>;
	enabledPlugins: Set<string>;
	disablePlugin(id: string): Promise<void>;
	enablePlugin(id: string): Promise<void>;
}

export class ObsidianPluginReloader implements PluginReloader {
	constructor(private readonly app: App, private readonly selfId: string) {}

	private get manager(): InternalPluginManager {
		return (this.app as unknown as { plugins: InternalPluginManager }).plugins;
	}

	listPlugins(): InstalledPlugin[] {
		const { manifests, enabledPlugins } = this.manager;
		return Object.values(manifests)
			.filter((m) => m.id !== this.selfId && enabledPlugins.has(m.id))
			.map((m) => ({ id: m.id, name: m.name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	async reload(pluginId: string): Promise<void> {
		await this.manager.disablePlugin(pluginId);
		await this.manager.enablePlugin(pluginId);
	}
}

export class ModalConfirmer implements Confirmer {
	constructor(private readonly app: App) {}

	confirm(message: string): Promise<boolean> {
		return new Promise((resolve) => new ConfirmModal(this.app, message, resolve).open());
	}
}

class ConfirmModal extends Modal {
	constructor(app: App, private readonly message: string, private readonly resolve: (value: boolean) => void) {
		super(app);
	}

	onOpen() {
		this.contentEl.createEl("p", { text: this.message });
		new Setting(this.contentEl)
			.addButton((b) =>
				b
					.setButtonText("Reload")
					.setCta()
					.onClick(() => {
						this.resolve(true);
						this.close();
					}),
			)
			.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
	}

	// A promise settles once, so this is a no-op after "Reload" was clicked.
	onClose() {
		this.resolve(false);
		this.contentEl.empty();
	}
}
