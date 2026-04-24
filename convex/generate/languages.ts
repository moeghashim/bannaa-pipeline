export type OutputLanguage = "en" | "ar-khaleeji" | "ar-msa" | "ar-levantine";

export const LANG_LABELS: Record<OutputLanguage, string> = {
	en: "EN",
	"ar-khaleeji": "AR",
	"ar-msa": "AR",
	"ar-levantine": "AR",
};

export const LANG_NAMES: Record<OutputLanguage, string> = {
	en: "English",
	"ar-khaleeji": "Arabic",
	"ar-msa": "Arabic MSA",
	"ar-levantine": "Arabic Levantine",
};

export function isOutputLanguage(value: string): value is OutputLanguage {
	return value === "en" || value === "ar-khaleeji" || value === "ar-msa" || value === "ar-levantine";
}
