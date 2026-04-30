"use client";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { Icons } from "../icons";

const fallbackNotes = (draft: Doc<"drafts">): string =>
	[
		`Channel: ${draft.channel}`,
		"Reusable structure:",
		"- Open with the strongest claim or tension immediately.",
		"- Build one concise explanation around the core idea.",
		"- End with a practical takeaway or question that fits the channel.",
		"",
		"Do not copy the original wording; reuse only the pacing and argument shape.",
	].join("\n");

export const SaveTemplateModal = ({ draft, onClose }: { draft: Doc<"drafts">; onClose: () => void }) => {
	const suggest = useAction(api.postTemplates.promote.suggestFromDraft);
	const create = useMutation(api.postTemplates.mutate.createFromDraft);
	const [name, setName] = useState(`${draft.channel.toUpperCase()} structure`);
	const [structureNotes, setStructureNotes] = useState(fallbackNotes(draft));
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const runSuggest = async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await suggest({ draftId: draft._id });
			if (result.ok) {
				setName(result.name);
				setStructureNotes(result.structureNotes);
			} else {
				setError(result.error);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	};

	const save = async () => {
		setSaving(true);
		setError(null);
		try {
			await create({ draftId: draft._id, name, structureNotes, exampleText: draft.primary });
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Save post template"
			style={{
				position: "absolute",
				right: 10,
				bottom: "calc(100% + 8px)",
				width: 360,
				background: "var(--surface)",
				border: "1px solid var(--border)",
				borderRadius: "var(--r-md)",
				boxShadow: "var(--shadow-md)",
				padding: 12,
				zIndex: 20,
			}}
		>
			<div className="row gap-2" style={{ justifyContent: "space-between", marginBottom: 10 }}>
				<div>
					<div className="section-h">Post template</div>
					<div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
						Save reusable structure for {draft.channel}
					</div>
				</div>
				<button type="button" className="btn ghost xs" onClick={onClose} title="Close">
					<Icons.X size={11} />
				</button>
			</div>
			<label htmlFor="template-name" className="section-h" style={{ display: "block", marginBottom: 4 }}>
				Name
			</label>
			<input
				id="template-name"
				value={name}
				onChange={(event) => setName(event.target.value)}
				style={{
					width: "100%",
					height: 30,
					border: "1px solid var(--border)",
					borderRadius: "var(--r-sm)",
					background: "var(--surface-2)",
					color: "var(--ink)",
					padding: "0 8px",
					marginBottom: 10,
				}}
			/>
			<label htmlFor="template-notes" className="section-h" style={{ display: "block", marginBottom: 4 }}>
				Structure notes
			</label>
			<textarea
				id="template-notes"
				value={structureNotes}
				onChange={(event) => setStructureNotes(event.target.value)}
				rows={9}
				style={{
					width: "100%",
					resize: "vertical",
					border: "1px solid var(--border)",
					borderRadius: "var(--r-sm)",
					background: "var(--surface-2)",
					color: "var(--ink)",
					padding: 8,
					fontSize: 12,
					lineHeight: 1.45,
				}}
			/>
			{error && (
				<div className="mono" style={{ fontSize: 10.5, color: "var(--st-rejected-fg)", marginTop: 8 }}>
					{error}
				</div>
			)}
			<div className="row gap-2" style={{ justifyContent: "flex-end", marginTop: 10 }}>
				<button type="button" className="btn ghost xs" onClick={runSuggest} disabled={loading || saving}>
					{loading ? <Icons.Clock size={11} /> : <Icons.Sparkle size={11} />} Suggest
				</button>
				<button
					type="button"
					className="btn xs"
					onClick={save}
					disabled={saving || !name.trim() || !structureNotes.trim()}
				>
					{saving ? <Icons.Clock size={11} /> : <Icons.Check size={11} sw={2} />} Save
				</button>
			</div>
		</div>
	);
};
