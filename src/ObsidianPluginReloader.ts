import { App, Modal, Setting } from "obsidian";
import { Confirmer, InstalledPlugin, PluginReloader } from "./PluginReloader";

/** Obsidian's undocumented plugin manager; not part of the public typings. */
interface InternalPluginManager {
	manifests: Record<string, { id: string; name: string }>;
	enabledPlugins: Set<string>;
	disablePlugin(id: string): Promise<void>;
	enablePlugin(id: string): Promise<void>;
}

function isPluginManager(value: unknown): value is InternalPluginManager {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.manifests === "object" &&
		candidate.manifests !== null &&
		candidate.enabledPlugins instanceof Set &&
		typeof candidate.disablePlugin === "function" &&
		typeof candidate.enablePlugin === "function"
	);
}

export class ObsidianPluginReloader implements PluginReloader {
	constructor(private readonly app: App, private readonly selfId: string) {}

	private get manager(): InternalPluginManager {
		const plugins = (this.app as unknown as { plugins: unknown }).plugins;
		if (!isPluginManager(plugins)) {
			throw new Error("Obsidian's plugin manager API is unavailable or has changed.");
		}
		return plugins;
	}

	listPlugins(): InstalledPlugin[] {
		const { manifests, enabledPlugins } = this.manager;
		const installed: InstalledPlugin[] = [];
		for (const manifestId of Object.keys(manifests)) {
			const manifest = manifests[manifestId];
			if (manifest && manifest.id !== this.selfId && enabledPlugins.has(manifest.id)) {
				installed.push({ id: manifest.id, name: manifest.name });
			}
		}
		return installed.sort((a, b) => a.name.localeCompare(b.name));
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
