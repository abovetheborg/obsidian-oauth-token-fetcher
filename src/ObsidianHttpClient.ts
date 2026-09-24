import { requestUrl } from "obsidian";
import { HttpClient, HttpResponse } from "./HttpClient";

/** Production HttpClient backed by Obsidian's `requestUrl` (bypasses CORS restrictions). */
export class ObsidianHttpClient implements HttpClient {
	async postForm(url: string, body: Record<string, string>): Promise<HttpResponse> {
		const response = await requestUrl({
			url,
			method: "POST",
			contentType: "application/x-www-form-urlencoded",
			body: new URLSearchParams(body).toString(),
			throw: false,
		});

		return { status: response.status, json: safeJson(response.text) };
	}
}

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}
