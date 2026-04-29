"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

const OVERLAY_MODEL_DEFAULT = "gpt-image-2";

function fmtRelative(ms: number | undefined): string {
	if (!ms) return "never";
	const diff = Math.max(0, Date.now() - ms) / 1000;
	if (diff < 60) return `${Math.floor(diff)}s ago`;
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	return `${Math.floor(diff / 86400)}d ago`;
}

// Operator-tunable overlay model. Provider stays gpt-image because that is
// the only edit-capable + Arabic-fluent backend wired in providers.ts today;
// only the model string is operator-tunable so we can roll forward
// (gpt-image-2 → gpt-image-3) without a deploy. Empty / blank input clears
// the override and falls back to the hardcoded default at read-time.
export const SettingsOverlayModelSection = () => {
	const settings = useQuery(api.settings.doc.get, {});
	const setOverlayModel = useMutation(api.settings.doc.setOverlayModel);
	const persisted = settings?.overlayModel ?? "";
	// `draft === null` means "uncommitted, mirror persisted" — that lets the
	// input track the server value without an effect-based sync. Once the
	// user types, draft becomes a string and stays that way until save()
	// runs and resets us back to mirror-mode.
	const [draft, setDraft] = useState<string | null>(null);
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const display = draft ?? persisted;
	const effective = display.trim().length > 0 ? display.trim() : OVERLAY_MODEL_DEFAULT;
	const dirty = draft !== null && draft.trim() !== persisted.trim();

	const save = () => {
		if (draft === null) return;
		void setOverlayModel({ model: draft.trim() }).then(() => {
			setSavedAt(Date.now());
			setDraft(null);
		});
	};

	return (
		<div className="settings-group">
			<h3>Overlay model</h3>
			<p className="sub">
				Model used to bake the caption + brand chrome on top of the base image (the "overlay" view in the drafts
				panel). Provider is fixed at <code>gpt-image</code> because its <code>/v1/images/edits</code> endpoint is
				the only one we trust to render Arabic glyph-for-glyph today. Leave blank to use the default
				<code> {OVERLAY_MODEL_DEFAULT}</code>.
			</p>
			<div className="setting-row">
				<div>
					<div className="lbl">Model</div>
					<div className="hlp">
						e.g. <code>gpt-image-2</code>, <code>gpt-image-1</code>, or any future OpenAI image-edit-capable
						model.
					</div>
				</div>
				<div className="row gap-2" style={{ flexWrap: "wrap" }}>
					<input
						type="text"
						value={display}
						placeholder={OVERLAY_MODEL_DEFAULT}
						onChange={(e) => setDraft(e.target.value)}
						onBlur={() => {
							if (dirty) save();
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" && dirty) save();
						}}
						className="mono"
						style={{
							fontSize: 12,
							padding: "6px 10px",
							border: "1px solid var(--border)",
							borderRadius: 4,
							background: "var(--bg)",
							color: "var(--ink)",
							minWidth: 200,
						}}
					/>
					<span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
						using: {effective}
					</span>
					{dirty && (
						<span className="mono" style={{ fontSize: 10.5, color: "var(--st-pending-fg)" }}>
							unsaved
						</span>
					)}
					{!dirty && savedAt && (
						<span className="mono" style={{ fontSize: 10.5, color: "var(--accent-ink)" }}>
							saved {fmtRelative(savedAt)}
						</span>
					)}
				</div>
			</div>
		</div>
	);
};
