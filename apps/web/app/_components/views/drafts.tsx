"use client";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { fmtDate, timeAgo } from "../format";
import { Icons } from "../icons";
import { Chip, HyperFrame } from "../primitives";
import type { Channel } from "../types";

const CHANNELS: { value: Channel | "all"; label: string }[] = [
	{ value: "all", label: "All channels" },
	{ value: "x", label: "X" },
	{ value: "ig", label: "Instagram" },
	{ value: "ig-reel", label: "IG Reels" },
	{ value: "tiktok", label: "TikTok" },
	{ value: "yt-shorts", label: "YT Shorts" },
	{ value: "fb-page", label: "FB Page" },
	{ value: "linkedin-page", label: "LinkedIn" },
];

const channelLabel = (c: string): string => {
	const map: Record<string, string> = {
		x: "X",
		ig: "Instagram",
		"ig-reel": "Instagram Reels",
		tiktok: "TikTok",
		"yt-shorts": "YouTube Shorts",
		"fb-page": "Facebook Page",
		"linkedin-page": "LinkedIn Page",
	};
	return map[c] ?? c;
};

const channelFrame = (c: string): "square" | "vertical" => {
	if (c === "ig-reel" || c === "tiktok" || c === "yt-shorts") return "vertical";
	return "square";
};

export const DraftsView = ({ channel, setChannel }: { channel: string; setChannel: (c: string) => void }) => {
	const drafts = useQuery(api.drafts.list.list, {});
	const counts = useQuery(api.drafts.list.counts, {});
	const approve = useMutation(api.drafts.mutate.approve);
	const reject = useMutation(api.drafts.mutate.reject);

	const loaded = drafts !== undefined;
	const rows = drafts ?? [];
	const filtered = channel === "all" ? rows : rows.filter((d) => d.channel === channel);

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
						<span className="n">{c.value === "all" ? (counts?.total ?? 0) : (counts?.[c.value] ?? 0)}</span>
					</button>
				))}
			</div>

			{!loaded ? (
				<div className="empty-state" style={{ padding: "60px 20px" }}>
					<div className="icn">
						<Icons.Clock size={20} />
					</div>
					<h4>Loading drafts…</h4>
				</div>
			) : filtered.length === 0 ? (
				<div className="empty-state" style={{ padding: "80px 20px" }}>
					<div className="icn">
						<Icons.Edit size={20} />
					</div>
					<h4>No drafts on {channelLabel(channel)}</h4>
					<p>
						Drafts flow here once an analysis is promoted. Try <kbd className="key">G A</kbd> to review analyses.
					</p>
				</div>
			) : (
				<div className="drafts-grid">
					{filtered.map((d) => (
						<DraftCard
							key={d._id}
							draft={d}
							onApprove={() => approve({ id: d._id })}
							onReject={() => reject({ id: d._id })}
						/>
					))}
				</div>
			)}
		</div>
	);
};

const DraftCard = ({
	draft,
	onApprove,
	onReject,
}: {
	draft: Doc<"drafts">;
	onApprove: () => void;
	onReject: () => void;
}) => {
	const variant = channelFrame(draft.channel);
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
						{timeAgo(draft.createdAt)}
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
					{draft.state !== "approved" && draft.state !== "rejected" && (
						<button type="button" className="btn xs" onClick={onApprove} title="Approve (A)">
							<Icons.Check size={11} sw={2} /> Approve
						</button>
					)}
					<button type="button" className="btn ghost xs" title="Edit (E)" disabled>
						<Icons.Edit size={11} />
					</button>
					{draft.state !== "rejected" && (
						<button type="button" className="btn ghost xs" title="Reject (R)" onClick={onReject}>
							<Icons.X size={11} />
						</button>
					)}
				</div>
			</div>
		</div>
	);
};
