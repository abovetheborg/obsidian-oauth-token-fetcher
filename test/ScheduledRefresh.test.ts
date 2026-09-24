import { TokenFetcher } from "../src/TokenFetcher";
import { FakeOAuthServer } from "./fakes/FakeOAuthServer";
import { FakeScheduler } from "./fakes/FakeScheduler";
import { InMemorySecretStore } from "./fakes/InMemorySecretStore";

/** Lets pending microtasks (e.g. the async fetchAndStoreToken call) settle. */
const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe("Scheduled token refresh", () => {
	it("refreshes the token once per interval using a fake clock (no real timers, no network)", async () => {
		const server = new FakeOAuthServer();
		const secrets = new InMemorySecretStore();
		secrets.seed("client-secret", "s3cr3t");
		const scheduler = new FakeScheduler();

		const fetcher = new TokenFetcher(
			{
				tokenUrl: "https://internal.example.com/oauth/token",
				clientId: "my-client-id",
				clientSecretName: "client-secret",
				targetSecretName: "my-app-token",
			},
			server,
			secrets,
			{ info: () => undefined, error: () => undefined },
		);

		const intervalMs = 60 * 60 * 1000;
		scheduler.scheduleRepeating(() => void fetcher.fetchAndStoreToken(), intervalMs);

		expect(server.requests).toHaveLength(0);

		scheduler.tick(intervalMs);
		await flushMicrotasks();
		expect(server.requests).toHaveLength(1);

		scheduler.tick(intervalMs * 2);
		await flushMicrotasks();
		expect(server.requests).toHaveLength(3);
	});

	it("stops refreshing once cancelled", () => {
		const scheduler = new FakeScheduler();
		let calls = 0;
		const cancel = scheduler.scheduleRepeating(() => calls++, 1000);

		scheduler.tick(1000);
		expect(calls).toBe(1);

		cancel();
		scheduler.tick(5000);
		expect(calls).toBe(1);
	});
});
