"use client";

import { fmtDateTime } from "../format";
import { Icons } from "../icons";
import { Chip, Select, SourceBadge } from "../primitives";
import type { Analysis, InboxItem } from "../types";

const PROVIDERS = [
	{ value: "claude", label: "Claude Sonnet 4.6" },
	{ value: "glm", label: "GLM 5.1" },
	{ value: "openrouter", label: "OpenRouter" },
];

export const AnalysesView = ({
	selected,
	setSelected,
	items,
	analyses,
}: {
	selected: string;
	setSelected: (id: string) => void;
	items: InboxItem[];
	analyses: Analysis[];
}) => {
	const analyzable = items.filter((i) => i.state !== "new" && i.state !== "rejected");
	const sel = analyzable.find((i) => i.id === selected) || analyzable[0];
	const analysis = sel ? (analyses.find((a) => a.itemId === sel.id) ?? null) : null;

	if (analyzable.length === 0) {
		return (
			<div className="analyses-view">
				<div className="analyses-rail">
					<div className="inbox-list-head">
						<span className="mono">0 analyses</span>
					</div>
					<div className="empty-state">
						<div className="icn">
							<Icons.Beaker size={20} />
						</div>
						<h4>No analyses yet</h4>
						<p>Capture something on the Inbox tab and click Analyze to see structured output here.</p>
					</div>
				</div>
				<div />
			</div>
		);
	}

	return (
		<div className="analyses-view">
			<div className="analyses-rail">
				<div className="inbox-list-head">
					<span className="mono">{analyzable.length} analyses</span>
				</div>

				{analyzable.map((it) => {
					const a = analyses.find((x) => x.itemId === it.id);
					return (
						<div
							key={it.id}
							className={`analyses-item${sel && sel.id === it.id ? " selected" : ""}`}
							onClick={() => setSelected(it.id)}
							onKeyDown={(e) => {
								if (e.key === "Enter") setSelected(it.id);
							}}
							role="button"
							tabIndex={0}
						>
							<div className="row gap-2" style={{ marginBottom: 6 }}>
								<SourceBadge source={it.source} compact />
								<span className="bullet" />
								<Chip
									state={it.state === "draft" || it.state === "approved" ? "draft" : "analyzing"}
									label={it.state === "analyzing" ? "analyzing" : "done"}
								/>
							</div>
							<div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35, color: "var(--ink)" }}>
								{it.title}
							</div>
							<div className="row gap-2" style={{ marginTop: 8, fontSize: 10.5, color: "var(--muted)" }}>
								<span className="mono">{a?.provider ?? "—"}</span>
								{a && (
									<>
										<span className="bullet" />
										<span className="mono">{fmtDateTime(a.runAt)}</span>
									</>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{sel && (analysis ? <AnalysisDiff item={sel} analysis={analysis} /> : <AnalysisPending item={sel} />)}
		</div>
	);
};

const AnalysisPending = ({ item }: { item: InboxItem }) => (
	<div className="diff-wrap">
		<div className="diff-pane left">
			<div className="diff-h">
				<div>
					<div className="label">Source · {item.source}</div>
					<div
						style={{
							fontSize: 15,
							fontWeight: 600,
							marginTop: 4,
							textWrap: "balance",
							letterSpacing: "-0.01em",
						}}
					>
						{item.title}
					</div>
				</div>
				<SourceBadge source={item.source} handle={item.handle} />
			</div>
			<div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)" }}>{item.snippet}</div>
		</div>
		<div className="diff-pane right">
			<div className="empty-state">
				<div className="icn">
					<Icons.Clock size={22} />
				</div>
				<h4>Analysis in progress</h4>
				<p>The LLM is extracting structure from this item. It should appear here shortly.</p>
			</div>
		</div>
	</div>
);

const AnalysisDiff = ({ item, analysis }: { item: InboxItem; analysis: Analysis }) => (
	<div className="diff-wrap">
		<div className="diff-pane left">
			<div className="diff-h">
				<div>
					<div className="label">Source · {item.source}</div>
					<div
						style={{
							fontSize: 15,
							fontWeight: 600,
							marginTop: 4,
							textWrap: "balance",
							letterSpacing: "-0.01em",
						}}
					>
						{item.title}
					</div>
				</div>
				<SourceBadge source={item.source} handle={item.handle} />
			</div>

			<div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)", marginBottom: 20 }}>{item.snippet}</div>
		</div>

		<div className="diff-pane right">
			<div className="diff-h">
				<div>
					<div className="label">Extracted</div>
					<div style={{ fontSize: 15, fontWeight: 600, marginTop: 4, letterSpacing: "-0.01em" }}>
						Structured analysis
					</div>
				</div>
				<Select compact label="LLM" value={analysis.provider} onChange={() => {}} options={PROVIDERS} />
			</div>

			<div
				style={{
					fontSize: 11,
					fontFamily: "var(--font-mono)",
					color: "var(--muted)",
					marginBottom: 14,
					display: "flex",
					gap: 12,
				}}
			>
				<span>run {fmtDateTime(analysis.runAt)}</span>
				<span className="bullet" />
				<span>track: {analysis.track}</span>
			</div>

			<div className="section-h" style={{ marginBottom: 6 }}>
				Summary
			</div>
			<div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)", marginBottom: 22 }}>
				{analysis.summary}
			</div>

			<div className="section-h" style={{ marginBottom: 6 }}>
				Concepts matched
			</div>
			<div className="row gap-2" style={{ flexWrap: "wrap", marginBottom: 22 }}>
				{analysis.concepts.map((c) => (
					<span key={c} className="concept-tag">
						{c}
					</span>
				))}
			</div>

			<div className="section-h" style={{ marginBottom: 6 }}>
				Key points
			</div>
			<ul style={{ margin: "0 0 22px", paddingLeft: 18, fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)" }}>
				{analysis.keyPoints.map((k) => (
					<li key={k} style={{ marginBottom: 4 }}>
						{k}
					</li>
				))}
			</ul>

			<div className="section-h" style={{ marginBottom: 8 }}>
				Suggested outputs
			</div>
			<div className="col gap-2">
				{analysis.outputs.map((o, i) => (
					<div key={`${o.kind}-${i}`} className="out-card">
						<div className="kind">{o.kind}</div>
						<div style={{ flex: 1, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>{o.hook}</div>
						<button type="button" className="btn xs" disabled>
							<Icons.Arrow size={11} /> Promote
						</button>
					</div>
				))}
			</div>
		</div>
	</div>
);
