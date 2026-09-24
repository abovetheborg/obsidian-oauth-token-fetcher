/**
 * Abstraction over interval scheduling so production code can use Obsidian's
 * `registerInterval`/`window.setInterval` while tests drive time manually.
 */
export interface Scheduler {
	/** Schedules `fn` to run every `intervalMs`. Returns a function that cancels it. */
	scheduleRepeating(fn: () => void, intervalMs: number): () => void;
}

export class WindowScheduler implements Scheduler {
	scheduleRepeating(fn: () => void, intervalMs: number): () => void {
		const handle = window.setInterval(fn, intervalMs);
		return () => window.clearInterval(handle);
	}
}
