"use client";

import { useMemo, useRef, useState } from "react";
import { useMountEffect } from "../../../lib/use-mount-effect";
import { fmtDateTime, timeAgo } from "../format";
import { Icons } from "../icons";
import { Chip, SourceBadge } from "../primitives";
import type { CapturePayload, InboxItem, Source } from "../types";

type DetectedSource = Source | null;
type Detected = { source: DetectedSource; url: string | null; handle: string | null; title: string | null };

function detectSource(input: string): Detected {
	const s = (input || "").trim();
	if (!s) return { source: null, url: null, handle: null, title: null };
	if (/(?:twitter\.com|x\.com)\/[^\s/]+/i.test(s)) {
		const m = s.match(/(?:twitter\.com|x\.com)\/([^\s/]+)/i);
		return { source: "x", url: s, handle: `@${m ? m[1] : "user"}`, title: null };
	}
	if (/youtu\.?be/i.test(s)) {
		return { source: "youtube", url: s, handle: "youtube", title: null };
	}
	if (/^https?:\/\//i.test(s)) {
		try {
			const u = new URL(s);
			return { source: "article", url: s, handle: u.hostname.replace(/^www\./, ""), title: null };
		} catch {
			return { source: "article", url: s, handle: "article", title: null };
		}
	}
	return { source: "manual", url: null, handle: "operator", title: s.slice(0, 80) };
}

const SOURCE_HINTS: Record<Exclude<Source, "newsletter">, string> = {
	x: "x.com",
	youtube: "youtube",
	article: "article",
	manual: "manual note",
};

const CAPTURE_CHANS: { v: "auto" | Exclude<Source, "newsletter">; l: string }[] = [
	{ v: "auto", l: "auto-detect" },
	{ v: "x", l: "x" },
	{ v: "youtube", l: "youtube" },
	{ v: "article", l: "article" },
	{ v: "manual", l: "manual" },
];

const CaptureBar = ({ onCapture }: { onCapture: (p: CapturePayload, done: () => void) => void }) => {
	const [value, setValue] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [chan, setChan] = useState<"auto" | Exclude<Source, "newsletter">>("auto");
	const inputRef = useRef<HTMLInputElement | null>(null);

	const detected = useMemo(() => detectSource(value), [value]);
	const source: DetectedSource = chan === "auto" ? detected.source : chan;

	useMountEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
				e.preventDefault();
				inputRef.current?.focus();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	});

	const submit = (e?: React.FormEvent | React.KeyboardEvent) => {
		if (e) e.preventDefault();
		if (!value.trim() || submitting) return;
		setSubmitting(true);
		const payload: CapturePayload = {
			raw: value,
			source: (source ?? "manual") as Source,
			url: detected.url,
			handle: detected.handle ?? "operator",
			title: detected.title,
		};
		onCapture(payload, () => {
			setSubmitting(false);
			setValue("");
		});
	};

	const placeholderMap = {
		auto: "Paste an X link, YouTube URL, article URL, or write a manual note…",
		x: "Paste an x.com / twitter.com URL…",
		youtube: "Paste a YouTube or youtu.be URL…",
		article: "Paste an article URL…",
		manual: "Type a manual note, concept seed, or raw idea…",
	};

	return (
		<div className="capture">
			<div className="capture-head">
				<span className="t">Capture</span>
				<span className="mono">feeds the pipeline · nothing auto-publishes</span>
			</div>
			<form onSubmit={submit} className="capture-field">
				<Icons.Plus size={13} style={{ color: "var(--muted)" }} />
				{value && source && (
					<span className={`detected detected-${source}`}>
						<span
							style={{
								display: "inline-block",
								width: 7,
								height: 7,
								borderRadius: 2,
								background:
									source === "x"
										? "oklch(0.25 0.01 270)"
										: source === "youtube"
											? "oklch(0.58 0.20 28)"
											: source === "article"
												? "oklch(0.62 0.10 80)"
												: "oklch(0.6 0.01 270)",
							}}
						/>
						{source === "newsletter" ? "newsletter" : SOURCE_HINTS[source]}
					</span>
				)}
				<input
					ref={inputRef}
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder={placeholderMap[chan]}
					disabled={submitting}
					onKeyDown={(e) => {
						if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e);
						if (e.key === "Escape") {
							setValue("");
							e.currentTarget.blur();
						}
					}}
				/>
				<button type="submit" className="submit" disabled={!value.trim() || submitting}>
					{submitting ? (
						<>
							<Icons.Clock size={11} /> capturing…
						</>
					) : (
						<>
							<Icons.Sparkle size={11} /> Capture & analyze <kbd>⌘↵</kbd>
						</>
					)}
				</button>
			</form>
			<div className="capture-foot">
				<div className="capture-chan">
					{CAPTURE_CHANS.map((c) => (
						<button key={c.v} type="button" className={chan === c.v ? "active" : ""} onClick={() => setChan(c.v)}>
							{c.l}
						</button>
					))}
				</div>
				<span>
					<kbd className="key">⌘N</kbd> focus · <kbd className="key">⌘↵</kbd> submit
				</span>
			</div>
		</div>
	);
};

