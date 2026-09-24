/**
 * Abstraction over HTTP so production code can use Obsidian's `requestUrl`
 * while tests supply a fake implementation that never hits the network.
 */
export interface HttpClient {
	postForm(url: string, body: Record<string, string>): Promise<HttpResponse>;
}

export interface HttpResponse {
	status: number;
	json: unknown;
}
