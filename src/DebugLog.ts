const MAX_ENTRIES = 200;

/** In-memory ring buffer of debug entries; never written to disk. */
export class DebugLog {
	private entries: string[] = [];

	add(message: string): void {
		this.entries.push(`[${new Date().toISOString()}] ${message}`);
		if (this.entries.length > MAX_ENTRIES) this.entries.shift();
	}

	clear(): void {
		this.entries = [];
	}

	toString(): string {
		return this.entries.join("\n\n");
	}
}
