"use client";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { fmtDate, timeAgo } from "../format";
import { Icons } from "../icons";
import { Chip, HyperFrame } from "../primitives";
import type { Channel, ImageProvider } from "../types";

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

const IMAGE_PROVIDERS: { k: ImageProvider; name: string }[] = [
	{ k: "nano-banana", name: "Nano Banana" },
	{ k: "gpt-image", name: "GPT Image" },
	{ k: "grok", name: "Grok" },
	{ k: "ideogram", name: "Ideogram" },
	{ k: "openrouter", name: "OpenRouter" },
];

const VIDEO_CHANNELS: readonly Channel[] = ["ig-reel", "tiktok", "yt-shorts"];

const isVideoChannel = (c: string): boolean => (VIDEO_CHANNELS as readonly string[]).includes(c);

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
	if (isVideoChannel(c)) return "vertical";
	return "square";
};

export const DraftsView = ({ channel, setChannel }: { channel: string; setChannel: (c: string) => void }) => {
	const drafts = useQuery(api.drafts.list.list, {});
	const counts = useQuery(api.drafts.list.counts, {});
	const settings = useQuery(api.settings.doc.get, {});
	const approve = useMutation(api.drafts.mutate.approve);
	const reject = useMutation(api.drafts.mutate.reject);

	const loaded = drafts !== undefined;
	const rows = drafts ?? [];
	const filtered = channel === "all" ? rows : rows.filter((d) => d.channel === channel);
	const defaultImageProvider: ImageProvider = settings?.defaultImageProvider ?? "nano-banana";

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
							defaultImageProvider={defaultImageProvider}
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
	defaultImageProvider,
	onApprove,
	onReject,
}: {
	draft: Doc<"drafts">;
	defaultImageProvider: ImageProvider;
	onApprove: () => void;
	onReject: () => void;
}) => {
	const variant = channelFrame(draft.channel);
	const videoChannel = isVideoChannel(draft.channel);

	const asset = useQuery(api.mediaAssets.list.firstReadyByDraft, { draftId: draft._id });
	const baseAsset = useQuery(api.mediaAssets.list.baseReadyByDraft, { draftId: draft._id });
	const assetLoaded = asset !== undefined;

	const generate = useAction(api.generate.image.action.generateForDraft);
	const overlay = useAction(api.generate.image.composite.overlayForDraft);
	const [picker, setPicker] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [compositing, setCompositing] = useState(false);
	const [genError, setGenError] = useState<string | null>(null);
	const [view, setView] = useState<"overlay" | "base">("overlay");

	const runGenerate = async (provider: ImageProvider) => {
		setPicker(false);
		setSubmitting(true);
		setGenError(null);
		try {
			const r = await generate({ draftId: draft._id, provider });
			if (!r.ok) setGenError(r.error);
		} catch (err) {
			setGenError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const runOverlay = async () => {
		setCompositing(true);
		setGenError(null);
		try {
			const r = await overlay({ draftId: draft._id });
			if (!r.ok) setGenError(r.error);
		} catch (err) {
			setGenError(err instanceof Error ? err.message : String(err));
		} finally {
			setCompositing(false);
		}
	};

	const showGenerateButton = !videoChannel && assetLoaded && (!asset || asset.state === "failed");
	// Overlay button shows when the *current* visible asset is a ready base
	// (no composite yet). Once a composite lands, `asset` flips to it and the
	// button hides — the toggle takes over.
	const currentIsBase = !!asset && asset.state === "ready" && !asset.overlaidFrom;
	const showOverlayButton = !videoChannel && currentIsBase;
	const hasComposite = !!asset && asset.state === "ready" && !!asset.overlaidFrom;
	const displayedAsset = hasComposite && view === "base" && baseAsset ? baseAsset : asset;

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
				<div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
					<DraftMedia
						asset={displayedAsset ?? null}
						assetLoaded={assetLoaded}
						variant={variant}
						ar={draft.ar}
						channel={draft.channel}
					/>
					{hasComposite && <BaseOverlayToggle value={view} onChange={setView} />}
				</div>
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

			{(genError || asset?.state === "failed") && (
				<div
					className="mono"
					style={{
						padding: "6px 12px",
						fontSize: 10.5,
						color: "var(--st-rejected-fg)",
						borderTop: "1px solid var(--border-faint)",
					}}
				>
					{genError ?? asset?.error ?? "image generation failed"}
				</div>
			)}

			<div className="foot" style={{ position: "relative" }}>
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
					{videoChannel ? (
						<button type="button" className="btn ghost xs" disabled title="video generation is a later phase">
							<Icons.Film size={11} /> video later
						</button>
					) : showGenerateButton ? (
						<button
							type="button"
							className="btn xs"
							disabled={submitting}
							onClick={() => setPicker((p) => !p)}
							title="Generate image"
						>
							{submitting ? (
								<>
									<Icons.Clock size={11} /> generating…
								</>
							) : (
								<>
									<Icons.Sparkle size={11} /> Generate image
								</>
							)}
						</button>
					) : showOverlayButton ? (
						<button
							type="button"
							className="btn xs"
							disabled={compositing}
							onClick={runOverlay}
							title="Overlay AR text with HyperFrames"
						>
							{compositing ? (
								<>
									<Icons.Clock size={11} /> compositing…
								</>
							) : (
								<>
									<Icons.Sparkle size={11} /> Overlay AR text
								</>
							)}
						</button>
					) : null}
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

				{picker && (
					<ImageProviderPicker
						active={defaultImageProvider}
						onPick={runGenerate}
						onClose={() => setPicker(false)}
					/>
				)}
			</div>
		</div>
	);
};

const DraftMedia = ({
	asset,
	assetLoaded,
	variant,
	ar,
	channel,
}: {
	asset: Doc<"mediaAssets"> | null;
	assetLoaded: boolean;
	variant: "square" | "vertical";
	ar: string;
	channel: string;
}) => {
	const w = variant === "vertical" ? 140 : 200;
	const h = variant === "vertical" ? w / (9 / 16) : w;

	if (!assetLoaded) {
		return <div className="skeleton" style={{ width: w, height: h, flexShrink: 0 }} />;
	}

	if (asset && asset.state === "generating") {
		return (
			<div
				className="skeleton"
				style={{ width: w, height: h, flexShrink: 0, position: "relative", overflow: "hidden" }}
			>
				<span
					className="mono"
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: 10,
						color: "var(--muted)",
					}}
				>
					generating…
				</span>
			</div>
		);
	}

	if (asset && asset.state === "ready" && asset.storageId) {
		return <ReadyImage storageId={asset.storageId} width={w} height={h} alt={asset.prompt.slice(0, 80)} />;
	}

	// No asset (or failed) — fall back to the HyperFrame preview of the AR copy.
	return <HyperFrame variant={variant} ar={ar} channel={channel} small />;
};

