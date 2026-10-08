import { Scheduler } from "../../src/Scheduler";

/** Manually-driven scheduler for tests: call `tick()` instead of waiting on real timers. */
export class FakeScheduler implements Scheduler {
	private callbacks: Array<{ fn: () => void; intervalMs: number; elapsed: number; once: boolean }> = [];

	scheduleRepeating(fn: () => void, intervalMs: number): () => void {
		return this.add({ fn, intervalMs, elapsed: 0, once: false });
	}

	scheduleOnce(fn: () => void, delayMs: number): () => void {
		return this.add({ fn, intervalMs: delayMs, elapsed: 0, once: true });
	}

	private add(entry: { fn: () => void; intervalMs: number; elapsed: number; once: boolean }): () => void {
		this.callbacks.push(entry);
		return () => {
			this.callbacks = this.callbacks.filter((c) => c !== entry);
		};
	}

	/** Advances fake time by `ms`, invoking any callbacks whose interval has elapsed. */
	tick(ms: number): void {
		for (const entry of [...this.callbacks]) {
			if (!this.callbacks.includes(entry)) continue;
			entry.elapsed += ms;
			while (entry.elapsed >= entry.intervalMs) {
				entry.elapsed -= entry.intervalMs;
				if (entry.once) {
					this.callbacks = this.callbacks.filter((c) => c !== entry);
					entry.fn();
					break;
				}
				entry.fn();
			}
		}
	}
}
