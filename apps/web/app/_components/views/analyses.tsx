"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useState } from "react";
import { fmtDateTime } from "../format";
import { Icons } from "../icons";
import { Chip, SourceBadge } from "../primitives";
import type { Analysis, InboxItem, ProviderId } from "../types";
import { PromoteCarouselRow, PromoteRow } from "./analysesPromoteRows";

const PROVIDER_LABEL: Record<ProviderId, string> = {
	claude: "Claude Sonnet 4.6",
	glm: "GLM 5.1",
	openrouter: "OpenRouter",
	deepseek: "DeepSeek V4 Pro",
};

export const AnalysesView = ({
	selected,
	setSelected,
	items,
	analyses,
	onOpenDrafts,
	onDelete,
}: {
	selected: string;
	setSelected: (id: string) => void;
	items: InboxItem[];
	analyses: Analysis[];
	onOpenDrafts?: (channel: string) => void;
	onDelete?: (id: string) => void | Promise<void>;
}) => {
	const analyzable = items.filter((i) => i.state !== "new" && i.state !== "rejected");
	const sel = analyzable.find((i) => i.id === selected) || analyzable[0];
	const analysis = sel ? (analyses.find((a) => a.itemId === sel.id) ?? null) : null;
	const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

	const handleDelete = async (id: string) => {
		if (!onDelete) return;
		setDeleteErrors((prev) => {
			if (!(id in prev)) return prev;
			const { [id]: _omit, ...rest } = prev;
			return rest;
		});
		try {
			await onDelete(id);
		} catch (err) {
			const raw = err instanceof Error ? err.message : String(err);
			const cleaned = raw.match(/Uncaught Error:\s*(.+?)(?:\s+at\s|$)/)?.[1]?.trim() ?? raw;
			setDeleteErrors((prev) => ({ ...prev, [id]: cleaned }));
		}
	};

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
					const deleteError = deleteErrors[it.id];
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
							style={{ position: "relative" }}
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
							{onDelete && (
								<button
									type="button"
									className="btn ghost xs"
									title="Remove this item — cannot be undone, and it will not be re-analyzed"
									onClick={(e) => {
										e.stopPropagation();
										void handleDelete(it.id);
									}}
									style={{ position: "absolute", top: 8, right: 8 }}
								>
									<Icons.X size={11} /> remove
								</button>
							)}
							{deleteError && (
								<div
									role="alert"
									style={{
										marginTop: 8,
										padding: "6px 8px",
										fontSize: 11.5,
										lineHeight: 1.4,
										color: "var(--st-rejected-fg)",
										background: "var(--st-rejected-bg)",
										border: "1px solid var(--st-rejected-fg)",
										borderRadius: "var(--r-sm)",
										display: "flex",
										justifyContent: "space-between",
										alignItems: "flex-start",
										gap: 8,
									}}
								>
									<span>{deleteError}</span>
									<button
										type="button"
										aria-label="Dismiss"
										onClick={(e) => {
											e.stopPropagation();
											setDeleteErrors((prev) => {
												const { [it.id]: _omit, ...rest } = prev;
												return rest;
											});
										}}
										style={{
											background: "transparent",
											border: "none",
											padding: 0,
											cursor: "pointer",
											color: "inherit",
											display: "inline-flex",
										}}
									>
										<Icons.X size={11} />
									</button>
								</div>
							)}
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
}) => {
	const analyzeAction = useAction(api.analyze.run.run);
	const [reAnalyzing, setReAnalyzing] = useState(false);
	const [reAnalyzeError, setReAnalyzeError] = useState<string | null>(null);

	const rerunAs = async (provider: ProviderId) => {
		setReAnalyzing(true);
		setReAnalyzeError(null);
		try {
			const r = await analyzeAction({ id: item.id as Id<"inboxItems">, provider });
			if (!r.ok) setReAnalyzeError(r.error);
		} catch (err) {
			setReAnalyzeError(err instanceof Error ? err.message : String(err));
		} finally {
			setReAnalyzing(false);
		}
	};

	return (
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

				<div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)", marginBottom: 20 }}>
					{item.snippet}
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
					<ReanalyzeMenu
						currentProvider={analysis.provider}
						onPick={rerunAs}
						disabled={reAnalyzing}
						error={reAnalyzeError}
					/>
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
							// Include analysisId in the key so React remounts this
							// row when the operator switches analyses — the
							// row's promote state (idle / promoting / done)
							// resets automatically without needing useEffect.
							key={`${analysis.id}-${o.kind}-${i}`}
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
				{/* key={analysis.id} so the carousel row also remounts on an
				    analysis switch, clearing slide count + promote state. */}
				<PromoteCarouselRow key={analysis.id} analysisId={analysis.id} onOpenDrafts={onOpenDrafts} />
			</div>
		</div>
	);
};

const PROVIDERS: { id: ProviderId; label: string }[] = [
	{ id: "glm", label: "GLM 5.1" },
	{ id: "claude", label: "Claude Sonnet 4.6" },
	{ id: "openrouter", label: "OpenRouter" },
];

const ReanalyzeMenu = ({
	currentProvider,
	onPick,
	disabled,
	error,
}: {
	currentProvider: ProviderId;
	onPick: (p: ProviderId) => void;
	disabled: boolean;
	error: string | null;
}) => {
	const [open, setOpen] = useState(false);
	return (
		<div style={{ position: "relative" }}>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				disabled={disabled}
				className="mono"
				title="Re-run analysis with a different LLM"
				style={{
					fontSize: 11,
					padding: "3px 8px",
					border: "1px solid var(--border)",
					borderRadius: "var(--r-md)",
					background: "var(--surface-2)",
					color: "var(--ink-2)",
					cursor: disabled ? "wait" : "pointer",
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
				}}
			>
				LLM · {PROVIDER_LABEL[currentProvider]}
				{disabled ? <Icons.Clock size={10} /> : <Icons.ChevronDown size={10} />}
			</button>
			{open && (
				<div
					role="menu"
					style={{
						position: "absolute",
						top: "calc(100% + 4px)",
						right: 0,
						background: "var(--surface)",
						border: "1px solid var(--border)",
						borderRadius: "var(--r-md)",
						padding: 4,
						minWidth: 180,
						boxShadow: "var(--shadow-md)",
						zIndex: 5,
					}}
				>
					<div
						className="mono"
						style={{
							fontSize: 10,
							color: "var(--muted)",
							padding: "4px 8px",
							textTransform: "uppercase",
							letterSpacing: "0.08em",
						}}
					>
						re-analyze with
					</div>
					{PROVIDERS.map((p) => (
						<button
							key={p.id}
							type="button"
							onClick={() => {
								setOpen(false);
								onPick(p.id);
							}}
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								width: "100%",
								padding: "6px 8px",
								fontSize: 12,
								background: "transparent",
								border: "none",
								borderRadius: "var(--r-sm)",
								cursor: "pointer",
								textAlign: "left",
								color: "var(--ink)",
							}}
						>
							<span>{p.label}</span>
							{currentProvider === p.id && (
								<Icons.Check size={11} sw={2} style={{ color: "var(--accent-ink)" }} />
							)}
						</button>
					))}
				</div>
			)}
			{error && (
				<div
					className="mono"
					style={{
						position: "absolute",
						top: "calc(100% + 4px)",
						right: 0,
						fontSize: 10.5,
						color: "var(--st-rejected-fg)",
						maxWidth: 280,
					}}
				>
					{error}
				</div>
			)}
		</div>
	);
};
