"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { LANGUAGE_GROUPS, type OutputLanguage } from "../../_lib/languages";

export const SettingsPrimaryLanguageSection = () => {
	const settings = useQuery(api.settings.doc.get, {});
	const setDefaultPrimaryLanguage = useMutation(api.settings.doc.setDefaultPrimaryLanguage);
	const current: OutputLanguage = (settings?.defaultPrimaryLanguage as OutputLanguage | undefined) ?? "en";

	return (
		<div className="settings-group">
			<h3>Primary language</h3>
			<p className="sub">
				Drives every generation surface — drafts, carousels, regenerations, brand previews. Existing drafts keep
				their own language; only new generations follow this setting.
			</p>
			<div className="setting-row">
				<div>
					<div className="lbl">Generation language</div>
					<div className="hlp">Pick one. RTL languages render right-to-left in the dashboard.</div>
				</div>
				<select
					value={current}
					onChange={(e) => {
						const next = e.target.value as OutputLanguage;
						if (next !== current) {
							void setDefaultPrimaryLanguage({ language: next });
						}
					}}
					data-testid="primary-language-select"
					style={{
						fontSize: 12.5,
						padding: "6px 10px",
						background: "var(--bg-2)",
						color: "var(--ink)",
						border: "1px solid var(--border)",
						borderRadius: 6,
						minWidth: 240,
					}}
				>
					{LANGUAGE_GROUPS.filter((g) => g.languages.length > 0).map((group) => (
						<optgroup key={group.name} label={group.name}>
							{group.languages.map((l) => (
								<option key={l.code} value={l.code}>
									{l.name}
								</option>
							))}
						</optgroup>
					))}
				</select>
			</div>
		</div>
	);
};