const StageTrack = ({ state }: { state: InboxItem["state"] }) => {
	const stages = ["captured", "analyzing", "analysis", "drafting"];
	const stageIdx = state === "new" ? 0 : state === "analyzing" ? 1 : state === "analysis" ? 2 : 3;
	return (
		<span className="stage-track">
			{stages.map((s, i) => (
				<span key={s} className={`step${i < stageIdx ? " done" : i === stageIdx ? " active" : ""}`}>
					<span className="dot" /> {s}
					{i < stages.length - 1 && <span className="arrow"> › </span>}
				</span>
			))}
		</span>
	);
};

export const InboxView = ({
	items,
	onCapture,
	selected,
	setSelected,
	focusIdx,
	setFocusIdx,
	checked,
	setChecked,
	onAnalyze,
	onReject,
	onOpenAnalysis,
	filter,
	sourceFilter,
	loading,
	llmLabel,
}: {
	items: InboxItem[];
	onCapture: (p: CapturePayload, done: () => void) => void;
	selected: string;
	setSelected: (id: string) => void;
	focusIdx: number;
	setFocusIdx: (n: number) => void;
	checked: Set<string>;
	setChecked: (s: Set<string>) => void;
	onAnalyze: (ids: string[]) => void;
	onReject: (id: string) => void;
	onOpenAnalysis: (id: string) => void;
	filter: string;
	sourceFilter: string;
	loading?: boolean;
	llmLabel: string;
}) => {
	const filtered = items.filter((it) => {
		if (filter !== "all" && it.state !== filter) return false;
		if (sourceFilter !== "all" && it.source !== sourceFilter) return false;
		return true;
	});

	const sel = filtered.find((i) => i.id === selected) || filtered[0];

	const toggleChk = (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		const next = new Set(checked);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setChecked(next);
	};

	return (
		<div className="inbox-view">
			<div className="inbox-list">
				<CaptureBar onCapture={onCapture} />

				<div className="inbox-list-head">
					<div className="row gap-2">
						<span className="mono">{filtered.length} items</span>
						{checked.size > 0 && (
							<>
								<span className="sep" />
								<span style={{ color: "var(--ink)" }}>{checked.size} selected</span>
								<button type="button" className="btn xs accent" onClick={() => onAnalyze([...checked])}>
									<Icons.Sparkle size={11} /> Analyze
								</button>
							</>
						)}
					</div>
					<div className="row gap-2">
						<span className="mono" style={{ fontSize: 10, color: "var(--muted-2)" }}>
							cron · next 8m
						</span>
					</div>
				</div>

				{filtered.length === 0 ? (
					<div className="empty-state">
						<div className="icn">
							<Icons.Inbox size={20} />
						</div>
						<h4>Inbox is quiet</h4>
						<p>
							Paste an X link, YouTube URL, or article URL above to start the pipeline — or wait for the next
							cron run.
						</p>
					</div>
				) : (
					filtered.map((it, i) => {
						const isSel = sel && sel.id === it.id;
						const isFocus = i === focusIdx;
						const isChk = checked.has(it.id);
						return (
							<div
								key={it.id}
								className={`inbox-row${isSel ? " selected" : ""}${isFocus ? " focus" : ""}`}
								onClick={() => {
									setSelected(it.id);
									setFocusIdx(i);
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										setSelected(it.id);
										setFocusIdx(i);
									}
								}}
								role="button"
								tabIndex={0}
							>
								<div
									className={`chk${isChk ? " on" : ""}`}
									onClick={(e) => toggleChk(it.id, e)}
									onKeyDown={(e) => {
										if (e.key === " " || e.key === "Enter") {
											e.preventDefault();
											toggleChk(it.id, e as unknown as React.MouseEvent);
										}
									}}
									role="checkbox"
									aria-checked={isChk}
									tabIndex={-1}
								>
									{isChk && <Icons.Check size={10} sw={2} />}
								</div>
								<div className="row gap-2" style={{ paddingTop: 2 }}>
									<SourceBadge source={it.source} handle={it.handle} compact />
								</div>
								<div className="meta">
									<div className="row gap-2" style={{ justifyContent: "space-between" }}>
										<div className="title">{it.title}</div>
									</div>
									<div className="snippet">{it.snippet}</div>
									<div className="row gap-2" style={{ marginTop: 4 }}>
										{it.state === "analyzing" ? <StageTrack state={it.state} /> : <Chip state={it.state} />}
										{it.lang === "ar" && (
											<span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
												AR
											</span>
										)}
										<span className="bullet" />
										<span className="mono" style={{ fontSize: 10, color: "var(--muted-2)" }}>
											{typeof it.length === "number" ? `${it.length} words` : it.length}
										</span>
									</div>
								</div>
								<div className="time" title={fmtDateTime(it.captured)}>
									{timeAgo(it.captured)}
								</div>
							</div>
						);
					})
				)}
			</div>

			{loading ? (
				<InboxDetailLoading />
			) : sel ? (
				<InboxDetail
					item={sel}
					onAnalyze={() => onAnalyze([sel.id])}
					onReject={() => onReject(sel.id)}
					onOpenAnalysis={() => onOpenAnalysis(sel.id)}
					llmLabel={llmLabel}
				/>
			) : (
				<InboxDetailEmpty />
			)}
		</div>
	);
};

