import { TokenFetcher } from "../src/TokenFetcher";
import { FakeOAuthServer } from "./fakes/FakeOAuthServer";
import { InMemorySecretStore } from "./fakes/InMemorySecretStore";

describe("TokenFetcher", () => {
	let server: FakeOAuthServer;
	let secrets: InMemorySecretStore;

	beforeEach(() => {
		server = new FakeOAuthServer();
		secrets = new InMemorySecretStore();
		secrets.seed("client-secret", "s3cr3t");
	});

	function makeFetcher() {
		return new TokenFetcher(
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
	}

	it("fetches a token and stores it under the target secret name", async () => {
		server.setDefaultResponse({ status: 200, json: { access_token: "abc123" } });
		const fetcher = makeFetcher();

		await fetcher.fetchAndStoreToken();

		expect(secrets.getSecret("my-app-token")).toBe("abc123");
	});

	it("sends a custom grant_type when one is configured", async () => {
		const fetcher = new TokenFetcher(
			{
				tokenUrl: "https://internal.example.com/oauth/token",
				grantType: "urn:custom:grant",
				clientId: "my-client-id",
				clientSecretName: "client-secret",
				targetSecretName: "my-app-token",
			},
			server,
			secrets,
			{ info: () => undefined, error: () => undefined },
		);

		await fetcher.fetchAndStoreToken();

		expect(server.requests[0].body.grant_type).toBe("urn:custom:grant");
	});

	it("includes the scope in the request when one is configured", async () => {
		const fetcher = new TokenFetcher(
			{
				tokenUrl: "https://internal.example.com/oauth/token",
				clientId: "my-client-id",
				clientSecretName: "client-secret",
				targetSecretName: "my-app-token",
				extraParams: { scope: "read write" },
			},
			server,
			secrets,
			{ info: () => undefined, error: () => undefined },
		);

		await fetcher.fetchAndStoreToken();

		expect(server.requests[0].body).toMatchObject({ grant_type: "client_credentials", scope: "read write" });
	});

	it("sends a client_credentials request with the resolved client secret", async () => {
		const fetcher = makeFetcher();

		await fetcher.fetchAndStoreToken();

		expect(server.requests).toHaveLength(1);
		expect(server.requests[0].body).toEqual({
			grant_type: "client_credentials",
			client_id: "my-client-id",
			client_secret: "s3cr3t",
		});
	});

	it("throws when the client secret is not configured", async () => {
		secrets.setSecret("client-secret", "");
		const fetcher = makeFetcher();

		await expect(fetcher.fetchAndStoreToken()).rejects.toThrow(/No secret found/);
	});

	it("throws when the token endpoint returns a non-2xx status", async () => {
		server.setDefaultResponse({ status: 500, json: { error: "server_error" } });
		const fetcher = makeFetcher();

		await expect(fetcher.fetchAndStoreToken()).rejects.toThrow(/HTTP 500/);
	});

	it("throws when the response has no access_token", async () => {
		server.setDefaultResponse({ status: 200, json: { token_type: "Bearer" } });
		const fetcher = makeFetcher();

		await expect(fetcher.fetchAndStoreToken()).rejects.toThrow(/did not contain an access_token/);
	});

	it("does not overwrite the previous token when a refresh fails", async () => {
		const fetcher = makeFetcher();
		await fetcher.fetchAndStoreToken();
		expect(secrets.getSecret("my-app-token")).toBe("fake-access-token");

		server.setDefaultResponse({ status: 401, json: { error: "invalid_client" } });
		await expect(fetcher.fetchAndStoreToken()).rejects.toThrow();

		expect(secrets.getSecret("my-app-token")).toBe("fake-access-token");
	});
});
