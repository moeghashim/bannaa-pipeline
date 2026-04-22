"use node";

// HyperFrames server-side overlay compositor (Phase 2 · B.4).
//
// Pure function: base PNG + AR copy + channel → composited PNG bytes with AR
// text burned in, matching the React `HyperFrame` preview visual language.
//
// Pinned to the **Node runtime** because satori's yoga dependency reaches
// `import.meta` which Convex V8 doesn't expose. `"use node"` is per-file in
// Convex — the callers (composite.ts + compositeCarouselAction.ts) having it
// isn't enough; this module itself has to declare it too. Don't import this
// file from V8 modules.
//
// - satori → SVG string
// - @resvg/resvg-wasm (WASM) → PNG bytes
//
// Fonts are resolved via the Google Fonts CSS2 endpoint (stable API) on
// first invocation and cached at module scope. Pinning the direct
// fonts.gstatic.com woff2 URL rots: Google rotates the hashed filenames
// periodically and the old URL returns 404 with no fallback. The CSS
// endpoint always returns a current woff2 href. The resvg wasm module is
// fetched from unpkg once and cached the same way.

import { initWasm, Resvg } from "@resvg/resvg-wasm";
import type { ReactNode } from "react";
import satori from "satori";

const CANVAS = 1080;

// Google Fonts returns TTF URLs to unknown user-agents and woff2 to modern
// browsers. satori's opentype parser does NOT decompress woff2 (crashes with
// "Unsupported OpenType signature wOF2") — it needs raw SFNT (TTF/OTF). So we
// deliberately identify as a legacy UA to get a TTF href from the CSS.
const GOOGLE_FONTS_UA =
	"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

// Stable CSS2 endpoints — Google rotates hashed binary URLs inside the CSS
// response but the endpoint signatures themselves don't change.
//
// Arabic face is Cairo (not Noto Naskh Arabic) because satori's bundled
// opentype.js chokes on Noto Naskh Arabic v44 with
// `lookupType: 5 - substFormat: 3 is not yet supported` — that's the modern
// contextual-substitution GSUB lookup used for Arabic shaping. Cairo uses a
// simpler GSUB table that satori parses cleanly, has a Khaleeji-friendly
// modern aesthetic, and keeps RTL + ligature behavior intact for our copy.
const CAIRO_AR_CSS =
	"https://fonts.googleapis.com/css2?family=Cairo:wght@600&display=swap";
const JETBRAINS_MONO_CSS =
	"https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600&display=swap";

// resvg wasm module bytes — pinned to the @resvg/resvg-wasm package version
// installed in package.json. Bumping the package also means bumping this.
const RESVG_WASM_URL = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";

let cachedAr: ArrayBuffer | null = null;
let cachedMono: ArrayBuffer | null = null;
let resvgInitPromise: Promise<void> | null = null;

async function fetchBytes(url: string, label: string): Promise<Uint8Array> {
	const resp = await fetch(url);
	if (!resp.ok) throw new Error(`${label} ${resp.status}: ${await resp.text().catch(() => "")}`);
	const buf = await resp.arrayBuffer();
	return new Uint8Array(buf);
}

async function resolveGoogleFontBuffer(
	cssUrl: string,
	label: string,
	rangeHint: string,
): Promise<ArrayBuffer> {
	const cssResp = await fetch(cssUrl, { headers: { "user-agent": GOOGLE_FONTS_UA } });
	if (!cssResp.ok) {
		throw new Error(
			`${label} CSS ${cssResp.status}: ${await cssResp.text().catch(() => "")}`,
		);
	}
	const css = await cssResp.text();

	// Google's CSS response is a sequence of @font-face blocks, each with a
	// different `unicode-range`. Pick the block whose range covers the code
	// points we actually render — U+0600 for Arabic, U+0000 for Latin — and
	// pull its TTF src (requested via legacy UA since satori can't parse
	// woff2). Fall back to any TTF in the response if the hint doesn't match.
	const blocks = css.split(/@font-face\s*\{/);
	let binaryUrl: string | null = null;
	for (const block of blocks) {
		if (!block.includes("unicode-range")) continue;
		if (!block.includes(rangeHint)) continue;
		const match = block.match(/src:\s*url\((https:[^)]+\.ttf)\)/);
		if (match?.[1]) {
			binaryUrl = match[1];
			break;
		}
	}
	if (!binaryUrl) {
		const fallback = css.match(/url\((https:[^)]+\.ttf)\)/);
		binaryUrl = fallback?.[1] ?? null;
	}
	if (!binaryUrl) throw new Error(`${label} CSS contained no ttf URL`);

	// Google Fonts serves the binary based on UA too — pass the legacy UA so
	// we don't get redirected to a woff2 file that satori can't parse.
	const fontResp = await fetch(binaryUrl, { headers: { "user-agent": GOOGLE_FONTS_UA } });
	if (!fontResp.ok) {
		throw new Error(
			`${label} font ${fontResp.status}: ${await fontResp.text().catch(() => "")}`,
		);
	}
	return await fontResp.arrayBuffer();
}

