import type { Doc } from "../../_generated/dataModel";
import type { Channel } from "../prompts";

export const IMAGE_PROMPT_VERSION = "2026-04-23-a";

export const VIDEO_CHANNELS: readonly Channel[] = ["ig-reel", "tiktok", "yt-shorts"] as const;

export function isVideoChannel(channel: Channel): boolean {
	return (VIDEO_CHANNELS as readonly string[]).includes(channel);
}

export function aspectHint(channel: Channel): "1:1" | "9:16" {
	return isVideoChannel(channel) ? "9:16" : "1:1";
}

export function buildImagePrompt(input: {
	channel: Channel;
	analysisSummary: string;
	analysisConcepts: string[];
	ar: string;
	en: string;
	track: string;
	brand: Pick<Doc<"brands">, "design">;
}): string {
	const concepts = input.analysisConcepts.slice(0, 4).join(", ");
	const aspect = aspectHint(input.channel);
	const bannedSubjects =
		input.brand.design.bannedSubjects.length > 0
			? input.brand.design.bannedSubjects.join(", ")
			: "(none)";

	// The selected draft copy is the *content* the operator will eventually
	// bake on top of this image. We give the model the EN gloss + concepts
	// as subject hints but explicitly forbid embedded text — the composition
	// must leave negative space for the typography layer.
	return [
		"Produce a clean illustrative background image suitable for overlay.",
		"Do not render any Arabic or English text on the image.",
		`Style guide: ${input.brand.design.imageStyleGuide}`,
		`Palette: primary ${input.brand.design.palette.primary}, accent ${input.brand.design.palette.accent}, neutral ${input.brand.design.palette.neutral}, background ${input.brand.design.palette.background}, text ${input.brand.design.palette.text}.`,
		`Banned subjects: ${bannedSubjects}.`,
		`Aspect ratio: ${aspect} (square for social feed).`,
		"",
		`Track: ${input.track}`,
		`Concepts to reference visually: ${concepts}`,
		"",
		"Creative brief (use for mood + subject, not for literal text rendering):",
		input.en,
		"",
		"Analysis context (subject matter only, do not illustrate any labels):",
		input.analysisSummary,
		"",
		"Hard rules:",
		"- Absolutely no letters, words, glyphs, captions, watermarks, or UI chrome.",
		"- No logos, no brand marks, no fake headlines.",
		"- Prefer abstract geometry, soft textures, architectural negative space,",
		"  or symbolic objects over literal scene illustration.",
		"- Output a single square image at 1024x1024.",
	].join("\n");
}
