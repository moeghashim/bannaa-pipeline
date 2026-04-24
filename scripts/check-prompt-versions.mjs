#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const changed = execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" })
	.split("\n")
	.map((line) => line.trim())
	.filter(Boolean)
	.filter((file) => file.startsWith("convex/") && /prompts?\.ts$|brandPrompt\.ts$/.test(file));

for (const file of changed) {
	const diff = execFileSync("git", ["diff", "--", file], { encoding: "utf8" });
	if (!diff.trim()) continue;
	const hasVersionLine = /VERSION\s*=/.test(readFileSync(file, "utf8"));
	const versionChanged = /^\+.*VERSION\s*=|^-.*VERSION\s*=/m.test(diff);
	if (hasVersionLine && !versionChanged) {
		const today = new Date().toISOString().slice(0, 10);
		console.warn(`[prompt-version] ${file} changed without a VERSION bump. Suggested: ${today}-a`);
	}
}
