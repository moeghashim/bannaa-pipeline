#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rootPackageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
const workspacePatterns = Array.isArray(rootPackageJson.workspaces) ? rootPackageJson.workspaces : [];

function resolveWorkspaceDirs() {
	const dirs = [];
	for (const pattern of workspacePatterns) {
		if (!pattern.endsWith("/*")) {
			continue;
		}

		const workspaceRoot = join(process.cwd(), pattern.slice(0, -2));
		if (!existsSync(workspaceRoot)) {
			continue;
		}
		for (const entry of readdirSync(workspaceRoot, { withFileTypes: true })) {
			if (!entry.isDirectory()) {
				continue;
			}
			dirs.push(join(workspaceRoot, entry.name));
		}
	}
	return dirs;
}

const packages = new Map();
const versionMap = new Map();

for (const workspaceDir of resolveWorkspaceDirs()) {
	const packagePath = join(workspaceDir, "package.json");
	const data = JSON.parse(readFileSync(packagePath, "utf8"));
	packages.set(packagePath, { packagePath, data });
	versionMap.set(data.name, data.version);
}

const allVersions = new Set(versionMap.values());
if (allVersions.size > 1) {
	console.error("ERROR: lockstep versioning is enabled but package versions differ.");
	process.exit(1);
}

for (const { packagePath, data } of packages.values()) {
	let updated = false;

	for (const dependencyField of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
		const deps = data[dependencyField];
		if (!deps) {
			continue;
		}

		for (const dependencyName of Object.keys(deps)) {
			const dependencyVersion = versionMap.get(dependencyName);
			if (!dependencyVersion) {
				continue;
			}

			const desiredRange = `^${dependencyVersion}`;
			if (deps[dependencyName] !== desiredRange) {
				deps[dependencyName] = desiredRange;
				updated = true;
			}
		}
	}

	if (updated) {
		writeFileSync(packagePath, `${JSON.stringify(data, null, "\t")}\n`);
	}
}
