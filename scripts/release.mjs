#!/usr/bin/env node

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VALID_BUMPS = new Set(["patch", "minor", "major"]);

function usage() {
	console.error('Usage: node scripts/release.mjs <patch|minor|major> --learning "<text>" [--publish]');
}

function parseArgs(argv) {
	const bump = argv[0];
	if (!VALID_BUMPS.has(bump)) {
		usage();
		process.exit(1);
	}

	let learning = "";
	let publish = false;
	let index = 1;
	while (index < argv.length) {
		const arg = argv[index];
		if (arg === "--learning") {
			const value = argv[index + 1];
			if (value === undefined || value.trim().length === 0) {
				usage();
				console.error("Release aborted: --learning requires a non-empty value.");
				process.exit(1);
			}
			learning = value.trim();
			index += 2;
			continue;
		}
		if (arg === "--publish") {
			publish = true;
			index += 1;
			continue;
		}

		usage();
		console.error(`Release aborted: unknown argument "${arg}".`);
		process.exit(1);
	}

	if (learning.length === 0) {
		usage();
		console.error("Release aborted: --learning is required.");
		process.exit(1);
	}

	return { bump, learning, publish };
}

const { bump, learning, publish } = parseArgs(process.argv.slice(2));

function run(command) {
	execSync(command, { stdio: "inherit", encoding: "utf8" });
}

function runArgs(command, args) {
	const result = spawnSync(command, args, { stdio: "inherit" });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function publishablePackages() {
	return readdirSync("packages")
		.map((packageName) => join("packages", packageName, "package.json"))
		.filter((path) => existsSync(path))
		.map((path) => JSON.parse(readFileSync(path, "utf8")))
		.filter((pkg) => pkg.private !== true)
		.map((pkg) => pkg.name);
}

function ensureCleanGitTree() {
	const status = execSync("git status --porcelain", { encoding: "utf8" });
	if (status.trim()) {
		console.error("Release aborted: uncommitted changes detected.");
		process.exit(1);
	}
}

function ensureNpmAuth() {
	try {
		execSync("npm whoami", { stdio: "ignore", encoding: "utf8" });
	} catch {
		console.error("Release aborted: --publish requires npm authentication. Run `npm login` first.");
		process.exit(1);
	}
}

function changelogPaths() {
	return readdirSync("packages")
		.map((packageName) => join("packages", packageName, "CHANGELOG.md"))
		.filter((path) => existsSync(path));
}

function readVersion() {
	const corePackage = JSON.parse(readFileSync("packages/core/package.json", "utf8"));
	return corePackage.version;
}

function moveUnreleasedToVersion(version) {
	const date = new Date().toISOString().split("T")[0];
	for (const path of changelogPaths()) {
		const content = readFileSync(path, "utf8");
		if (!content.includes("## [Unreleased]")) {
			continue;
		}
		writeFileSync(path, content.replace("## [Unreleased]", `## [${version}] - ${date}`));
	}
}

function addUnreleasedSection() {
	for (const path of changelogPaths()) {
		const content = readFileSync(path, "utf8");
		if (content.includes("## [Unreleased]")) {
			continue;
		}

		writeFileSync(path, content.replace(/^(# Changelog\n\n)/, "$1## [Unreleased]\n\n"));
	}
}

ensureCleanGitTree();
if (publish) {
	ensureNpmAuth();
}
run(`npm run version:${bump}`);

const version = readVersion();
moveUnreleasedToVersion(version);
runArgs("node", [
	"scripts/progress-log.mjs",
	"append",
	"--trigger",
	"deploy",
	"--learning",
	learning,
	"--bump",
	bump,
	"--version",
	version,
]);

run("git add .");
run(`git commit -m "Release v${version}"`);
run(`git tag v${version}`);

run("npm run build");
run("npm run check");
run("npm test");
if (publish) {
	for (const packageName of publishablePackages()) {
		runArgs("npm", ["publish", "-w", packageName, "--access", "public"]);
	}
} else {
	console.log("Skipping npm publish by default for starter releases. Pass --publish to publish packages.");
}

addUnreleasedSection();
run("git add .");
run('git commit -m "Add [Unreleased] section for next cycle"');
run("git push origin main");
run(`git push origin v${version}`);
