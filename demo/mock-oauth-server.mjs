// Local OAuth2 client_credentials endpoint for manual testing in the test vault.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8080);
const CLIENT_ID = process.env.CLIENT_ID ?? "test-client";
const CLIENT_SECRET = process.env.CLIENT_SECRET ?? "test-secret";

let counter = 0;

createServer((req, res) => {
	if (req.method !== "POST" || req.url !== "/token") {
		res.writeHead(404).end();
		return;
	}

	let raw = "";
	req.on("data", (chunk) => (raw += chunk));
	req.on("end", () => {
		const form = new URLSearchParams(raw);
		const ok =
			form.get("grant_type") === "client_credentials" &&
			form.get("client_id") === CLIENT_ID &&
			form.get("client_secret") === CLIENT_SECRET;

		res.setHeader("Content-Type", "application/json");
		if (!ok) {
			console.log("401 invalid credentials");
			res.writeHead(401).end(JSON.stringify({ error: "invalid_client" }));
			return;
		}

		const token = `mock-token-${++counter}-${Date.now()}`;
		console.log(`200 issued ${token}`);
		res.writeHead(200).end(
			JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: 3600 }),
		);
	});
}).listen(PORT, "127.0.0.1", () => {
	console.log(`Mock token endpoint: http://localhost:${PORT}/token`);
	console.log(`client_id=${CLIENT_ID} client_secret=${CLIENT_SECRET}`);
});