const InboxDetail = ({
	item,
	onAnalyze,
	onReject,
	onOpenAnalysis,
	llmLabel,
}: {
	item: InboxItem;
	onAnalyze: () => void;
	onReject: () => void;
	onOpenAnalysis: () => void;
	llmLabel: string;
}) => (
	<div className="inbox-detail">
		<div className="inbox-detail-head">
			<div className="row gap-3" style={{ justifyContent: "space-between" }}>
				<div className="row gap-3">
					<SourceBadge source={item.source} handle={item.handle} />
					<Chip state={item.state} />
					{item.lang === "ar" && (
						<span className="concept-tag">
							<Icons.Language size={10} /> AR
						</span>
					)}
				</div>
				<div className="row gap-2">
					<button type="button" className="btn ghost sm" title="Reject (R)" onClick={onReject}>
						<Icons.X size={12} /> Reject
					</button>
					{item.state === "new" && (
						<button type="button" className="btn accent sm" onClick={onAnalyze}>
							<Icons.Sparkle size={12} /> Analyze
							<kbd
								className="key"
								style={{
									borderColor: "oklch(0.95 0.003 95 / 0.25)",
									background: "transparent",
									color: "oklch(0.95 0.003 95 / 0.85)",
								}}
							>
								⌘↵
							</kbd>
						</button>
					)}
					{item.state === "analyzing" && (
						<button type="button" className="btn sm" disabled style={{ opacity: 0.7 }}>
							<Icons.Clock size={12} /> Analyzing…
						</button>
					)}
					{(item.state === "analysis" || item.state === "draft" || item.state === "approved") && (
						<button type="button" className="btn sm" onClick={onOpenAnalysis}>
							<Icons.Arrow size={12} /> Open analysis
						</button>
					)}
				</div>
			</div>
		</div>
		<div className="inbox-detail-body">
			<h2 style={{ textWrap: "balance" }}>{item.title}</h2>

			{item.source === "x" ? (
				<TweetCard item={item} />
			) : (
				<div style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>{item.snippet}</div>
			)}

			<div className="panel" style={{ marginBottom: 18 }}>
				<div className="panel-h">
					<span className="section-h">Captured metadata</span>
					<span className="mono" style={{ fontSize: 10.5 }}>
						{item.id}
					</span>
				</div>
				<div className="panel-body">
					<div className="kv-row">
						<div className="k">Source</div>
						<div className="v row gap-2">
							<SourceBadge source={item.source} /> {item.handle}
						</div>
					</div>
					<div className="kv-row">
						<div className="k">Captured</div>
						<div className="v mono" style={{ fontSize: 12 }}>
							{fmtDateTime(item.captured)}
						</div>
					</div>
					{item.url && (
						<div className="kv-row">
							<div className="k">URL</div>
							<div className="v mono" style={{ fontSize: 11.5, color: "var(--accent-ink)" }}>
								{item.url}
							</div>
						</div>
					)}
					<div className="kv-row">
						<div className="k">Language</div>
						<div className="v">{item.lang === "ar" ? "Arabic" : "English"}</div>
					</div>
					<div className="kv-row">
						<div className="k">Length</div>
						<div className="v mono" style={{ fontSize: 12 }}>
							{typeof item.length === "number" ? `${item.length} words` : item.length}
						</div>
					</div>
					<div className="kv-row">
						<div className="k">Pipeline</div>
						<div className="v">
							<Chip state={item.state} />
						</div>
					</div>
				</div>
			</div>

			<div className="panel">
				<div className="panel-h">
					<span className="section-h">Next step</span>
					<span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
						llm: {llmLabel} (default)
					</span>
				</div>
				<div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
					<div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
						When you run Analyze, the LLM will extract a structured summary, tag concepts against the 94-concept
						ontology, and suggest draft tweets, reel ideas, and website lessons. Nothing publishes until you
						approve.
					</div>
					<div className="row gap-2">
						{["Foundations", "Agents", "Media"].map((t) => (
							<label key={t} className="row gap-1" style={{ fontSize: 12 }}>
								<input
									type="checkbox"
									defaultChecked={t !== "Media"}
									style={{ accentColor: "var(--accent)" }}
								/>{" "}
								{t}
							</label>
						))}
					</div>
				</div>
			</div>
		</div>
	</div>
);

