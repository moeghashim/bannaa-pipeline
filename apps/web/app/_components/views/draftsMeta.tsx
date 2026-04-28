import type { Doc } from "@convex/_generated/dataModel";

export type DraftAngle = NonNullable<Doc<"drafts">["angle"]>;

const ANGLE_OPTIONS: { value: DraftAngle; label: string }[] = [
	{ value: "explainer", label: "explainer" },
	{ value: "news", label: "news" },
	{ value: "hot_take", label: "hot take" },
	{ value: "use_case", label: "use case" },
	{ value: "debunk", label: "debunk" },
	{ value: "tutorial", label: "tutorial" },
];

export const DedupBadge = ({ similarity, priorDraftId }: { similarity: number; priorDraftId?: string }) => (
	<span
		className="mono"
		title={priorDraftId ? `Near-duplicate of draft ${priorDraftId.slice(-6)}` : "Near-duplicate of an earlier draft"}
		style={{
			fontSize: 10,
			padding: "2px 6px",
			borderRadius: 4,
			background: "var(--st-rejected-bg, #fde7e7)",
			color: "var(--st-rejected-fg, #b54545)",
			border: "1px solid var(--st-rejected-fg, #b54545)",
			letterSpacing: "0.04em",
		}}
	>
		near-dup · {(similarity * 100).toFixed(0)}%
	</span>
);

export const AnglePicker = ({ angle, onChange }: { angle?: DraftAngle; onChange: (a: DraftAngle) => void }) => (
	<select
		className="mono"
		value={angle ?? ""}
		onChange={(e) => {
			const v = e.target.value;
			if (v) onChange(v as DraftAngle);
		}}
		title="Editorial angle"
		style={{
			fontSize: 10,
			padding: "2px 4px",
			borderRadius: 4,
			border: "1px solid var(--border-faint)",
			background: "var(--surface)",
			color: angle ? "var(--ink)" : "var(--muted-2)",
			cursor: "pointer",
		}}
	>
		{!angle && <option value="">set angle…</option>}
		{ANGLE_OPTIONS.map((o) => (
			<option key={o.value} value={o.value}>
				{o.label}
			</option>
		))}
	</select>
);
