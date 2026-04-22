"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useState } from "react";
import { fmtDateTime } from "../format";
import { Icons } from "../icons";
import { Chip, SourceBadge } from "../primitives";
import type { Analysis, Channel, InboxItem, ProviderId } from "../types";

const PROVIDER_LABEL: Record<ProviderId, string> = {
	claude: "Claude Sonnet 4.6",
	glm: "GLM 5.1",
	openrouter: "OpenRouter",
};

const KIND_TO_CHANNEL: Record<"tweet" | "reel" | "website", Channel | null> = {
	tweet: "x",
	reel: "ig-reel",
	website: null,
};

export const AnalysesView = ({
	selected,
	setSelected,
	items,
	analyses,
	onOpenDrafts,
}: {
	selected: string;
	setSelected: (id: string) => void;
	items: InboxItem[];
	analyses: Analysis[];
	onOpenDrafts?: (channel: string) => void;
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

			{sel &&
				(analysis ? (
					<AnalysisDiff item={sel} analysis={analysis} onOpenDrafts={onOpenDrafts} />
				) : (
					<AnalysisPending item={sel} />
				))}
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

const AnalysisDiff = ({
	item,
	analysis,
	onOpenDrafts,
}: {
	item: InboxItem;
	analysis: Analysis;
	onOpenDrafts?: (channel: string) => void;
}) => (
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
				<span
					className="mono"
					style={{
						fontSize: 11,
						padding: "3px 8px",
						border: "1px solid var(--border)",
						borderRadius: "var(--r-md)",
						background: "var(--surface-2)",
						color: "var(--ink-2)",
					}}
					title="Switch provider in Settings"
				>
					LLM · {PROVIDER_LABEL[analysis.provider]}
				</span>
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
					<PromoteRow
						key={`${o.kind}-${i}`}
						analysisId={analysis.id}
						kind={o.kind}
						hook={o.hook}
						outputIndex={i}
					/>
				))}
			</div>

			<div className="section-h" style={{ marginBottom: 8, marginTop: 22 }}>
				Carousel
			</div>
			<PromoteCarouselRow analysisId={analysis.id} onOpenDrafts={onOpenDrafts} />
		</div>
	</div>
);

const PromoteRow = ({
	analysisId,
	kind,
	hook,
	outputIndex,
}: {
	analysisId: string;
	kind: string;
	hook: string;
	outputIndex: number;
}) => {
	const promote = useAction(api.generate.draft.fromAnalysisOutput);
	const [status, setStatus] = useState<"idle" | "promoting" | "done" | "error">("idle");
	const [message, setMessage] = useState<string | null>(null);

	const channel = kind === "tweet" || kind === "reel" || kind === "website" ? KIND_TO_CHANNEL[kind] : null;

	const onClick = async () => {
		if (!channel) return;
		setStatus("promoting");
		setMessage(null);
		try {
			const res = await promote({
				analysisId: analysisId as Id<"analyses">,
				channel,
				outputIndex,
			});
			if (res.ok) {
				setStatus("done");
				setMessage(`drafted on ${channel}`);
			} else {
				setStatus("error");
				setMessage(res.error);
			}
		} catch (err) {
			setStatus("error");
			setMessage(err instanceof Error ? err.message : String(err));
		}
	};

	return (
		<div className="out-card">
			<div className="kind">{kind}</div>
			<div style={{ flex: 1, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
				{hook}
				{message && (
					<div
						className="mono"
						style={{
							marginTop: 6,
							fontSize: 10.5,
							color: status === "error" ? "var(--st-rejected-fg)" : "var(--accent-ink)",
						}}
					>
						{message}
					</div>
				)}
			</div>
			{channel ? (
				<button
					type="button"
					className="btn xs"
					onClick={onClick}
					disabled={status === "promoting" || status === "done"}
				>
					{status === "promoting" ? (
						<>
							<Icons.Clock size={11} /> promoting…
						</>
					) : status === "done" ? (
						<>
							<Icons.Check size={11} sw={2} /> drafted
						</>
					) : (
						<>
							<Icons.Arrow size={11} /> Promote
						</>
					)}
				</button>
			) : (
				<button type="button" className="btn xs" disabled title="Website proposals come in Phase 3">
					<Icons.Arrow size={11} /> Promote
				</button>
			)}
		</div>
	);
};

const SLIDE_OPTIONS: number[] = [3, 4, 5];

const PromoteCarouselRow = ({
	analysisId,
	onOpenDrafts,
}: {
	analysisId: string;
	onOpenDrafts?: (channel: string) => void;
}) => {
	const promoteCarousel = useAction(api.generate.carousel.fromAnalysis);
	const [slideCount, setSlideCount] = useState<number>(3);
	const [status, setStatus] = useState<"idle" | "promoting" | "done" | "error">("idle");
	const [message, setMessage] = useState<string | null>(null);

	const onClick = async () => {
		setStatus("promoting");
		setMessage(null);
		try {
			const res = await promoteCarousel({
				analysisId: analysisId as Id<"analyses">,
				slideCount,
			});
			if (res.ok) {
				setStatus("done");
				setMessage(`drafted carousel (${res.slideCount} slides)`);
				if (onOpenDrafts) {
					// Give the operator a beat to read the success chip, then
					// hop to the Drafts tab filtered to IG so the new draft is
					// visible.
					setTimeout(() => onOpenDrafts("ig"), 500);
				}
			} else {
				setStatus("error");
				setMessage(res.error);
			}
		} catch (err) {
			setStatus("error");
			setMessage(err instanceof Error ? err.message : String(err));
		}
	};

	return (
		<div className="out-card">
			<div className="kind">carousel</div>
			<div style={{ flex: 1, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
				IG feed carousel with a shared style anchor across slides.
				{message && (
					<div
						className="mono"
						style={{
							marginTop: 6,
							fontSize: 10.5,
							color: status === "error" ? "var(--st-rejected-fg)" : "var(--accent-ink)",
						}}
					>
						{message}
					</div>
				)}
			</div>
			<div role="group" aria-label="Slide count" className="filter-seg" style={{ fontSize: 11, marginRight: 8 }}>
				{SLIDE_OPTIONS.map((n) => (
					<button
						key={n}
						type="button"
						className={slideCount === n ? "active" : ""}
						onClick={() => setSlideCount(n)}
						disabled={status === "promoting" || status === "done"}
					>
						{n}
					</button>
				))}
			</div>
			<button
				type="button"
				className="btn xs"
				onClick={onClick}
				disabled={status === "promoting" || status === "done"}
				title="Promote as IG carousel"
			>
				{status === "promoting" ? (
					<>
						<Icons.Clock size={11} /> promoting…
					</>
				) : status === "done" ? (
					<>
						<Icons.Check size={11} sw={2} /> drafted
					</>
				) : (
					<>
						<Icons.Arrow size={11} /> Promote as IG carousel
					</>
				)}
			</button>
		</div>
	);
};