const TweetCard = ({ item }: { item: InboxItem }) => {
	const displayName = (item.handle ?? "").replace(/^@/, "") || "user";
	const handleText = item.handle?.startsWith("@") ? item.handle : `@${displayName}`;
	const initial = displayName.slice(0, 1).toUpperCase() || "·";
	return (
		<div className="tweet-card">
			<div className="tweet-head">
				<div className="tweet-avatar" aria-hidden="true">
					{initial}
				</div>
				<div className="tweet-id">
					<div className="tweet-name">{displayName}</div>
					<div className="tweet-handle">{handleText}</div>
				</div>
				{item.url && (
					<a
						href={item.url}
						target="_blank"
						rel="noreferrer noopener"
						className="tweet-link"
						title="Open on x.com"
					>
						<Icons.Arrow size={13} />
					</a>
				)}
			</div>
			<div className="tweet-body" dir={item.lang === "ar" ? "rtl" : "ltr"}>
				{item.snippet}
			</div>
			<div className="tweet-meta">
				<span className="mono">{fmtDateTime(item.captured)}</span>
				<span className="bullet" />
				<span>x.com</span>
			</div>
		</div>
	);
};

const InboxDetailLoading = () => (
	<div className="inbox-detail" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
		<div className="empty-state">
			<div className="icn">
				<Icons.Clock size={22} />
			</div>
			<h4>Loading…</h4>
			<p>Fetching captured items from Convex.</p>
		</div>
	</div>
);

const InboxDetailEmpty = () => (
	<div className="inbox-detail" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
		<div className="empty-state">
			<div className="icn">
				<Icons.Inbox size={22} />
			</div>
			<h4>Nothing selected</h4>
			<p>
				Pick an item on the left to preview, or press <kbd className="key">J</kbd> to start at the top.
			</p>
		</div>
	</div>
);
