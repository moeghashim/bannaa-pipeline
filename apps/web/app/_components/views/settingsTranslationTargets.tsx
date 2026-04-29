"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { LANGUAGE_GROUPS, type OutputLanguage } from "../../_lib/languages";

// Curated subset of languages offered as `+ XX` translation chips on draft
// cards. Default (undefined in settings) = every non-primary language; the
// chip row already filters out the primary, so this section presents all 21
// codes including the primary so the operator can pre-curate before changing
// the primary later. Already-generated translations always remain visible
// regardless of this setting (handled in drafts.tsx via `hasTranslation`).

export const SettingsTranslationTargetsSection = () => {
	const settings = useQuery(api.settings.doc.get, {});
	const setTranslationTargets = useMutation(api.settings.doc.setTranslationTargets);
	// undefined → all languages allowed (preserves pre-curation behaviour)
	const stored = settings?.translationTargets as OutputLanguage[] | undefined;
	const allowAll = stored === undefined;

	const isChecked = (code: OutputLanguage): boolean => allowAll || (stored?.includes(code) ?? false);

	const toggle = (code: OutputLanguage, checked: boolean) => {
		const current: OutputLanguage[] = allowAll
			? LANGUAGE_GROUPS.flatMap((g) => g.languages.map((l) => l.code))
			: [...(stored ?? [])];
		const next = checked ? Array.from(new Set([...current, code])) : current.filter((c) => c !== code);
		void setTranslationTargets({ languages: next });
	};

	const groups = LANGUAGE_GROUPS.filter((g) => g.languages.length > 0);

	return (
		<div className="settings-group">
			<h3>Translation targets</h3>
			<p className="sub">
				Which languages appear as `+ XX` chips on draft cards. Uncheck the ones you never translate into to
				de-clutter the chip row. Already-generated translations stay visible regardless.
			</p>
			<div className="setting-row" style={{ alignItems: "flex-start" }}>
				<div>
					<div className="lbl">Available targets</div>
					<div className="hlp">{allowAll ? "All 21 languages (default)" : `${stored?.length ?? 0} selected`}</div>
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 360 }}>
					{groups.map((group) => (
						<div key={group.name}>
							<div
								className="mono"
								style={{
									fontSize: 10,
									color: "var(--muted-2)",
									textTransform: "uppercase",
									letterSpacing: "0.08em",
									marginBottom: 4,
								}}
							>
								{group.name}
							</div>
							<div className="row gap-3" style={{ flexWrap: "wrap" }}>
								{group.languages.map((lang) => (
									<label key={lang.code} className="row gap-2" style={{ fontSize: 12 }}>
										<input
											type="checkbox"
											checked={isChecked(lang.code)}
											onChange={(e) => toggle(lang.code, e.target.checked)}
											style={{ accentColor: "var(--accent)" }}
										/>
										{lang.label}
									</label>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};
