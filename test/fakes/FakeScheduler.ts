import { Scheduler } from "../../src/Scheduler";

/** Manually-driven scheduler for tests: call `tick()` instead of waiting on real timers. */
export class FakeScheduler implements Scheduler {
	private callbacks: Array<{ fn: () => void; intervalMs: number; elapsed: number }> = [];

	scheduleRepeating(fn: () => void, intervalMs: number): () => void {
		const entry = { fn, intervalMs, elapsed: 0 };
		this.callbacks.push(entry);
		return () => {
			this.callbacks = this.callbacks.filter((c) => c !== entry);
		};
	}

	/** Advances fake time by `ms`, invoking any callbacks whose interval has elapsed. */
	tick(ms: number): void {
		for (const entry of this.callbacks) {
			entry.elapsed += ms;
			while (entry.elapsed >= entry.intervalMs) {
				entry.elapsed -= entry.intervalMs;
				entry.fn();
			}
		}
	}
}
