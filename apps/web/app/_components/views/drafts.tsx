"use client";

import { fmtDate } from "../format";
import { Icons } from "../icons";
import { Chip, HyperFrame } from "../primitives";
import type { Channel, Draft } from "../types";

const CHANNELS: { value: Channel | "all"; label: string }[] = [
	{ value: "all", label: "All channels" },
	{ value: "x", label: "X" },
	{ value: "ig", label: "Instagram" },
	{ value: "ig-reel", label: "IG Reels" },
	{ value: "tiktok", label: "TikTok" },
	{ value: "yt-shorts", label: "YT Shorts" },
];

const channelLabel = (c: string): string => {
	const map: Record<string, string> = {
		x: "X",
		ig: "Instagram",
		"ig-reel": "Instagram Reels",
		tiktok: "TikTok",
		"yt-shorts": "YouTube Shorts",
	};
	return map[c] ?? c;
};

export const DraftsView = ({
	channel,
	setChannel,
	drafts,
	onUpdate,
}: {
	channel: string;
	setChannel: (c: string) => void;
	drafts: Draft[];
	onUpdate: (id: string, patch: Partial<Draft>) => void;
}) => {
	const filtered = channel === "all" ? drafts : drafts.filter((d) => d.channel === channel);
	const counts = drafts.reduce<Record<string, number>>((acc, d) => {
		acc[d.channel] = (acc[d.channel] || 0) + 1;
		return acc;
	}, {});

	return (
		<div className="drafts-view">
			<div className="channel-tabs">
				{CHANNELS.map((c) => (
					<button
						key={c.value}
						type="button"
						className={`channel-tab${channel === c.value ? " active" : ""}`}
						onClick={() => setChannel(c.value)}
					>
						{c.label}
						<span className="n">{c.value === "all" ? drafts.length : counts[c.value] || 0}</span>
					</button>
				))}
			</div>

			{filtered.length === 0 ? (
				<div className="empty-state" style={{ padding: "80px 20px" }}>
					<div className="icn">
						<Icons.Edit size={20} />
					</div>
					<h4>No drafts on {channelLabel(channel)}</h4>
					<p>
						Drafts flow here once an analysis promotes an output. Try <kbd className="key">G A</kbd> to review
						analyses.
					</p>
				</div>
			) : (
				<div className="drafts-grid">
					{filtered.map((d) => (
						<DraftCard key={d.id} draft={d} onUpdate={onUpdate} />
					))}
				</div>
			)}
		</div>
	);
};

const DraftCard = ({ draft, onUpdate }: { draft: Draft; onUpdate: (id: string, patch: Partial<Draft>) => void }) => {
	const variant = draft.frame === "hyper-vertical" ? "vertical" : "square";
	return (
		<div className="draft-card">
			<div className="top">
				<div className="row gap-2">
					<span
						className="mono"
						style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}
					>
						{channelLabel(draft.channel)}
					</span>
					<span className="bullet" />
					<span className="mono" style={{ fontSize: 10.5, color: "var(--muted-2)" }}>
						{draft.id}
					</span>
				</div>
				<Chip state={draft.state} />
			</div>

			<div className="body">
				<HyperFrame variant={variant} ar={draft.ar} channel={draft.channel} small />
				<div className="copy">
					<div className="ar-text" style={{ fontSize: 14, textWrap: "pretty" }}>
						{draft.ar}
					</div>
					<div className="en-text">{draft.en}</div>
					<div className="row gap-2" style={{ marginTop: "auto", flexWrap: "wrap" }}>
						{draft.concepts.map((c) => (
							<span key={c} className="concept-tag" style={{ height: 18, fontSize: 10, padding: "0 6px" }}>
								{c}
							</span>
						))}
					</div>
				</div>
			</div>

			<div className="foot">
				<div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
					{draft.chars} chars · AR
					{draft.scheduled && (
						<>
							{" · "}
							<span style={{ color: "var(--accent-ink)" }}>scheduled {fmtDate(draft.scheduled)}</span>
						</>
					)}
				</div>
				<div className="row gap-1">
					{draft.state !== "approved" && (
						<button
							type="button"
							className="btn xs"
							onClick={() => onUpdate(draft.id, { state: "approved" })}
							title="Approve (A)"
						>
							<Icons.Check size={11} sw={2} /> Approve
						</button>
					)}
					<button type="button" className="btn ghost xs" title="Edit (E)">
						<Icons.Edit size={11} />
					</button>
					<button type="button" className="btn ghost xs" title="Reject (R)">
						<Icons.X size={11} />
					</button>
				</div>
			</div>
		</div>
	);
};
