type Palette = {
	primary: string;
	accent: string;
	neutral: string;
	background: string;
	text: string;
};

type Typography = {
	heading: string;
	body: string;
	mono: string;
};

type BrandDesignDraft = {
	palette: Palette;
	typography: Typography;
	logoChipText: string;
	footerText: string;
	footerUrl: string;
	layout: {
		chipPosition: "top-left" | "top-right";
		footerPosition: "bottom-left" | "bottom-right";
		margins: number;
	};
	imageStyleGuide: string;
	bannedSubjects: string[];
	designMd?: string;
};

type YamlScalar = string | number | boolean;
type YamlValue = YamlScalar | YamlObject;
type YamlObject = { [key: string]: YamlValue };

export type DesignMdImportResult = {
	name?: string;
	design: BrandDesignDraft;
	summary: string[];
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?$/;

function normalizeKey(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isObject(value: YamlValue | undefined): value is YamlObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScalar(value: string): YamlScalar {
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1);
	}
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
	return trimmed;
}

function parseYamlBlock(block: string): YamlObject {
	const root: YamlObject = {};
	const stack: { indent: number; object: YamlObject }[] = [{ indent: -1, object: root }];

	for (const rawLine of block.split("\n")) {
		if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
		const match = rawLine.match(/^(\s*)([$A-Za-z0-9_-]+):(?:\s*(.*))?$/);
		if (!match) continue;

		const indent = match[1].length;
		const key = match[2];
		const rawValue = match[3] ?? "";
		while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
			stack.pop();
		}

		const parent = stack[stack.length - 1].object;
		if (rawValue.trim() === "") {
			const child: YamlObject = {};
			parent[key] = child;
			stack.push({ indent, object: child });
			continue;
		}

		parent[key] = parseScalar(rawValue);
	}

	return root;
}

function splitDesignMd(source: string): { tokens: YamlObject; body: string } {
	if (!source.startsWith("---")) return { tokens: {}, body: source };
	const lines = source.split("\n");
	const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (closingIndex === -1) return { tokens: {}, body: source };
	return {
		tokens: parseYamlBlock(lines.slice(1, closingIndex).join("\n")),
		body: lines.slice(closingIndex + 1).join("\n"),
	};
}

