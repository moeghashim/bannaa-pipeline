#!/usr/bin/env node

import { getEnvironmentReport, printEnvironmentReport } from "./native-deps.mjs";

const report = getEnvironmentReport();

printEnvironmentReport(report);

if (report.issues.length > 0) {
	process.exit(1);
}

console.log("\nEnvironment looks good.");
