"use client";

import type { Doc } from "@convex/_generated/dataModel";
import { Icons } from "../icons";

export type OutputLanguage = "en" | "ar-khaleeji" | "ar-msa" | "ar-levantine";

export const LANGUAGE_LABELS: Record<OutputLanguage, string> = {
	en: "EN",
	"ar-khaleeji": "Arabic",
	"ar-msa": "Arabic MSA",
	"ar-levantine": "Arabic Levantine",
};

export const FALLBACK_OUTPUT_LANGUAGES: OutputLanguage[] = ["ar-khaleeji"];

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
	const options: OutputLanguage[] = ["en", ...languages.filter((lang) => lang !== "en")];
	return (
		<div className="row gap-1" style={{ flexWrap: "wrap" }}>
			{options.map((lang) => {
				const generated = lang === "en" || hasTranslation(draft, lang);
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
							LANGUAGE_LABELS[lang]
						) : (
							`+ ${LANGUAGE_LABELS[lang]}`
						)}
					</button>
				);
			})}
		</div>
	);
};

export function textForLanguage(draft: Doc<"drafts">, lang: OutputLanguage): string {
	if (lang === "en") return draft.primary ?? draft.en;
	const translation = draft.translations?.find((t) => t.lang === lang);
	if (translation) return translation.text;
	if (lang === "ar-khaleeji") return draft.ar;
	return "";
}

export function hasTranslation(draft: Doc<"drafts">, lang: OutputLanguage): boolean {
	if (lang === "en") return true;
	if (draft.translations?.some((t) => t.lang === lang)) return true;
	return lang === "ar-khaleeji" && draft.ar.trim().length > 0;
}