async function loadArabicFont(): Promise<ArrayBuffer> {
	if (cachedAr) return cachedAr;
	cachedAr = await resolveGoogleFontBuffer(CAIRO_AR_CSS, "Cairo Arabic font", "U+0600");
	return cachedAr;
}

async function loadMonoFont(): Promise<ArrayBuffer> {
	if (cachedMono) return cachedMono;
	cachedMono = await resolveGoogleFontBuffer(JETBRAINS_MONO_CSS, "JetBrains Mono font", "U+0000");
	return cachedMono;
}

async function ensureResvgReady(): Promise<void> {
	if (!resvgInitPromise) {
		resvgInitPromise = (async () => {
			const bytes = await fetchBytes(RESVG_WASM_URL, "resvg-wasm module");
			await initWasm(bytes);
		})();
	}
	await resvgInitPromise;
}

function bytesToBase64(bytes: Uint8Array): string {
	let bin = "";
	// btoa chokes on strings longer than ~1MB in some runtimes, but the base
	// images are well under that (512KB-ish PNG for 1024²), so a single pass
	// via String.fromCharCode.apply would blow the arg limit. Loop manually.
	for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i] ?? 0);
	return btoa(bin);
}

export type CompositeInput = {
	baseImage: Uint8Array;
	ar: string;
	channel: string;
	// handle is accepted but unused for B.4 — reserved for later phases where
	// the composite may render a per-slide attribution.
	handle?: string;
	// B.3 carousel: when both are present, the top-right chip renders
	// `${slideIndex}/${slideTotal}` instead of the static "AR" marker.
	// 1-based. If only one or neither is provided, falls back to "AR".
	slideIndex?: number;
	slideTotal?: number;
};

export async function composite(input: CompositeInput): Promise<Uint8Array> {
	const [arBytes, monoBytes] = await Promise.all([loadArabicFont(), loadMonoFont()]);
	await ensureResvgReady();

	const dataUrl = `data:image/png;base64,${bytesToBase64(input.baseImage)}`;
	const channelLabel = input.channel;
	const langChip =
		typeof input.slideIndex === "number" && typeof input.slideTotal === "number"
			? `${input.slideIndex}/${input.slideTotal}`
			: "AR";

	// Visual language mirrors apps/web/app/_components/primitives.tsx's
	// `HyperFrame` component so the preview and the export look the same.
	const tree = {
		type: "div",
		key: "root",
		props: {
			style: {
				width: CANVAS,
				height: CANVAS,
				position: "relative",
				fontFamily: "Cairo",
				display: "flex",
			},
			children: [
				{
					type: "img",
					key: "bg",
					props: {
						src: dataUrl,
						width: CANVAS,
						height: CANVAS,
						style: {
							position: "absolute",
							top: 0,
							left: 0,
							width: CANVAS,
							height: CANVAS,
							objectFit: "cover",
						},
					},
				},
				{
					type: "div",
					key: "gradient",
					props: {
						style: {
							position: "absolute",
							top: 0,
							left: 0,
							width: CANVAS,
							height: CANVAS,
							display: "flex",
							backgroundImage:
								"linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0) 100%)",
						},
					},
				},
				{
					type: "div",
					key: "top-chrome",
					props: {
						style: {
							position: "absolute",
							top: 32,
							left: 40,
							right: 40,
							display: "flex",
							justifyContent: "space-between",
							fontFamily: "JetBrains Mono",
							fontSize: 20,
							color: "rgba(255,250,240,0.7)",
							letterSpacing: "0.08em",
							textTransform: "uppercase",
						},
						children: [
							{ type: "span", key: "brand", props: { children: `bannaa · ${channelLabel}` } },
							{ type: "span", key: "lang", props: { children: langChip } },
						],
					},
				},
				{
					type: "div",
					key: "ar-wrap",
					props: {
						style: {
							position: "absolute",
							bottom: 120,
							left: 60,
							right: 60,
							display: "flex",
							justifyContent: "flex-end",
						},
						children: [
							{
								type: "div",
								key: "ar-text",
								props: {
									dir: "rtl",
									lang: "ar-AR",
									style: {
										fontFamily: "Cairo",
										fontSize: 64,
										lineHeight: 1.4,
										fontWeight: 600,
										color: "#fff8ec",
										textAlign: "right",
										display: "flex",
									},
									children: input.ar,
								},
							},
						],
					},
				},
				{
					type: "div",
					key: "footer",
					props: {
						style: {
							position: "absolute",
							bottom: 44,
							left: 48,
							display: "flex",
							fontFamily: "JetBrains Mono",
							fontSize: 22,
							letterSpacing: "0.12em",
							color: "rgba(255,250,240,0.75)",
						},
						children: "⎯ bannaa.co",
					},
				},
			],
		},
	};

	const svg = await satori(tree as unknown as ReactNode, {
		width: CANVAS,
		height: CANVAS,
		fonts: [
			{ name: "Cairo", data: arBytes, weight: 600, style: "normal", lang: "ar-AR" },
			{ name: "JetBrains Mono", data: monoBytes, weight: 600, style: "normal" },
		],
		embedFont: true,
	});

	const resvg = new Resvg(svg, { fitTo: { mode: "width", value: CANVAS } });
	const rendered = resvg.render();
	return rendered.asPng();
}
