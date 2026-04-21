#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const DOCS_DIR = resolve("docs");
const EXCLUDED_DIRS = new Set(["archive", "research"]);

function walk(dir, base = dir, out = []) {
	for (const name of readdirSync(dir)) {
		if (name.startsWith(".")) {
			continue;
		}
		const full = join(dir, name);
		const stats = statSync(full);
		if (stats.isDirectory()) {
			if (!EXCLUDED_DIRS.has(name)) {
				walk(full, base, out);
			}
			continue;
		}
		if (stats.isFile() && name.endsWith(".md")) {
			out.push(relative(base, full));
		}
	}
	return out.sort((a, b) => a.localeCompare(b));
}

function parse(content) {
	if (!content.startsWith("---\n")) {
		return { ok: false, reason: "missing front matter" };
	}

	const end = content.indexOf("\n---\n", 4);
	if (end === -1) {
		return { ok: false, reason: "unterminated front matter" };
	}

	const frontMatter = content.slice(4, end);
	const lines = frontMatter.split("\n");
	let summary = "";
	let sawReadWhen = false;
	const readWhen = [];
	let collecting = false;

	for (const raw of lines) {
		const line = raw.trim();
		if (line.startsWith("summary:")) {
			summary = line
				.slice("summary:".length)
				.trim()
				.replace(/^['"]|['"]$/g, "");
			collecting = false;
			continue;
		}
		if (line.startsWith("read_when:")) {
			sawReadWhen = true;
			collecting = true;
			continue;
		}
		if (collecting) {
			if (line.startsWith("- ")) {
				const item = line.slice(2).trim();
				if (item.length > 0) {
					readWhen.push(item);
				}
				continue;
			}
			if (line.length === 0) {
				continue;
			}
			collecting = false;
		}
	}

	if (summary.length === 0) {
		return { ok: false, reason: "summary missing or empty" };
	}
	if (!sawReadWhen) {
		return { ok: false, reason: "read_when missing" };
	}
	if (readWhen.length === 0) {
		return { ok: false, reason: "read_when must be non-empty" };
	}
	return { ok: true };
}

const failures = [];
for (const relativePath of walk(DOCS_DIR)) {
	const fullPath = join(DOCS_DIR, relativePath);
	const result = parse(readFileSync(fullPath, "utf8"));
	if (!result.ok) {
		failures.push(`${relativePath}: ${result.reason}`);
	}
}

if (failures.length > 0) {
	console.error("docs-frontmatter-check failed:");
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log("docs-frontmatter-check passed.");
