import { Scheduler } from "./Scheduler";
import { Connection } from "./settings";

/** Shortest wait derived from a token's expires_in, to avoid hammering a server that returns tiny values. */
const MIN_EXPIRY_DELAY_MS = 30_000;
/** Largest delay setTimeout accepts; longer waits fire early and simply refresh sooner. */
const MAX_DELAY_MS = 2_147_483_647;

/**
 * Owns the refresh timers. Connections normally refresh on a fixed interval;
 * connections with `refreshOnExpiry` instead wait for the token's `expires_in`
 * (falling back to the interval when the server doesn't send one).
 */
export class RefreshPlanner {
	private cancels = new Map<string, () => void>();
	private expiryAt = new Map<string, number>();

	constructor(
		private readonly scheduler: Scheduler,
		private readonly run: (connectionId: string) => void,
		private readonly now: () => number = Date.now,
	) {}

	/** Rebuilds every timer; keeps the remaining time of already-known expiries. */
	rebuild(connections: Connection[]): void {
		this.cancelAll();
		for (const c of connections) {
			const intervalMs = c.refreshIntervalMinutes * 60 * 1000;
			if (!c.refreshOnExpiry) {
				this.cancels.set(
					c.id,
					this.scheduler.scheduleRepeating(() => this.run(c.id), intervalMs),
				);
				continue;
			}
			const target = this.expiryAt.get(c.id);
			this.armOnce(c.id, target === undefined ? intervalMs : Math.max(0, target - this.now()));
		}
	}

	/** Call after a successful fetch to schedule the next refresh from `expires_in`. */
	afterFetch(c: Connection, expiresInSeconds: number | null): void {
		if (!c.refreshOnExpiry) return;
		if (expiresInSeconds === null) {
			this.expiryAt.delete(c.id);
			this.armOnce(c.id, c.refreshIntervalMinutes * 60 * 1000);
			return;
		}
		const delayMs = Math.max(expiresInSeconds * 1000, MIN_EXPIRY_DELAY_MS);
		this.expiryAt.set(c.id, this.now() + delayMs);
		this.armOnce(c.id, delayMs);
	}

	/** Call after a failed fetch so it is retried after the refresh interval. */
	afterFailure(c: Connection): void {
		if (!c.refreshOnExpiry) return;
		this.expiryAt.delete(c.id);
		this.armOnce(c.id, c.refreshIntervalMinutes * 60 * 1000);
	}

	cancelAll(): void {
		this.cancels.forEach((cancel) => cancel());
		this.cancels.clear();
	}

	private armOnce(id: string, delayMs: number): void {
		this.cancels.get(id)?.();
		this.cancels.set(
			id,
			this.scheduler.scheduleOnce(() => this.run(id), Math.min(delayMs, MAX_DELAY_MS)),
		);
	}
}
