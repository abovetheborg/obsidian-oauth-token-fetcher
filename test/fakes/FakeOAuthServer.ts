import { HttpClient, HttpResponse } from "../../src/HttpClient";

interface QueuedResponse {
	status: number;
	json: unknown;
}

/**
 * Fake HTTP client that simulates an OAuth2 token endpoint entirely in memory.
 * Never touches the network, so tests never burn real API usage/quota.
 */
export class FakeOAuthServer implements HttpClient {
	public readonly requests: Array<{ url: string; body: Record<string, string> }> = [];
	private queuedResponses: QueuedResponse[] = [];
	private defaultResponse: QueuedResponse = {
		status: 200,
		json: { access_token: "fake-access-token", expires_in: 3600 },
	};

	/** Queues a one-off response for the next call; falls back to the default after that. */
	queueResponse(response: QueuedResponse): void {
		this.queuedResponses.push(response);
	}

	setDefaultResponse(response: QueuedResponse): void {
		this.defaultResponse = response;
	}

	async postForm(url: string, body: Record<string, string>): Promise<HttpResponse> {
		this.requests.push({ url, body });
		const next = this.queuedResponses.shift() ?? this.defaultResponse;
		return { status: next.status, json: next.json };
	}
}
