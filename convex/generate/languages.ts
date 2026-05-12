import { v } from "convex/values";

export type OutputLanguage =
	| "en"
	| "ar-msa"
	| "ar-saudi"
	| "ar-egy"
	| "es"
	| "fr"
	| "de"
	| "it"
	| "pt-br"
	| "nl"
	| "ru"
	| "tr"
	| "fa"
	| "ur"
	| "hi"
	| "bn"
	| "id"
	| "ja"
	| "ko"
	| "zh-cn"
	| "zh-tw";

export type LanguageScript = "Latin" | "Arabic" | "Cyrillic" | "Devanagari" | "Bengali" | "CJK" | "Hangul";
export type Direction = "ltr" | "rtl";

export type LanguageDescriptor = {
	code: OutputLanguage;
	label: string;
	name: string;
	script: LanguageScript;
	dir: Direction;
};

export const LANGUAGES: readonly LanguageDescriptor[] = [
	{ code: "en", label: "EN", name: "English", script: "Latin", dir: "ltr" },
	{ code: "ar-msa", label: "AR-Fusha", name: "Arabic — Fusha (MSA)", script: "Arabic", dir: "rtl" },
	{ code: "ar-saudi", label: "AR-Saudi", name: "Arabic — Saudi", script: "Arabic", dir: "rtl" },
	{ code: "ar-egy", label: "AR-Egyptian", name: "Arabic — Egyptian", script: "Arabic", dir: "rtl" },
	{ code: "es", label: "ES", name: "Spanish", script: "Latin", dir: "ltr" },
	{ code: "fr", label: "FR", name: "French", script: "Latin", dir: "ltr" },
	{ code: "de", label: "DE", name: "German", script: "Latin", dir: "ltr" },
	{ code: "it", label: "IT", name: "Italian", script: "Latin", dir: "ltr" },
	{ code: "pt-br", label: "PT-BR", name: "Portuguese (Brazil)", script: "Latin", dir: "ltr" },
	{ code: "nl", label: "NL", name: "Dutch", script: "Latin", dir: "ltr" },
	{ code: "ru", label: "RU", name: "Russian", script: "Cyrillic", dir: "ltr" },
	{ code: "tr", label: "TR", name: "Turkish", script: "Latin", dir: "ltr" },
	{ code: "fa", label: "FA", name: "Persian (Farsi)", script: "Arabic", dir: "rtl" },
	{ code: "ur", label: "UR", name: "Urdu", script: "Arabic", dir: "rtl" },
	{ code: "hi", label: "HI", name: "Hindi", script: "Devanagari", dir: "ltr" },
	{ code: "bn", label: "BN", name: "Bengali", script: "Bengali", dir: "ltr" },
	{ code: "id", label: "ID", name: "Indonesian", script: "Latin", dir: "ltr" },
	{ code: "ja", label: "JA", name: "Japanese", script: "CJK", dir: "ltr" },
	{ code: "ko", label: "KO", name: "Korean", script: "Hangul", dir: "ltr" },
	{ code: "zh-cn", label: "ZH-CN", name: "Chinese (Simplified)", script: "CJK", dir: "ltr" },
	{ code: "zh-tw", label: "ZH-TW", name: "Chinese (Traditional)", script: "CJK", dir: "ltr" },
] as const;

export const LANGUAGE_CODES: readonly OutputLanguage[] = LANGUAGES.map((l) => l.code);

export const LANG_LABELS: Record<OutputLanguage, string> = Object.fromEntries(
	LANGUAGES.map((l) => [l.code, l.label]),
) as Record<OutputLanguage, string>;

export const LANG_NAMES: Record<OutputLanguage, string> = Object.fromEntries(
	LANGUAGES.map((l) => [l.code, l.name]),
) as Record<OutputLanguage, string>;

const LANGUAGE_BY_CODE: Record<OutputLanguage, LanguageDescriptor> = Object.fromEntries(
	LANGUAGES.map((l) => [l.code, l]),
) as Record<OutputLanguage, LanguageDescriptor>;

export function isOutputLanguage(value: string): value is OutputLanguage {
	return value in LANGUAGE_BY_CODE;
}

export function isRtl(lang: OutputLanguage): boolean {
	return LANGUAGE_BY_CODE[lang].dir === "rtl";
}

export function directionFor(lang: OutputLanguage): Direction {
	return LANGUAGE_BY_CODE[lang].dir;
}

export function descriptorFor(lang: OutputLanguage): LanguageDescriptor {
	return LANGUAGE_BY_CODE[lang];
}

export const ARABIC_DIALECTS: readonly OutputLanguage[] = ["ar-msa", "ar-saudi", "ar-egy"] as const;

export function isArabicDialect(lang: OutputLanguage): boolean {
	return (ARABIC_DIALECTS as readonly OutputLanguage[]).includes(lang);
}

export const outputLanguageValidator = v.union(
	v.literal("en"),
	v.literal("ar-msa"),
	v.literal("ar-saudi"),
	v.literal("ar-egy"),
	v.literal("es"),
	v.literal("fr"),
	v.literal("de"),
	v.literal("it"),
	v.literal("pt-br"),
	v.literal("nl"),
	v.literal("ru"),
	v.literal("tr"),
	v.literal("fa"),
	v.literal("ur"),
	v.literal("hi"),
	v.literal("bn"),
	v.literal("id"),
	v.literal("ja"),
	v.literal("ko"),
	v.literal("zh-cn"),
	v.literal("zh-tw"),
);

