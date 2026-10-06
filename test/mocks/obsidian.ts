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

if (!(HTMLElement.prototype as any).addClass) {
	(HTMLElement.prototype as any).addClass = function (this: HTMLElement, ...classes: string[]) {
		this.classList.add(...classes);
	};
}

if (!(HTMLElement.prototype as any).createEl) {
	(HTMLElement.prototype as any).createEl = function (
		this: HTMLElement,
		tag: string,
		options?: { text?: string; cls?: string },
	) {
		const element = this.ownerDocument.createElement(tag);
		if (options?.text) element.textContent = options.text;
		if (options?.cls) element.className = options.cls;
		this.appendChild(element);
		return element;
	};
}
if (!(HTMLElement.prototype as any).createDiv) {
	(HTMLElement.prototype as any).createDiv = function (this: HTMLElement, options?: { cls?: string }) {
		return (this as any).createEl("div", options);
	};
}
if (!(HTMLElement.prototype as any).setCssStyles) {
	(HTMLElement.prototype as any).setCssStyles = function (
		this: HTMLElement,
		styles: Partial<CSSStyleDeclaration>,
	) {
		Object.assign(this.style, styles);
	};
}

export class PluginSettingTab {
	containerEl: HTMLElement;
	constructor(public app: App, public plugin: unknown) {
		this.containerEl = document.createElement("div");
	}
	update() {}
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
	setDestructive() {
		return this;
	}
	setCta() {
		return this;
	}
}

export class ExtraButtonComponent {
	extraSettingsEl: HTMLElement;
	private clickCb: (() => void) | null = null;

	constructor(containerEl: HTMLElement) {
		this.extraSettingsEl = document.createElement("div");
		containerEl.appendChild(this.extraSettingsEl);
		this.extraSettingsEl.addEventListener("click", () => this.clickCb?.());
	}

	setIcon(icon: string) {
		this.extraSettingsEl.dataset.icon = icon;
		return this;
	}
	/** Real Obsidian uses aria-label; `title` is easier to query in tests. */
	setTooltip(tooltip: string) {
		this.extraSettingsEl.title = tooltip;
		return this;
	}
	onClick(cb: () => void) {
		this.clickCb = cb;
		return this;
	}
}

export class Modal {
	contentEl: HTMLElement = document.createElement("div");
	title = "";
	constructor(public app: App) {}
	setTitle(title: string) {
		this.title = title;
		return this;
	}
	open() {
		this.onOpen();
	}
	close() {
		this.onClose();
	}
	onOpen() {}
	onClose() {}
}

export class DropdownComponent {
	selectEl: HTMLSelectElement;

	constructor(containerEl: HTMLElement) {
		this.selectEl = document.createElement("select");
		containerEl.appendChild(this.selectEl);
	}

	addOption(value: string, display: string) {
		const option = document.createElement("option");
		option.value = value;
		option.textContent = display;
		this.selectEl.appendChild(option);
		return this;
	}
	setValue(value: string) {
		this.selectEl.value = value;
		return this;
	}
	onChange(cb: (value: string) => void) {
		this.selectEl.addEventListener("change", () => cb(this.selectEl.value));
		return this;
	}
}

export class ToggleComponent {
	inputEl: HTMLInputElement;

	constructor(containerEl: HTMLElement) {
		this.inputEl = document.createElement("input");
		this.inputEl.type = "checkbox";
		containerEl.appendChild(this.inputEl);
	}

	setValue(value: boolean) {
		this.inputEl.checked = value;
		return this;
	}
	onChange(cb: (value: boolean) => void) {
		this.inputEl.addEventListener("change", () => cb(this.inputEl.checked));
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
	addDropdown(cb: (component: DropdownComponent) => void) {
		cb(new DropdownComponent(this.controlEl));
		return this;
	}
	addToggle(cb: (component: ToggleComponent) => void) {
		cb(new ToggleComponent(this.controlEl));
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
	static messages: string[] = [];
	constructor(public message: string) {
		Notice.messages.push(message);
	}
}

export function requestUrl(): never {
	throw new Error("requestUrl is not available in tests; use the HttpClient fake instead.");
}
