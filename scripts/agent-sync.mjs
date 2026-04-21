#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const DEFAULT_MANIFEST_PATH = resolve("agent/manifest.json");
const DIRECTORY_ENTRY_TYPE = "directory";

function usage() {
	console.log("Usage: node scripts/agent-sync.mjs <sync|verify> [--manifest path]");
}

function sha256(content) {
	return createHash("sha256").update(content).digest("hex");
}

function ensureDir(filePath) {
	mkdirSync(dirname(filePath), { recursive: true });
}

function parseGitHubRepo(sourceRepo) {
	const normalized = sourceRepo.replace(/\.git$/, "");
	const match = normalized.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
	if (!match) {
		throw new Error(`Unsupported sourceRepo format: ${sourceRepo}`);
	}
	return { owner: match[1], repo: match[2] };
}

function readManifest(manifestPath) {
	if (!existsSync(manifestPath)) {
		throw new Error(`Manifest missing at ${manifestPath}`);
	}
	const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
	const entries = Array.isArray(parsed.entries) ? parsed.entries : parsed.files;
	if (!parsed.sourceRepo || !parsed.pinnedCommit || !Array.isArray(entries)) {
		throw new Error("Manifest is missing required fields: sourceRepo, pinnedCommit, and entries/files");
	}
	return { ...parsed, entries };
}

async function fetchUpstream({ sourceRepo, pinnedCommit, upstreamPath }) {
	const { owner, repo } = parseGitHubRepo(sourceRepo);
	const url = `https://raw.githubusercontent.com/${owner}/${repo}/${pinnedCommit}/${upstreamPath}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${upstreamPath}: HTTP ${response.status}`);
	}
	return Buffer.from(await response.arrayBuffer());
}

async function fetchGitHubJson(url) {
	const response = await fetch(url, {
		headers: {
			accept: "application/vnd.github+json",
			"user-agent": "bannaa-pipeline-agent-sync",
		},
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
	}
	return await response.json();
}

async function fetchRecursiveTree({ sourceRepo, pinnedCommit }, cache) {
	const cacheKey = `${sourceRepo}#${pinnedCommit}`;
	if (cache.has(cacheKey)) {
		return cache.get(cacheKey);
	}

	const { owner, repo } = parseGitHubRepo(sourceRepo);
	const commit = await fetchGitHubJson(`https://api.github.com/repos/${owner}/${repo}/commits/${pinnedCommit}`);
	const treeSha = commit?.commit?.tree?.sha;
	if (!treeSha) {
		throw new Error(`Could not resolve git tree for ${sourceRepo}@${pinnedCommit}`);
	}

	const tree = await fetchGitHubJson(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);
	const blobs = Array.isArray(tree.tree) ? tree.tree.filter((entry) => entry.type === "blob") : [];
	cache.set(cacheKey, blobs);
	return blobs;
}

async function fetchDirectorySnapshot({ sourceRepo, pinnedCommit, upstreamPath }, treeCache) {
	const prefix = upstreamPath.endsWith("/") ? upstreamPath : `${upstreamPath}/`;
	const blobs = await fetchRecursiveTree({ sourceRepo, pinnedCommit }, treeCache);
	const matching = blobs.filter((entry) => entry.path === upstreamPath || entry.path.startsWith(prefix));
	if (matching.length === 0) {
		throw new Error(`No upstream files found under ${upstreamPath}`);
	}

	const files = [];
	for (const entry of matching) {
		const content = await fetchUpstream({ sourceRepo, pinnedCommit, upstreamPath: entry.path });
		files.push({
			relativePath: entry.path.slice(prefix.length),
			content,
		});
	}

	files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
	return files;
}

function computeDirectoryHash(files) {
	const hash = createHash("sha256");
	for (const file of files) {
		hash.update(file.relativePath);
		hash.update("\0");
		hash.update(sha256(file.content));
		hash.update("\0");
	}
	return hash.digest("hex");
}

function listLocalFiles(rootPath) {
	if (!existsSync(rootPath)) {
		return [];
	}

	const files = [];
	for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
		const fullPath = join(rootPath, entry.name);
		if (entry.isDirectory()) {
			files.push(...listLocalFiles(fullPath));
			continue;
		}
		if (entry.isFile()) {
			files.push(fullPath);
		}
	}
	return files.sort((a, b) => a.localeCompare(b));
}

