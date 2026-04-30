"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useState } from "react";
import { timeAgo } from "../format";
import { Icons } from "../icons";
import type { Channel } from "../types";
import { CHANNELS } from "./draftsChannels";

type ChannelHealthRow = NonNullable<
	ReturnType<typeof useQuery<typeof api.metrics.postizSnapshots.latestByProvider>>
>[number];

const POSTIZ_PROVIDER_LABELS: Record<string, string> = {
	facebook: "Facebook",
	instagram: "Instagram",
	"linkedin-page": "LinkedIn",
	tiktok: "TikTok",
	x: "X",
	youtube: "YouTube",
};

export const MetricsView = () => {
	const [channel, setChannel] = useState<Channel | "all">("all");
	const postizProvider = toPostizProvider(channel);
	const rows = useQuery(
		api.metrics.postizSnapshots.latestByProvider,
		postizProvider === undefined ? {} : { provider: postizProvider },
	);

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
					</button>
				))}
			</div>
			<section className="settings-panel">
				<div className="settings-panel-head">
					<div>
						<div className="section-h">Channel health</div>
						<p>Postiz integration-level snapshots for platform trends, not per-draft ranking.</p>
					</div>
				</div>
				<div className="col gap-2">
					{rows === undefined ? (
						<div className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>
							Loading channel health...
						</div>
					) : rows.length === 0 ? (
						<div className="empty-state" style={{ padding: "42px 12px" }}>
							<div className="icn">
								<Icons.BarChart size={18} />
							</div>
							<h4>No Postiz metrics yet</h4>
						</div>
					) : (
						<div className="settings-grid" style={{ alignItems: "start" }}>
							{rows.map((row) => (
								<ChannelHealthCard key={row._id} row={row} />
							))}
						</div>
					)}
				</div>
			</section>
		</div>
	);
};

function toPostizProvider(channel: Channel | "all"): string | undefined {
	const map: Partial<Record<Channel, string>> = {
		x: "x",
		ig: "instagram",
		"ig-reel": "instagram",
		tiktok: "tiktok",
		"yt-shorts": "youtube",
		"fb-page": "facebook",
		"linkedin-page": "linkedin-page",
	};
	return channel === "all" ? undefined : map[channel];
}

function compactNumber(value: number | undefined): string {
	if (value === undefined) return "n/a";
	return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function providerLabel(provider: string): string {
	return POSTIZ_PROVIDER_LABELS[provider] ?? provider;
}

function ChannelHealthCard({ row }: { row: ChannelHealthRow }) {
	const primaryStats = [
		["views", row.views],
		["likes", row.likes],
		["comments", row.comments],
		["shares", row.shares],
		["saves", row.saves],
		["followers", row.followers],
		["reach", row.reach],
	].filter((entry): entry is [string, number] => typeof entry[1] === "number");

	return (
		<div className="out-card" style={{ alignItems: "flex-start" }}>
			<div className="kind">{providerLabel(row.provider)}</div>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ fontWeight: 600, fontSize: 13 }}>{row.name}</div>
				<div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>
					{row.windowDays}d window · captured {timeAgo(row.capturedAt)} ago · {row.rawMetricCount} raw metrics
				</div>
				<div className="row gap-2" style={{ flexWrap: "wrap", marginTop: 8 }}>
					{primaryStats.length === 0 ? (
						<span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
							No standard totals mapped yet
						</span>
					) : (
						primaryStats.map(([label, value]) => (
							<span key={label} className="concept-tag">
								{compactNumber(value)} {label}
							</span>
						))
					)}
				</div>
			</div>
		</div>
	);
}
