import { DebugLog } from "../src/DebugLog";
import { HttpClient, HttpResponse } from "../src/HttpClient";
import { LoggingHttpClient } from "../src/LoggingHttpClient";

const form = { grant_type: "client_credentials", client_id: "id", client_secret: "s3cr3t" };

function stub(response: HttpResponse | Error): HttpClient {
	return {
		postForm: async () => {
			if (response instanceof Error) throw response;
			return response;
		},
	};
}

describe("LoggingHttpClient", () => {
	it("logs the full request and response, including the client secret and token", async () => {
		const log = new DebugLog();
		const client = new LoggingHttpClient(
			stub({
				status: 200,
				json: null,
				text: JSON.stringify({ access_token: "abcdef123456", expires_in: 3600 }),
				headers: { "content-type": "application/json" },
			}),
			log,
		);

		await client.postForm("https://example.com/token", form);

		const output = log.toString();
		expect(output).toContain("REQUEST POST https://example.com/token");
		expect(output).toContain('"client_id": "id"');
		expect(output).toContain("RESPONSE 200");
		expect(output).toContain("content-type");
		expect(output).toContain("expires_in");
		expect(output).toContain("s3cr3t");
		expect(output).toContain("abcdef123456");
	});

	it("shows the error body of a 401 so the cause is visible", async () => {
		const log = new DebugLog();
		const client = new LoggingHttpClient(
			stub({
				status: 401,
				json: null,
				text: '{"error":"invalid_client","error_description":"Client authentication failed"}',
				headers: { "www-authenticate": 'Basic realm="oauth"' },
			}),
			log,
		);

		await client.postForm("https://example.com/token", form);

		expect(log.toString()).toContain("RESPONSE 401");
		expect(log.toString()).toContain("Client authentication failed");
		expect(log.toString()).toContain("www-authenticate");
	});

	it("falls back to the parsed JSON when no raw text is available", async () => {
		const log = new DebugLog();
		const client = new LoggingHttpClient(stub({ status: 400, json: { error: "bad_request" } }), log);

		await client.postForm("https://example.com/token", form);

		expect(log.toString()).toContain("bad_request");
	});

	it("logs and rethrows network errors", async () => {
		const log = new DebugLog();
		const client = new LoggingHttpClient(stub(new Error("net::ERR_CONNECTION_REFUSED")), log);

		await expect(client.postForm("https://example.com/token", form)).rejects.toThrow("ERR_CONNECTION_REFUSED");
		expect(log.toString()).toContain("NETWORK ERROR net::ERR_CONNECTION_REFUSED");
	});
});

describe("DebugLog", () => {
	it("keeps only the most recent entries and can be cleared", () => {
		const log = new DebugLog();
		for (let i = 0; i < 250; i++) log.add(`entry-${i}`);

		expect(log.toString()).not.toContain("entry-0");
		expect(log.toString()).toContain("entry-249");

		log.clear();
		expect(log.toString()).toBe("");
	});
});
