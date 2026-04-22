// HyperFrames server-side overlay compositor (Phase 2 · B.4).
//
// Pure function: base PNG + AR copy + channel → composited PNG bytes with AR
// text burned in, matching the React `HyperFrame` preview visual language.
//
// Runs in Convex's V8 runtime (no "use node"):
// - satori (WASM yoga bundled) → SVG string
// - @resvg/resvg-wasm (WASM) → PNG bytes
//
// Fonts are fetched from Google Fonts on first invocation and cached at
// module scope so subsequent calls don't re-fetch. The resvg wasm module is
// fetched from unpkg once and cached the same way.

import { initWasm, Resvg } from "@resvg/resvg-wasm";
import type { ReactNode } from "react";
import satori from "satori";

const CANVAS = 1080;

// Noto Naskh Arabic weight 500 — the brand Arabic face. The @font-face URL
// Google Fonts currently ships for this exact weight; if Google rotates the
// filename the caller will bubble up the fetch error via the action's
// try/catch rather than crash the action silently.
const NOTO_NASKH_AR_URL =
	"https://fonts.gstatic.com/s/notonaskharabic/v34/RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwvc5krK0z9_Mnuw.woff2";

// JetBrains Mono weight 600 — matches the preview's mono chrome lines.
const JETBRAINS_MONO_URL =
	"https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4xD-IQ-PuZJJXxfpAO-Lf1OQk6OThxPA.woff2";

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

async function fetchFontBuffer(url: string, label: string): Promise<ArrayBuffer> {
	const resp = await fetch(url);
	if (!resp.ok) throw new Error(`${label} ${resp.status}: ${await resp.text().catch(() => "")}`);
	return await resp.arrayBuffer();
}

async function loadArabicFont(): Promise<ArrayBuffer> {
	if (cachedAr) return cachedAr;
	cachedAr = await fetchFontBuffer(NOTO_NASKH_AR_URL, "Noto Naskh Arabic font");
	return cachedAr;
}

async function loadMonoFont(): Promise<ArrayBuffer> {
	if (cachedMono) return cachedMono;
	cachedMono = await fetchFontBuffer(JETBRAINS_MONO_URL, "JetBrains Mono font");
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
				fontFamily: "Noto Naskh Arabic",
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
									lang: "ar",
									style: {
										fontFamily: "Noto Naskh Arabic",
										fontSize: 64,
										lineHeight: 1.4,
										fontWeight: 500,
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
			{ name: "Noto Naskh Arabic", data: arBytes, weight: 500, style: "normal", lang: "ar" },
			{ name: "JetBrains Mono", data: monoBytes, weight: 600, style: "normal" },
		],
		embedFont: true,
	});

	const resvg = new Resvg(svg, { fitTo: { mode: "width", value: CANVAS } });
	const rendered = resvg.render();
	return rendered.asPng();
}