function sectionText(body: string, heading: string): string | undefined {
	const lines = body.split("\n");
	const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading.toLowerCase()}`);
	if (start === -1) return undefined;
	const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
	return lines
		.slice(start + 1, end === -1 ? undefined : end)
		.join("\n")
		.trim();
}

function firstHeading(body: string): string | undefined {
	const match = body.match(/^#\s+(.+)$/m);
	return match?.[1]?.trim();
}

function tokenString(value: YamlValue | undefined): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function scalarString(value: YamlValue | undefined): string | undefined {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
		? String(value)
		: undefined;
}

function readStringMap(value: YamlValue | undefined): Record<string, string> {
	if (!isObject(value)) return {};
	const entries: [string, string][] = [];
	for (const [key, child] of Object.entries(value)) {
		const directValue = scalarString(child);
		const nestedValue = isObject(child) ? (scalarString(child.value) ?? scalarString(child.$value)) : undefined;
		const resolved = directValue ?? nestedValue;
		if (resolved) entries.push([key, resolved]);
	}
	return Object.fromEntries(entries);
}

function readMarkdownColors(body: string): Record<string, string> {
	const entries: [string, string][] = [];
	for (const line of body.split("\n")) {
		const color = line.match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?/)?.[0];
		if (!color) continue;
		const label = line
			.slice(0, line.indexOf(color))
			.replace(/^[-*]\s*/, "")
			.replace(/\*\*/g, "")
			.replace(/[:(]/g, "")
			.trim();
		if (label) entries.push([label, color]);
	}
	return Object.fromEntries(entries);
}

function pick(map: Record<string, string>, aliases: string[]): string | undefined {
	const normalized = new Map(Object.entries(map).map(([key, value]) => [normalizeKey(key), value]));
	for (const alias of aliases) {
		const value = normalized.get(normalizeKey(alias));
		if (value) return value;
	}
	return undefined;
}

function validColor(value: string | undefined): string | undefined {
	return value && HEX_COLOR_PATTERN.test(value) ? value : undefined;
}

function formatTypography(value: YamlValue | undefined): string | undefined {
	if (typeof value === "string") return value;
	if (!isObject(value)) return undefined;
	const fontFamily = scalarString(value.fontFamily);
	const fontSize = scalarString(value.fontSize);
	const fontWeight = scalarString(value.fontWeight);
	const lineHeight = scalarString(value.lineHeight);
	const parts = [fontFamily, fontSize, fontWeight, lineHeight].filter((part): part is string => Boolean(part));
	return parts.length > 0 ? parts.join(" ") : undefined;
}

function readMarkdownTypography(body: string): Record<string, string> {
	const typography = sectionText(body, "Typography") ?? "";
	const entries: [string, string][] = [];
	for (const line of typography.split("\n")) {
		const match = line
			.replace(/^[-*]\s*/, "")
			.replace(/\*\*/g, "")
			.match(/^([^:]+):\s*(.+)$/);
		if (match) entries.push([match[1].trim(), match[2].trim()]);
	}
	return Object.fromEntries(entries);
}

function pickTypography(tokens: YamlObject, body: string, current: Typography): Typography {
	const tokenTypography = isObject(tokens.typography) ? tokens.typography : {};
	const markdownTypography = readMarkdownTypography(body);
	const findToken = (aliases: string[]) => {
		for (const [key, value] of Object.entries(tokenTypography)) {
			if (aliases.includes(normalizeKey(key))) return formatTypography(value);
		}
		return undefined;
	};
	return {
		heading:
			findToken(["h1", "heading", "headline", "headlines", "display", "title"]) ??
			pick(markdownTypography, ["headline", "headlines", "heading", "h1"]) ??
			current.heading,
		body:
			findToken(["body", "bodymd", "paragraph", "default"]) ??
			pick(markdownTypography, ["body", "paragraph"]) ??
			current.body,
		mono:
			findToken(["mono", "monospace", "code", "labelcaps"]) ??
			pick(markdownTypography, ["mono", "monospace", "code"]) ??
			current.mono,
	};
}

function readSpacingMargin(tokens: YamlObject, current: number): number {
	const spacing = readStringMap(tokens.spacing);
	const value = pick(spacing, ["xl", "lg", "large", "md", "medium"]);
	const match = value?.match(/^(\d+(?:\.\d+)?)px$/);
	if (!match) return current;
	return Math.max(16, Math.min(96, Math.round(Number(match[1]))));
}

function compactBody(body: string): string {
	return body
		.replace(/\n{3,}/g, "\n\n")
		.trim()
		.slice(0, 6000);
}

export function parseDesignMd(source: string, current: BrandDesignDraft): DesignMdImportResult {
	const { tokens, body } = splitDesignMd(source.trim());
	const colors = { ...readStringMap(tokens.colors), ...readMarkdownColors(body) };
	const name = tokenString(tokens.name) ?? firstHeading(body);
	const importedPrimary = validColor(pick(colors, ["primary", "brand primary", "brand-primary"]));
	const importedNeutral = validColor(pick(colors, ["neutral", "surface", "surface variant"]));
	const palette: Palette = {
		primary: importedPrimary ?? current.palette.primary,
		accent:
			validColor(pick(colors, ["accent", "tertiary", "secondary", "brand accent", "brand-accent"])) ??
			current.palette.accent,
		neutral: importedNeutral ?? current.palette.neutral,
		background:
			validColor(pick(colors, ["background", "neutral surface", "surface", "page background"])) ??
			importedNeutral ??
			current.palette.background,
		text:
			validColor(pick(colors, ["text", "text primary", "ink", "foreground", "on surface", "on-surface"])) ??
			importedPrimary ??
			current.palette.text,
	};
	const typography = pickTypography(tokens, body, current.typography);
	const tokenSummary = [
		`Palette: primary ${palette.primary}, accent ${palette.accent}, neutral ${palette.neutral}, background ${palette.background}, text ${palette.text}.`,
		`Typography: heading ${typography.heading}, body ${typography.body}, mono ${typography.mono}.`,
	];
	const prose = compactBody(body);

	return {
		name,
		design: {
			...current,
			palette,
			typography,
			layout: { ...current.layout, margins: readSpacingMargin(tokens, current.layout.margins) },
			imageStyleGuide: [`Imported DESIGN.md${name ? ` for ${name}` : ""}.`, ...tokenSummary, prose]
				.filter(Boolean)
				.join("\n\n"),
			designMd: source.trim(),
		},
		summary: [
			`colors ${Object.keys(colors).length}`,
			`typography ${Object.keys(isObject(tokens.typography) ? tokens.typography : {}).length}`,
			name ? `name ${name}` : "name unchanged",
		],
	};
}