const ReadyImage = ({
	storageId,
	width,
	height,
	alt,
}: {
	storageId: Id<"_storage">;
	width: number;
	height: number;
	alt: string;
}) => {
	const url = useQuery(api.mediaAssets.url.resolveUrl, { storageId });
	if (!url) return <div className="skeleton" style={{ width, height, flexShrink: 0 }} />;
	return (
		// biome-ignore lint/performance/noImgElement: Convex storage URLs are short-lived, not Next.js-optimizable
		<img
			src={url}
			alt={alt}
			width={width}
			height={height}
			style={{
				width,
				height,
				objectFit: "cover",
				borderRadius: "var(--r-md)",
				flexShrink: 0,
			}}
		/>
	);
};

const ImageProviderPicker = ({
	active,
	onPick,
	onClose,
}: {
	active: ImageProvider;
	onPick: (provider: ImageProvider) => void;
	onClose: () => void;
}) => {
	return (
		<div
			role="menu"
			aria-label="Choose image provider"
			style={{
				position: "absolute",
				bottom: "calc(100% + 4px)",
				right: 0,
				zIndex: 5,
				background: "var(--surface)",
				border: "1px solid var(--border)",
				borderRadius: "var(--r-md)",
				padding: 6,
				minWidth: 180,
				boxShadow: "var(--shadow-md)",
			}}
		>
			<div
				className="mono"
				style={{
					fontSize: 10,
					color: "var(--muted)",
					padding: "4px 6px",
					textTransform: "uppercase",
					letterSpacing: "0.08em",
				}}
			>
				choose provider
			</div>
			{IMAGE_PROVIDERS.map((p) => (
				<button
					key={p.k}
					type="button"
					className="btn ghost xs"
					onClick={() => onPick(p.k)}
					style={{
						display: "flex",
						justifyContent: "space-between",
						width: "100%",
						padding: "6px 8px",
						fontSize: 12,
					}}
				>
					<span>{p.name}</span>
					{active === p.k && <Icons.Check size={11} sw={2} style={{ color: "var(--accent-ink)" }} />}
				</button>
			))}
			<button
				type="button"
				className="btn ghost xs"
				onClick={onClose}
				style={{ width: "100%", marginTop: 4, fontSize: 11 }}
			>
				cancel
			</button>
		</div>
	);
};

const BaseOverlayToggle = ({
	value,
	onChange,
}: {
	value: "overlay" | "base";
	onChange: (v: "overlay" | "base") => void;
}) => {
	return (
		<div
			role="group"
			aria-label="Toggle base or overlay image"
			className="filter-seg"
			style={{ alignSelf: "center", fontSize: 10 }}
		>
			<button type="button" className={value === "base" ? "active" : ""} onClick={() => onChange("base")}>
				base
			</button>
			<button type="button" className={value === "overlay" ? "active" : ""} onClick={() => onChange("overlay")}>
				overlay
			</button>
		</div>
	);
};
