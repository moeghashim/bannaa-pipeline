"use client";

import { ANALYSES, INBOX_ITEMS } from "../data";
import { fmtDateTime } from "../format";
import { Icons } from "../icons";
import { Chip, Select, SourceBadge } from "../primitives";
import type { Analysis, InboxItem } from "../types";

const PROVIDERS = [
	{ value: "claude", label: "Claude Sonnet 4.5" },
	{ value: "codex", label: "Codex o4" },
	{ value: "grok", label: "Grok 3.1" },
];

export const AnalysesView = ({ selected, setSelected }: { selected: string; setSelected: (id: string) => void }) => {
	const analyzable = INBOX_ITEMS.filter((i) => i.state !== "new" && i.state !== "rejected");
	const sel = analyzable.find((i) => i.id === selected) || analyzable[0];
	const analysis = ANALYSES.find((a) => a.itemId === sel?.id) || ANALYSES[0];

	return (
		<div className="analyses-view">
			<div className="analyses-rail">
				<div className="inbox-list-head">
					<span className="mono">{analyzable.length} analyses</span>
					<div className="row gap-2">
						<Icons.Clock size={11} style={{ color: "var(--muted)" }} />
						<span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
							3 running
						</span>
					</div>
				</div>

				{analyzable.map((it) => {
					const a = ANALYSES.find((x) => x.itemId === it.id) || ANALYSES[0];
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
								<span className="mono">{a.provider}</span>
								<span className="bullet" />
								<span className="mono">{a.tokens} tok</span>
								<span className="bullet" />
								<span className="mono">{a.cost}</span>
							</div>
						</div>
					);
				})}
			</div>

			{sel && <AnalysisDiff item={sel} analysis={analysis} />}
		</div>
	);
};

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

			<div
				style={{
					background: "var(--surface)",
					border: "1px solid var(--border)",
					borderRadius: "var(--r-md)",
					padding: 12,
					fontFamily: "var(--font-mono)",
					fontSize: 11,
					color: "var(--muted)",
				}}
			>
				<div className="row gap-2" style={{ marginBottom: 8 }}>
					<Icons.Play size={10} />
					<span>Transcript preview · 00:00 / {item.length}</span>
				</div>
				<div style={{ lineHeight: 1.6 }}>
					<span style={{ color: "var(--muted-2)" }}>00:12</span> the interesting claim in the phi line was always
					narrower than it sounded in the title —
					<br />
					<span style={{ color: "var(--muted-2)" }}>00:21</span> textbooks are all you need for what exactly, and
					what does 'textbook' even mean
					<br />
					<span style={{ color: "var(--muted-2)" }}>00:34</span> if you reread the paper two years later the
					synthetic-data recipe is the interesting…
				</div>
			</div>
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
				<span>{analysis.tokens} tokens</span>
				<span className="bullet" />
				<span>{analysis.cost}</span>
				<span className="bullet" />
				<span style={{ color: "var(--accent-ink)" }}>re-run ↻</span>
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
				<span
					className="concept-tag"
					style={{ borderStyle: "dashed", color: "var(--muted)", background: "transparent" }}
				>
					+ suggest
				</span>
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
				{analysis.outputs.map((o) => (
					<div key={o.kind} className="out-card">
						<div className="kind">{o.kind}</div>
						<div style={{ flex: 1, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>{o.hook}</div>
						<button type="button" className="btn xs">
							<Icons.Arrow size={11} /> Promote
						</button>
					</div>
				))}
			</div>
		</div>
	</div>
);
