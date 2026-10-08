import { RefreshPlanner } from "../src/RefreshPlanner";
import { Connection, newConnection } from "../src/settings";
import { FakeScheduler } from "./fakes/FakeScheduler";

const MIN = 60 * 1000;

function conn(overrides: Partial<Connection> = {}): Connection {
	return { ...newConnection(), refreshIntervalMinutes: 10, ...overrides };
}

describe("RefreshPlanner", () => {
	let scheduler: FakeScheduler;
	let run: jest.Mock;
	let now: number;
	let planner: RefreshPlanner;

	beforeEach(() => {
		scheduler = new FakeScheduler();
		run = jest.fn();
		now = 1_000_000;
		planner = new RefreshPlanner(scheduler, run, () => now);
	});

	/** Advances both the fake scheduler and the planner's clock. */
	const advance = (ms: number) => {
		now += ms;
		scheduler.tick(ms);
	};

	it("refreshes interval-based connections repeatedly", () => {
		const c = conn();
		planner.rebuild([c]);

		advance(10 * MIN);
		advance(10 * MIN);

		expect(run).toHaveBeenCalledTimes(2);
		expect(run).toHaveBeenCalledWith(c.id);
	});

	it("schedules the next refresh at expires_in for expiry-based connections", () => {
		const c = conn({ refreshOnExpiry: true });
		planner.rebuild([c]);
		planner.afterFetch(c, 120);

		advance(119 * 1000);
		expect(run).not.toHaveBeenCalled();

		advance(1000);
		expect(run).toHaveBeenCalledTimes(1);

		advance(10 * MIN);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("falls back to the refresh interval when expires_in is missing", () => {
		const c = conn({ refreshOnExpiry: true });
		planner.afterFetch(c, null);

		advance(10 * MIN - 1000);
		expect(run).not.toHaveBeenCalled();

		advance(1000);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("never waits less than 30 seconds, even for a tiny expires_in", () => {
		const c = conn({ refreshOnExpiry: true });
		planner.afterFetch(c, 2);

		advance(29 * 1000);
		expect(run).not.toHaveBeenCalled();

		advance(1000);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("retries after the refresh interval when a fetch fails", () => {
		const c = conn({ refreshOnExpiry: true });
		planner.afterFailure(c);

		advance(10 * MIN);

		expect(run).toHaveBeenCalledTimes(1);
	});

	it("ignores fetch results for interval-based connections", () => {
		const c = conn();
		planner.afterFetch(c, 60);
		planner.afterFailure(c);

		advance(60 * 1000);

		expect(run).not.toHaveBeenCalled();
	});

	it("keeps the remaining time of a known expiry when timers are rebuilt", () => {
		const a = conn({ refreshOnExpiry: true });
		const b = conn();
		planner.rebuild([a, b]);
		planner.afterFetch(a, 600);

		advance(300 * 1000);
		planner.rebuild([a, b]);

		advance(299 * 1000);
		expect(run).not.toHaveBeenCalledWith(a.id);

		advance(1000);
		expect(run).toHaveBeenCalledWith(a.id);
	});

	it("stops everything on cancelAll", () => {
		const c = conn({ refreshOnExpiry: true });
		planner.rebuild([c, conn()]);
		planner.afterFetch(c, 60);

		planner.cancelAll();
		advance(60 * MIN);

		expect(run).not.toHaveBeenCalled();
	});
});
