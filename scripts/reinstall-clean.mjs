#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const removablePaths = ["node_modules"];

for (const workspaceRoot of ["apps", "packages"]) {
	const workspaceRootPath = join(process.cwd(), workspaceRoot);
	if (!existsSync(workspaceRootPath)) {
		continue;
	}
	for (const entry of readdirSync(workspaceRootPath, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}
		removablePaths.push(join(workspaceRoot, entry.name, "node_modules"));
		removablePaths.push(join(workspaceRoot, entry.name, ".next"));
	}
}

for (const relativePath of removablePaths) {
	rmSync(join(process.cwd(), relativePath), { recursive: true, force: true });
}

const install = spawnSync("npm", ["install"], { stdio: "inherit" });
if (install.status !== 0) {
	process.exit(install.status ?? 1);
}