function removeEmptyDirectories(rootPath) {
	if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
		return;
	}

	for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			removeEmptyDirectories(join(rootPath, entry.name));
		}
	}

	if (readdirSync(rootPath).length === 0) {
		rmSync(rootPath, { recursive: true, force: true });
	}
}

async function syncFileEntry(manifest, entry) {
	const upstreamContent = await fetchUpstream({
		sourceRepo: manifest.sourceRepo,
		pinnedCommit: manifest.pinnedCommit,
		upstreamPath: entry.upstreamPath,
	});
	const expectedHash = sha256(upstreamContent);
	entry.sha256 = expectedHash;

	const localPath = resolve(entry.localPath);
	ensureDir(localPath);

	const previous = existsSync(localPath) ? readFileSync(localPath) : null;
	if (previous !== null && Buffer.compare(previous, upstreamContent) === 0) {
		return [];
	}

	writeFileSync(localPath, upstreamContent);

	if (entry.localPath === "scripts/committer") {
		chmodSync(localPath, 0o755);
	}

	return [entry.localPath];
}

async function syncDirectoryEntry(manifest, entry, treeCache) {
	const files = await fetchDirectorySnapshot(
		{
			sourceRepo: manifest.sourceRepo,
			pinnedCommit: manifest.pinnedCommit,
			upstreamPath: entry.upstreamPath,
		},
		treeCache,
	);
	entry.sha256 = computeDirectoryHash(files);

	const localRoot = resolve(entry.localPath);
	mkdirSync(localRoot, { recursive: true });

	const expectedRelativePaths = new Set(files.map((file) => file.relativePath));
	const changedPaths = [];

	for (const file of files) {
		const destination = join(localRoot, file.relativePath);
		ensureDir(destination);
		const previous = existsSync(destination) ? readFileSync(destination) : null;
		if (previous !== null && Buffer.compare(previous, file.content) === 0) {
			continue;
		}
		writeFileSync(destination, file.content);
		changedPaths.push(relative(process.cwd(), destination));
	}

	for (const existingFile of listLocalFiles(localRoot)) {
		const relativePath = relative(localRoot, existingFile);
		if (expectedRelativePaths.has(relativePath)) {
			continue;
		}
		unlinkSync(existingFile);
		changedPaths.push(relative(process.cwd(), existingFile));
	}

	removeEmptyDirectories(localRoot);

	return changedPaths.sort((a, b) => a.localeCompare(b));
}

async function sync(manifest, manifestPath) {
	let changedFiles = 0;
	const updatedFiles = [];
	const treeCache = new Map();

	for (const entry of manifest.entries) {
		const changedPaths =
			(entry.type ?? "file") === DIRECTORY_ENTRY_TYPE
				? await syncDirectoryEntry(manifest, entry, treeCache)
				: await syncFileEntry(manifest, entry);
		if (changedPaths.length === 0) {
			continue;
		}
		changedFiles += changedPaths.length;
		updatedFiles.push(...changedPaths);
	}

	writeFileSync(
		manifestPath,
		`${JSON.stringify({ ...manifest, entries: undefined, files: manifest.entries }, null, 2)}\n`,
	);

	if (changedFiles === 0) {
		console.log("agent-sync: all managed files already up to date.");
	} else {
		console.log("agent-sync: updated managed files:");
		for (const filePath of updatedFiles) {
			console.log(`- ${filePath}`);
		}
	}

	console.log(`agent-sync: manifest updated at ${manifest.pinnedCommit}.`);
}

