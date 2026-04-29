"use client";

import type { Doc } from "@convex/_generated/dataModel";
import {
	directionFor,
	isRtl,
	LANG_LABELS,
	LANG_NAMES,
	LANGUAGE_CODES,
	type OutputLanguage,
} from "../../_lib/languages";
import { Icons } from "../icons";

// Re-export for callers that still import these names from this file.
export { LANG_LABELS as LANGUAGE_LABELS, type OutputLanguage, directionFor, isRtl, LANG_NAMES, LANGUAGE_CODES };

export const FALLBACK_OUTPUT_LANGUAGES: OutputLanguage[] = ["en"];

export function primaryLangOf(draft: Pick<Doc<"drafts">, "primaryLang">): OutputLanguage {
	const value = draft.primaryLang as OutputLanguage | "ar-khaleeji" | "ar-levantine" | undefined;
	if (!value) return "en";
	if (value === "ar-khaleeji") return "ar-saudi";
	if (value === "ar-levantine") return "ar-msa";
	return value;
}

export const LanguageSwitcher = ({
	draft,
	languages,
	selected,
	onSelect,
	translating,
}: {
	draft: Doc<"drafts">;
	languages: OutputLanguage[];
	selected: OutputLanguage;
	onSelect: (lang: OutputLanguage) => void;
	translating: OutputLanguage | null;
}) => {
	const primary = primaryLangOf(draft);
	const options: OutputLanguage[] = [primary, ...languages.filter((lang) => lang !== primary)];
	return (
		<div className="row gap-1" style={{ flexWrap: "wrap" }}>
			{options.map((lang) => {
				const generated = lang === primary || hasTranslation(draft, lang);
				const busy = translating === lang;
				return (
					<button
						key={lang}
						type="button"
						className={`btn xs${selected === lang ? " accent" : generated ? "" : " ghost"}`}
						onClick={() => void onSelect(lang)}
						disabled={busy}
					>
						{busy ? (
							<>
								<Icons.Clock size={11} /> translating...
							</>
						) : generated ? (
							LANG_LABELS[lang]
						) : (
							`+ ${LANG_LABELS[lang]}`
						)}
					</button>
				);
			})}
		</div>
	);
};

export function textForLanguage(draft: Doc<"drafts">, lang: OutputLanguage): string {
	const primary = primaryLangOf(draft);
	if (lang === primary) return draft.primary;
	const translation = draft.translations?.find((t) => normalizeLegacyLang(t.lang) === lang);
	if (translation) return translation.text;
	return "";
}

export function hasTranslation(draft: Doc<"drafts">, lang: OutputLanguage): boolean {
	const primary = primaryLangOf(draft);
	if (lang === primary) return true;
	if (draft.translations?.some((t) => normalizeLegacyLang(t.lang) === lang)) return true;
	return false;
}

function normalizeLegacyLang(lang: string): OutputLanguage {
	if (lang === "ar-khaleeji") return "ar-saudi";
	if (lang === "ar-levantine") return "ar-msa";
	return lang as OutputLanguage;
}

// All canonical languages except the draft's primary, suitable as translation
// targets in the LanguageSwitcher chip row.
export function translationTargetsForDraft(draft: Pick<Doc<"drafts">, "primaryLang">): OutputLanguage[] {
	const primary = primaryLangOf(draft);
	return LANGUAGE_CODES.filter((c) => c !== primary);
}
