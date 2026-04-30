#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const DEFAULT_EVENTS = ["provider.run.completed", "draft.rated"];
const DEFAULT_WINDOW_MINUTES = 90;
const DEFAULT_HOST = "https://us.posthog.com";

loadLocalEnv();

const personalKey = process.env.POSTHOG_PERSONAL_API_KEY;
const projectId = process.env.POSTHOG_PROJECT_ID ?? "@current";
const host = (process.env.POSTHOG_HOST_WEB ?? process.env.POSTHOG_HOST ?? DEFAULT_HOST)
	.replace("https://us.i.posthog.com", DEFAULT_HOST)
	.replace(/\/$/, "");
const windowMinutes = Number.parseInt(process.env.POSTHOG_VERIFY_WINDOW_MINUTES ?? "", 10) || DEFAULT_WINDOW_MINUTES;
const events = (process.env.POSTHOG_VERIFY_EVENTS ?? DEFAULT_EVENTS.join(","))
	.split(",")
	.map((event) => event.trim())
	.filter(Boolean);

if (!personalKey) {
	console.error("Missing POSTHOG_PERSONAL_API_KEY.");
	console.error("Create a PostHog personal API key with query/read access, then run:");
	console.error("  POSTHOG_PERSONAL_API_KEY=phx_... npm run verify:posthog");
	process.exit(1);
}

if (events.length === 0) {
	console.error("No events to verify. Set POSTHOG_VERIFY_EVENTS or use the defaults.");
	process.exit(1);
}

const eventListSql = events.map((event) => quoteSql(event)).join(", ");
const query = `
SELECT
	event,
	timestamp,
	distinct_id,
	properties.run_id,
	properties.purpose,
	properties.item_id,
	properties.draft_id
FROM events
WHERE event IN (${eventListSql})
	AND timestamp >= now() - INTERVAL ${windowMinutes} MINUTE
	AND distinct_id != 'codex-posthog-probe'
ORDER BY timestamp DESC
LIMIT 50
`;

const response = await queryPostHog(query);

const text = await response.text();
const body = parseJson(text);

if (!response.ok) {
	console.error(`PostHog query failed with HTTP ${response.status}.`);
	const detail = body?.detail ?? body?.error ?? body ?? text.slice(0, 500);
	console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
	console.error(`Host: ${host}`);
	console.error(`Project: ${projectId}`);
	process.exit(1);
}

const rows = Array.isArray(body?.results) ? body.results : [];
const foundEvents = new Set(rows.map((row) => row[0]));
const missing = events.filter((event) => !foundEvents.has(event));

if (missing.length > 0) {
	console.error(`Missing PostHog event(s) in the last ${windowMinutes} minute(s): ${missing.join(", ")}`);
	console.error(`Host: ${host}`);
	console.error(`Project: ${projectId}`);
	await printRecentEvents();
	process.exit(1);
}

console.log(`PostHog verification passed for last ${windowMinutes} minute(s).`);
printRows(rows);

async function queryPostHog(hogql) {
	const endpointProject = projectId === "@current" ? projectId : encodeURIComponent(projectId);
	return await fetch(`${host}/api/projects/${endpointProject}/query/`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${personalKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query: {
				kind: "HogQLQuery",
				query: hogql,
			},
		}),
	});
}

async function printRecentEvents() {
	const recentQuery = `
SELECT
	event,
	count() AS count,
	max(timestamp) AS latest
FROM events
WHERE timestamp >= now() - INTERVAL ${windowMinutes} MINUTE
AND distinct_id != 'codex-posthog-probe'
GROUP BY event
ORDER BY latest DESC
LIMIT 20
`;
	const response = await queryPostHog(recentQuery);
	const text = await response.text();
	const body = parseJson(text);

	if (!response.ok || !Array.isArray(body?.results)) {
		console.error("Could not query recent PostHog events for diagnostics.");
		return;
	}

	if (body.results.length === 0) {
		console.error("No events were found in the selected PostHog project/window.");
		console.error(
			"If the app is sending events, this usually means the personal key is pointed at a different project than the project API key used for capture.",
		);
		return;
	}

	console.error("Recent events found in the selected PostHog project/window:");
	console.error(
		JSON.stringify(
			body.results.map(([event, count, latest]) => ({ event, count, latest })),
			null,
			2,
		),
	);
}

function quoteSql(value) {
	return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function parseJson(value) {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

function printRows(rows) {
	const formatted = rows.map((row) => ({
		event: row[0],
		timestamp: row[1],
		distinctId: row[2],
		providerRunId: row[3] ?? null,
		purpose: row[4] ?? null,
		itemId: row[5] ?? null,
		draftId: row[6] ?? null,
	}));
	console.log(JSON.stringify(formatted, null, 2));
}

function loadLocalEnv() {
	for (const path of [".env.local", "apps/web/.env.local"]) {
		if (!existsSync(path)) continue;
		const lines = readFileSync(path, "utf8").split(/\r?\n/);
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
			if (!match) continue;
			const [, key, rawValue] = match;
			if (process.env[key] !== undefined) continue;
			process.env[key] = unquoteEnvValue(rawValue.trim());
		}
	}
}

function unquoteEnvValue(value) {
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}
	return value;
}
