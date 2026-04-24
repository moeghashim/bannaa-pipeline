"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

const LANGUAGES = [
	{ key: "ar-khaleeji", label: "Khaleeji" },
	{ key: "ar-msa", label: "MSA" },
	{ key: "ar-levantine", label: "Levantine" },
] as const;

export const SettingsOutputLanguagesSection = () => {
	const settings = useQuery(api.settings.doc.get, {});
	const setOutputLanguages = useMutation(api.settings.doc.setOutputLanguages);
	const outputLanguages = settings?.outputLanguages ?? ["ar-khaleeji"];

	return (
		<div className="settings-group">
			<h3>Output languages</h3>
			<p className="sub">Secondary language chips shown on new draft cards.</p>
			<div className="setting-row">
				<div>
					<div className="lbl">Arabic presets</div>
					<div className="hlp">English is always available as the primary copy.</div>
				</div>
				<div className="row gap-3" style={{ flexWrap: "wrap" }}>
					{LANGUAGES.map((lang) => (
						<label key={lang.key} className="row gap-2" style={{ fontSize: 12 }}>
							<input
								type="checkbox"
								checked={outputLanguages.includes(lang.key)}
								onChange={(e) => {
									const next = e.target.checked
										? [...outputLanguages, lang.key]
										: outputLanguages.filter((item) => item !== lang.key);
									void setOutputLanguages({ languages: next });
								}}
								style={{ accentColor: "var(--accent)" }}
							/>
							{lang.label}
						</label>
					))}
				</div>
			</div>
		</div>
	);
};
