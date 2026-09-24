/**
 * Minimal fake of the `obsidian` module's UI classes, just enough to render
 * SettingsTab.ts in jsdom and simulate real user interaction (typing, clicks)
 * without needing the actual Obsidian desktop app.
 */

// Obsidian patches HTMLElement.prototype with helpers like `.empty()`; replicate that here.
if (!(HTMLElement.prototype as any).empty) {
	(HTMLElement.prototype as any).empty = function (this: HTMLElement) {
		while (this.firstChild) this.removeChild(this.firstChild);
	};
}

export class App {}

export class PluginSettingTab {
	containerEl: HTMLElement;
	constructor(public app: App, public plugin: unknown) {
		this.containerEl = document.createElement("div");
	}
}

export class TextComponent {
	inputEl: HTMLInputElement;
	private changeCb: ((value: string) => void) | null = null;

	constructor(containerEl: HTMLElement) {
		this.inputEl = document.createElement("input");
		containerEl.appendChild(this.inputEl);
		this.inputEl.addEventListener("input", () => this.changeCb?.(this.inputEl.value));
	}

	setPlaceholder(text: string) {
		this.inputEl.placeholder = text;
		return this;
	}
	setValue(value: string) {
		this.inputEl.value = value;
		return this;
	}
	getValue() {
		return this.inputEl.value;
	}
	onChange(cb: (value: string) => void) {
		this.changeCb = cb;
		return this;
	}
}

export class ButtonComponent {
	buttonEl: HTMLButtonElement;
	private clickCb: (() => void) | null = null;

	constructor(containerEl: HTMLElement) {
		this.buttonEl = document.createElement("button");
		containerEl.appendChild(this.buttonEl);
		this.buttonEl.addEventListener("click", () => this.clickCb?.());
	}

	setButtonText(text: string) {
		this.buttonEl.textContent = text;
		return this;
	}
	onClick(cb: () => void) {
		this.clickCb = cb;
		return this;
	}
}

/** Stand-in for the real SecretComponent dropdown; uses a plain input for simplicity. */
export class SecretComponent {
	inputEl: HTMLInputElement;
	private changeCb: ((value: string) => void) | null = null;

	constructor(public app: App, containerEl: HTMLElement) {
		this.inputEl = document.createElement("input");
		this.inputEl.className = "secret-component";
		containerEl.appendChild(this.inputEl);
		this.inputEl.addEventListener("change", () => this.changeCb?.(this.inputEl.value));
	}

	setValue(value: string) {
		this.inputEl.value = value;
		return this;
	}
	getValue() {
		return this.inputEl.value;
	}
	onChange(cb: (value: string) => void) {
		this.changeCb = cb;
		return this;
	}
}

export class Setting {
	settingEl: HTMLElement;
	nameEl: HTMLElement;
	descEl: HTMLElement;
	controlEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.settingEl = document.createElement("div");
		this.settingEl.className = "setting-item";
		this.nameEl = document.createElement("div");
		this.nameEl.className = "setting-item-name";
		this.descEl = document.createElement("div");
		this.descEl.className = "setting-item-description";
		this.controlEl = document.createElement("div");
		this.controlEl.className = "setting-item-control";
		this.settingEl.append(this.nameEl, this.descEl, this.controlEl);
		containerEl.appendChild(this.settingEl);
	}

	setName(name: string) {
		this.nameEl.textContent = name;
		return this;
	}
	setDesc(desc: string) {
		this.descEl.textContent = desc;
		return this;
	}
	addText(cb: (component: TextComponent) => void) {
		cb(new TextComponent(this.controlEl));
		return this;
	}
	addButton(cb: (component: ButtonComponent) => void) {
		cb(new ButtonComponent(this.controlEl));
		return this;
	}
	addComponent<T>(factory: (el: HTMLElement) => T) {
		factory(this.controlEl);
		return this;
	}
}

export class Plugin {
	app: App = new App();
	addCommand() {}
	addSettingTab() {}
	loadData(): Promise<unknown> {
		return Promise.resolve({});
	}
	saveData(): Promise<void> {
		return Promise.resolve();
	}
}

export class Notice {
	constructor(public message: string) {}
}

export function requestUrl(): never {
	throw new Error("requestUrl is not available in tests; use the HttpClient fake instead.");
}