async function verify(manifest) {
	const mismatches = [];
	const treeCache = new Map();

	for (const entry of manifest.entries) {
		if ((entry.type ?? "file") === DIRECTORY_ENTRY_TYPE) {
			const upstreamFiles = await fetchDirectorySnapshot(
				{
					sourceRepo: manifest.sourceRepo,
					pinnedCommit: manifest.pinnedCommit,
					upstreamPath: entry.upstreamPath,
				},
				treeCache,
			);
			const upstreamHash = computeDirectoryHash(upstreamFiles);
			if (entry.sha256 !== upstreamHash) {
				mismatches.push(`${entry.localPath}: manifest hash is stale for ${entry.upstreamPath}`);
			}

			const localRoot = resolve(entry.localPath);
			if (!existsSync(localRoot)) {
				mismatches.push(`${entry.localPath}: directory missing`);
				continue;
			}

			const expectedRelativePaths = new Set(upstreamFiles.map((file) => file.relativePath));
			for (const upstreamFile of upstreamFiles) {
				const localPath = join(localRoot, upstreamFile.relativePath);
				if (!existsSync(localPath)) {
					mismatches.push(`${entry.localPath}: missing ${upstreamFile.relativePath}`);
					continue;
				}
				const localHash = sha256(readFileSync(localPath));
				const fileHash = sha256(upstreamFile.content);
				if (localHash !== fileHash) {
					mismatches.push(`${entry.localPath}: drifted at ${upstreamFile.relativePath}`);
				}
			}

			for (const existingFile of listLocalFiles(localRoot)) {
				const relativePath = relative(localRoot, existingFile);
				if (!expectedRelativePaths.has(relativePath)) {
					mismatches.push(`${entry.localPath}: extra local file ${relativePath}`);
				}
			}
			continue;
		}

		const localPath = resolve(entry.localPath);
		if (!existsSync(localPath)) {
			mismatches.push(`${entry.localPath}: file missing`);
			continue;
		}

		const upstreamContent = await fetchUpstream({
			sourceRepo: manifest.sourceRepo,
			pinnedCommit: manifest.pinnedCommit,
			upstreamPath: entry.upstreamPath,
		});
		const upstreamHash = sha256(upstreamContent);
		const localHash = sha256(readFileSync(localPath));

		if (entry.sha256 !== upstreamHash) {
			mismatches.push(`${entry.localPath}: manifest hash is stale for ${entry.upstreamPath}`);
		}

		if (entry.strategy === "verbatim" && localHash !== upstreamHash) {
			mismatches.push(`${entry.localPath}: drifted from upstream ${entry.upstreamPath}`);
		}

		if (entry.strategy === "reference" && localHash !== upstreamHash) {
			mismatches.push(`${entry.localPath}: reference snapshot drifted from upstream ${entry.upstreamPath}`);
		}
	}

	if (mismatches.length > 0) {
		console.error("agent-sync verify failed:");
		for (const mismatch of mismatches) {
			console.error(`- ${mismatch}`);
		}
		process.exit(1);
	}

	console.log("agent-sync verify passed: managed files match pinned upstream commit.");
}

function parseArgs(argv) {
	const mode = argv[2];
	if (mode !== "sync" && mode !== "verify") {
		usage();
		process.exit(1);
	}

	let manifestPath = DEFAULT_MANIFEST_PATH;
	for (let index = 3; index < argv.length; index += 1) {
		if (argv[index] !== "--manifest") {
			throw new Error(`Unknown argument: ${argv[index]}`);
		}
		const providedPath = argv[index + 1];
		if (!providedPath) {
			throw new Error("Expected a path after --manifest");
		}
		manifestPath = resolve(providedPath);
		index += 1;
	}

	return { mode, manifestPath };
}

async function main() {
	const { mode, manifestPath } = parseArgs(process.argv);
	const manifest = readManifest(manifestPath);
	for (const entry of manifest.entries) {
		if (!entry.upstreamPath || !entry.localPath || !entry.strategy) {
			throw new Error("Each manifest file entry must include upstreamPath, localPath, and strategy");
		}
	}

	if (mode === "sync") {
		await sync(manifest, manifestPath);
		return;
	}

	await verify(manifest);
}

main().catch((error) => {
	console.error(`agent-sync failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
