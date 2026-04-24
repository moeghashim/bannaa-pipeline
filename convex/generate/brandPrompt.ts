import type { Doc } from "../_generated/dataModel";
import type { Channel } from "./prompts";

export function renderBrandSystemPrompt(brand: Pick<Doc<"brands">, "name" | "tone">, channel: Channel): string {
	const override = brand.tone.channelOverrides?.[channel];
	const arPreset = brand.tone.arPresets[brand.tone.activeArPreset];
	const doPhrases = brand.tone.doPhrases.length > 0 ? brand.tone.doPhrases.join(", ") : "(none)";
	const dontPhrases = brand.tone.dontPhrases.length > 0 ? brand.tone.dontPhrases.join(", ") : "(none)";

	return [
		`Active brand: ${brand.name}`,
		`Voice persona: ${brand.tone.voicePersona}`,
		`Register: ${brand.tone.register}`,
		`Reading level: ${brand.tone.readingLevel}`,
		`Max sentence length: ${brand.tone.maxSentenceChars} characters`,
		`Emoji policy: ${brand.tone.emojiPolicy}`,
		`Preferred phrases: ${doPhrases}`,
		`Avoid phrases: ${dontPhrases}`,
		override ? `Channel tone override: ${override}` : "Channel tone override: (none)",
		arPreset ? `Arabic voice preset: ${arPreset}` : `Arabic voice preset key: ${brand.tone.activeArPreset}`,
	].join("\n");
}
