"use client";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { fmtDate, timeAgo } from "../format";
import { Icons } from "../icons";
import { Chip } from "../primitives";
import type { Channel, ImageProvider } from "../types";
import { ArEditor } from "./draftsArEditor";
import { CarouselStrip, carouselStatusLabel } from "./draftsCarousel";
import { ImageProviderPicker } from "./draftsImagePicker";
import { DraftMedia } from "./draftsMedia";
import { SchedulePopover } from "./draftsScheduler";

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
	const unschedule = useMutation(api.drafts.mutate.unschedule);
	const updateAr = useMutation(api.drafts.mutate.updateAr);

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
							onUnschedule={() => unschedule({ id: d._id })}
							onSaveAr={(ar) => updateAr({ id: d._id, ar })}
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
	onUnschedule,
	onSaveAr,
}: {
	draft: Doc<"drafts">;
	defaultImageProvider: ImageProvider;
	onApprove: () => void;
	onReject: () => void;
	onUnschedule: () => void;
	onSaveAr: (ar: string) => Promise<unknown>;
}) => {
	const variant = channelFrame(draft.channel);
	const videoChannel = isVideoChannel(draft.channel);

	const isCarousel = draft.mediaKind === "carousel";

	const asset = useQuery(api.mediaAssets.list.firstReadyByDraft, isCarousel ? "skip" : { draftId: draft._id });
	const baseAsset = useQuery(api.mediaAssets.list.baseReadyByDraft, isCarousel ? "skip" : { draftId: draft._id });
	const assetLoaded = isCarousel ? true : asset !== undefined;

	const generate = useAction(api.generate.image.action.generateForDraft);
	const overlay = useAction(api.generate.image.composite.overlayForDraft);
	const generateCarousel = useAction(api.generate.image.carouselAction.generateCarouselForDraft);
	const overlayCarousel = useAction(api.generate.image.compositeCarouselAction.overlayCarouselForDraft);
	const [picker, setPicker] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [compositing, setCompositing] = useState(false);
	const [genError, setGenError] = useState<string | null>(null);
	const [view, setView] = useState<"overlay" | "base">("overlay");
	const [schedulerOpen, setSchedulerOpen] = useState(false);
	const [editing, setEditing] = useState(false);
	const [editDraft, setEditDraft] = useState(draft.ar);
	const [editError, setEditError] = useState<string | null>(null);
	const [editSaving, setEditSaving] = useState(false);
	const editLocked =
		!!draft.postizStatus && draft.postizStatus !== "failed"
			? `AR locked while post is ${draft.postizStatus} — unschedule first`
			: null;

	const saveAr = async () => {
		setEditSaving(true);
		setEditError(null);
		try {
			await onSaveAr(editDraft);
			setEditing(false);
		} catch (err) {
			setEditError(err instanceof Error ? err.message : String(err));
		} finally {
			setEditSaving(false);
		}
	};
	const editorProps = {
		value: editDraft,
		onChange: setEditDraft,
		onCancel: () => setEditing(false),
		onSave: saveAr,
		error: editError,
		saving: editSaving,
	};

	const runGenerate = async (provider: ImageProvider) => {
		setPicker(false);
		setSubmitting(true);
		setGenError(null);
		try {
			const r = isCarousel
				? await generateCarousel({ draftId: draft._id, provider })
				: await generate({ draftId: draft._id, provider });
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
			const r = isCarousel ? await overlayCarousel({ draftId: draft._id }) : await overlay({ draftId: draft._id });
			if (!r.ok) setGenError(r.error);
		} catch (err) {
			setGenError(err instanceof Error ? err.message : String(err));
		} finally {
			setCompositing(false);
		}
	};

	// Carousel-specific queries. `useQuery` with `"skip"` short-circuits to
	// `undefined` so we don't fetch carousel data for single-image drafts.
	const carouselSlots = useQuery(api.mediaAssets.list.slidesForDraft, isCarousel ? { draftId: draft._id } : "skip");
	const carouselBaseSlots = useQuery(
		api.mediaAssets.list.slidesBaseForDraft,
		isCarousel ? { draftId: draft._id } : "skip",
	);
	const carouselStatus = useQuery(
		api.mediaAssets.list.slidesStatusForDraft,
		isCarousel ? { draftId: draft._id } : "skip",
	);
	const carouselScript = useQuery(
		api.carouselSlides.list.scriptForDraft,
		isCarousel ? { draftId: draft._id } : "skip",
	);

	const carouselReadyBaseCount = (carouselBaseSlots ?? []).length;
	const carouselReadyCompositeCount = (carouselSlots ?? []).filter((a) => !!a.overlaidFrom).length;
	const carouselExpectedCount = (carouselScript ?? []).length;
	const carouselGenerating = (carouselStatus ?? []).filter((a) => a.state === "generating").length;
	const carouselFailed = (carouselStatus ?? []).filter((a) => a.state === "failed").length;

	const showGenerateButton = isCarousel
		? !!carouselScript &&
			carouselReadyBaseCount === 0 &&
			carouselReadyCompositeCount === 0 &&
			carouselGenerating === 0
		: !videoChannel && assetLoaded && (!asset || asset.state === "failed");
	// Overlay button shows when the *current* visible asset is a ready base
	// (no composite yet). Once a composite lands, `asset` flips to it and the
	// button hides — the toggle takes over.
	const currentIsBase = !!asset && asset.state === "ready" && !asset.overlaidFrom;
	const carouselHasComposite = carouselReadyCompositeCount > 0;
	const carouselNeedsOverlay =
		isCarousel && carouselReadyBaseCount > 0 && carouselReadyCompositeCount < carouselReadyBaseCount;
	const showOverlayButton = isCarousel ? carouselNeedsOverlay : !videoChannel && currentIsBase;
	const hasComposite = isCarousel ? carouselHasComposite : !!asset && asset.state === "ready" && !!asset.overlaidFrom;
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
				{isCarousel ? (
					<div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
						<CarouselStrip
							script={carouselScript ?? []}
							slots={carouselSlots ?? []}
							baseSlots={carouselBaseSlots ?? []}
							status={carouselStatus ?? []}
							view={view}
						/>
						<div className="row gap-2" style={{ alignItems: "center" }}>
							<span
								className="mono"
								style={{
									fontSize: 10,
									color: "var(--muted)",
									textTransform: "uppercase",
									letterSpacing: "0.08em",
								}}
							>
								carousel · {carouselExpectedCount || 3} slides
							</span>
							<span className="bullet" />
							<span className="mono" style={{ fontSize: 10, color: "var(--muted-2)" }}>
								{carouselStatusLabel({
									expected: carouselExpectedCount,
									ready: carouselReadyBaseCount,
									composited: carouselReadyCompositeCount,
									generating: carouselGenerating,
									failed: carouselFailed,
								})}
							</span>
							{hasComposite && <BaseOverlayToggle value={view} onChange={setView} />}
						</div>
						{editing ? (
							<ArEditor {...editorProps} />
						) : (
							<div className="ar-text" style={{ fontSize: 13, textWrap: "pretty" }}>
								{draft.ar}
							</div>
						)}
						<div className="en-text">{draft.en}</div>
						<div className="row gap-2" style={{ marginTop: "auto", flexWrap: "wrap" }}>
							{draft.concepts.map((c) => (
								<span key={c} className="concept-tag" style={{ height: 18, fontSize: 10, padding: "0 6px" }}>
									{c}
								</span>
							))}
						</div>
					</div>
				) : (
					<>
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
							{editing ? (
								<ArEditor {...editorProps} />
							) : (
								<div className="ar-text" style={{ fontSize: 14, textWrap: "pretty" }}>
									{draft.ar}
								</div>
							)}
							<div className="en-text">{draft.en}</div>
							<div className="row gap-2" style={{ marginTop: "auto", flexWrap: "wrap" }}>
								{draft.concepts.map((c) => (
									<span key={c} className="concept-tag" style={{ height: 18, fontSize: 10, padding: "0 6px" }}>
										{c}
									</span>
								))}
							</div>
						</div>
					</>
				)}
			</div>

			{(genError || (!isCarousel && asset?.state === "failed") || (isCarousel && carouselFailed > 0)) && (
				<div
					className="mono"
					style={{
						padding: "6px 12px",
						fontSize: 10.5,
						color: "var(--st-rejected-fg)",
						borderTop: "1px solid var(--border-faint)",
					}}
				>
					{genError ??
						(isCarousel
							? `${carouselFailed} slide${carouselFailed === 1 ? "" : "s"} failed`
							: (asset?.error ?? "image generation failed"))}
				</div>
			)}

			<div className="foot" style={{ position: "relative" }}>
				<div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
					{draft.chars} chars · AR
					{draft.postizStatus === "published" && draft.postizPermalink ? (
						<>
							{" · "}
							<a
								href={draft.postizPermalink}
								target="_blank"
								rel="noopener noreferrer"
								style={{ color: "var(--accent-ink)" }}
							>
								published ↗
							</a>
						</>
					) : draft.postizStatus === "publishing" ? (
						<>
							{" · "}
							<span style={{ color: "var(--accent-ink)" }}>publishing…</span>
						</>
					) : draft.postizStatus === "failed" ? (
						<>
							{" · "}
							<span style={{ color: "var(--st-rejected-fg)" }}>
								publish failed · {draft.postizError ?? "unknown"}
							</span>
						</>
					) : draft.scheduled ? (
						<>
							{" · "}
							<span style={{ color: "var(--accent-ink)" }}>scheduled {fmtDate(draft.scheduled)}</span>
						</>
					) : null}
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
							title={isCarousel ? "Generate carousel images" : "Generate image"}
						>
							{submitting ? (
								<>
									<Icons.Clock size={11} /> generating…
								</>
							) : (
								<>
									<Icons.Sparkle size={11} /> {isCarousel ? "Generate carousel images" : "Generate image"}
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
					{draft.state === "approved" &&
						(!draft.postizStatus || draft.postizStatus === "failed") &&
						(videoChannel ? (
							<button
								type="button"
								className="btn ghost xs"
								disabled
								title="video pending — use IG carousel instead"
							>
								<Icons.Film size={11} /> video pending
							</button>
						) : (
							<button
								type="button"
								className="btn accent xs"
								onClick={() => setSchedulerOpen((s) => !s)}
								title="Schedule publish via Postiz"
							>
								<Icons.Clock size={11} /> Schedule
							</button>
						))}
					{draft.postizStatus === "scheduled" && (
						<button type="button" className="btn ghost xs" onClick={onUnschedule} title="Cancel scheduled post">
							<Icons.X size={11} /> Unschedule
						</button>
					)}
					<button
						type="button"
						className="btn ghost xs"
						title={editLocked ?? "Edit AR (E)"}
						disabled={!!editLocked}
						onClick={() => {
							setEditDraft(draft.ar);
							setEditError(null);
							setEditing((e) => !e);
						}}
					>
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
				{schedulerOpen && (
					<SchedulePopover
						draftId={draft._id}
						channel={draft.channel}
						selection={view}
						onClose={() => setSchedulerOpen(false)}
						onScheduled={() => setSchedulerOpen(false)}
					/>
				)}
			</div>
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
