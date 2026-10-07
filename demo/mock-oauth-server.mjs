// Local OAuth2 client_credentials endpoint (RFC 6749 section 4.4) for manual testing in the test vault.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8080);
const CLIENT_ID = process.env.CLIENT_ID ?? "test-client";
const CLIENT_SECRET = process.env.CLIENT_SECRET ?? "test-secret";
const SCOPES = (process.env.SCOPES ?? "read write").split(/\s+/).filter(Boolean);
const REQUIRE_SCOPE = process.env.REQUIRE_SCOPE === "1";

let counter = 0;

function send(res, status, body, headers = {}) {
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Cache-Control": "no-store",
		Pragma: "no-cache",
		...headers,
	});
	res.end(JSON.stringify(body));
}

function fail(res, status, error, description, headers) {
	console.log(`${status} ${error}: ${description}`);
	send(res, status, { error, error_description: description }, headers);
}

/** Client credentials from an HTTP Basic header, else from the form body (both allowed by RFC 6749 2.3.1). */
function clientCredentials(req, form) {
	const header = req.headers.authorization ?? "";
	if (header.startsWith("Basic ")) {
		const [id, ...rest] = Buffer.from(header.slice(6), "base64").toString("utf8").split(":");
		return { id: decodeURIComponent(id), secret: decodeURIComponent(rest.join(":")), viaBasic: true };
	}
	return { id: form.get("client_id"), secret: form.get("client_secret"), viaBasic: false };
}

createServer((req, res) => {
	if (req.url !== "/token") return void res.writeHead(404).end();
	if (req.method !== "POST") return fail(res, 405, "invalid_request", "The token endpoint only accepts POST.", { Allow: "POST" });

	let raw = "";
	req.on("data", (chunk) => (raw += chunk));
	req.on("end", () => {
		if (!(req.headers["content-type"] ?? "").startsWith("application/x-www-form-urlencoded")) {
			return fail(res, 400, "invalid_request", "Content-Type must be application/x-www-form-urlencoded.");
		}

		const form = new URLSearchParams(raw);
		const grantType = form.get("grant_type");
		if (!grantType) return fail(res, 400, "invalid_request", "Missing required parameter: grant_type.");

		const creds = clientCredentials(req, form);
		if (creds.id !== CLIENT_ID || creds.secret !== CLIENT_SECRET) {
			const headers = creds.viaBasic ? { "WWW-Authenticate": 'Basic realm="mock-oauth"' } : {};
			return fail(res, 401, "invalid_client", "Client authentication failed.", headers);
		}

		if (grantType !== "client_credentials") {
			return fail(res, 400, "unsupported_grant_type", `Only client_credentials is supported, got "${grantType}".`);
		}

		const requested = (form.get("scope") ?? "").split(/\s+/).filter(Boolean);
		if (REQUIRE_SCOPE && requested.length === 0) {
			return fail(res, 400, "invalid_scope", "The scope parameter is required.");
		}
		const unknown = requested.filter((s) => !SCOPES.includes(s));
		if (unknown.length > 0) {
			return fail(res, 400, "invalid_scope", `Unknown scope: ${unknown.join(" ")}. Allowed: ${SCOPES.join(" ")}.`);
		}

		const granted = requested.length > 0 ? requested : SCOPES;
		const token = `mock-token-${++counter}-${Date.now()}`;
		console.log(`200 issued ${token} (scope: ${granted.join(" ")})`);
		send(res, 200, { access_token: token, token_type: "Bearer", expires_in: 3600, scope: granted.join(" ") });
	});
}).listen(PORT, "127.0.0.1", () => {
	console.log(`Mock token endpoint: http://localhost:${PORT}/token`);
	console.log(`client_id=${CLIENT_ID} client_secret=${CLIENT_SECRET} scopes="${SCOPES.join(" ")}"${REQUIRE_SCOPE ? " (scope required)" : ""}`);
});
