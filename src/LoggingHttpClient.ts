import { HttpClient, HttpResponse } from "./HttpClient";
import { DebugLog } from "./DebugLog";

/** Records every request and response in full (including secrets) to a DebugLog, then passes the call through. */
export class LoggingHttpClient implements HttpClient {
	constructor(private readonly inner: HttpClient, private readonly log: DebugLog) {}

	async postForm(url: string, body: Record<string, string>): Promise<HttpResponse> {
		this.log.add(
			`REQUEST POST ${url}\nContent-Type: application/x-www-form-urlencoded\nForm fields: ${JSON.stringify(body, null, 2)}`,
		);

		let response: HttpResponse;
		try {
			response = await this.inner.postForm(url, body);
		} catch (error) {
			this.log.add(`NETWORK ERROR ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}

		const text = response.text ?? JSON.stringify(response.json);
		this.log.add(`RESPONSE ${response.status}\nHeaders: ${JSON.stringify(response.headers ?? {}, null, 2)}\nBody: ${text}`);
		return response;
	}
}
