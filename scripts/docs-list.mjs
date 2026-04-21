#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const docsListFile = fileURLToPath(import.meta.url);
const docsListDir = dirname(docsListFile);
const DOCS_DIR = join(docsListDir, "..", "docs");

const EXCLUDED_DIRS = new Set(["archive", "research"]);

function compactStrings(values) {
	const result = [];
	for (const value of values) {
		if (value === null || value === undefined) {
			continue;
		}
		const normalized = String(value).trim();
		if (normalized.length > 0) {
			result.push(normalized);
		}
	}
	return result;
}

function walkMarkdownFiles(dir, base = dir) {
	const entries = readdirSync(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		if (entry.name.startsWith(".")) {
			continue;
		}
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (EXCLUDED_DIRS.has(entry.name)) {
				continue;
			}
			files.push(...walkMarkdownFiles(fullPath, base));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			files.push(relative(base, fullPath));
		}
	}
	return files.sort((a, b) => a.localeCompare(b));
}

function parseInlineList(value) {
	if (!(value.startsWith("[") && value.endsWith("]"))) {
		return [];
	}
	try {
		const parsed = JSON.parse(value.replaceAll("'", '"'));
		if (!Array.isArray(parsed)) {
			return [];
		}
		return compactStrings(parsed);
	} catch {
		return [];
	}
}

function normalizeSummary(raw) {
	return raw
		.trim()
		.replace(/^['"]|['"]$/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function extractMetadata(fullPath) {
	const content = readFileSync(fullPath, "utf8");

	if (!content.startsWith("---\n")) {
		return { error: "missing front matter" };
	}

	const endIndex = content.indexOf("\n---\n", 4);
	if (endIndex === -1) {
		return { error: "unterminated front matter" };
	}

	const frontMatter = content.slice(4, endIndex);
	const lines = frontMatter.split("\n");

	let summary = null;
	let sawReadWhen = false;
	let collectingReadWhen = false;
	const readWhen = [];

	for (const rawLine of lines) {
		const line = rawLine.trim();

		if (line.startsWith("summary:")) {
			summary = normalizeSummary(line.slice("summary:".length));
			collectingReadWhen = false;
			continue;
		}

		if (line.startsWith("read_when:")) {
			sawReadWhen = true;
			collectingReadWhen = true;
			const inlineValue = line.slice("read_when:".length).trim();
			if (inlineValue.length > 0) {
				readWhen.push(...parseInlineList(inlineValue));
				collectingReadWhen = false;
			}
			continue;
		}

		if (collectingReadWhen) {
			if (line.startsWith("- ")) {
				const hint = line.slice(2).trim();
				if (hint.length > 0) {
					readWhen.push(hint);
				}
				continue;
			}
			if (line.length === 0) {
				continue;
			}
			collectingReadWhen = false;
		}
	}

	if (!summary || summary.length === 0) {
		return { error: "summary key missing or empty" };
	}

	if (!sawReadWhen) {
		return { error: "read_when key missing" };
	}

	if (readWhen.length === 0) {
		return { error: "read_when must be a non-empty list" };
	}

	return { metadata: { summary, readWhen } };
}

if (!existsSync(DOCS_DIR)) {
	console.error(`Docs folder not found: ${DOCS_DIR}`);
	process.exit(1);
}

console.log("Listing markdown files in docs/ with front-matter metadata:\n");

const markdownFiles = walkMarkdownFiles(DOCS_DIR);
const problems = [];

for (const relativePath of markdownFiles) {
	const fullPath = join(DOCS_DIR, relativePath);
	const { metadata, error } = extractMetadata(fullPath);

	if (!metadata) {
		problems.push(`${relativePath}: ${error ?? "metadata parse failed"}`);
		continue;
	}

	console.log(`${relativePath} - ${metadata.summary}`);
	console.log(`  Read when: ${metadata.readWhen.join("; ")}`);
}

if (problems.length > 0) {
	console.error("\nDocs metadata validation failed:");
	for (const issue of problems) {
		console.error(`- ${issue}`);
	}
	process.exit(1);
}

console.log("\nDocs metadata validation passed.");
