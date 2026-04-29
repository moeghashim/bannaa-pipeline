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

// Canonical languages offered as translation targets in the LanguageSwitcher
// chip row. The draft's primary is always excluded (it's shown separately as
// the always-available primary chip). Optionally pass `allowed` to curate the
// list down to a user-selected subset (driven by `settings.translationTargets`);
// when undefined, every non-primary canonical language is offered.
//
// Languages that already have a translation on the draft remain visible
// regardless of `allowed` — that's enforced at the LanguageSwitcher level via
// `hasTranslation` so the operator never loses access to existing copy.
export function translationTargetsForDraft(
	draft: Pick<Doc<"drafts">, "primaryLang" | "translations">,
	allowed?: OutputLanguage[] | undefined,
): OutputLanguage[] {
	const primary = primaryLangOf(draft);
	const allowedSet = allowed ? new Set(allowed) : null;
	const existingTranslations = new Set((draft.translations ?? []).map((t) => normalizeLegacyLang(t.lang)));
	return LANGUAGE_CODES.filter((c) => {
		if (c === primary) return false;
		if (allowedSet === null) return true;
		if (allowedSet.has(c)) return true;
		// Always keep already-translated languages visible.
		return existingTranslations.has(c);
	});
}
