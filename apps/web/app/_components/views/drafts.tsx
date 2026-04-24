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
import { BaseOverlayToggle } from "./draftsBaseOverlayToggle";
import { CarouselStrip, carouselStatusLabel } from "./draftsCarousel";
import { ImageProviderPicker } from "./draftsImagePicker";
import {
	FALLBACK_OUTPUT_LANGUAGES,
	hasTranslation,
	LANGUAGE_LABELS,
	LanguageSwitcher,
	type OutputLanguage,
	textForLanguage,
} from "./draftsLanguages";
import { DraftMedia } from "./draftsMedia";
import { SchedulePopover } from "./draftsScheduler";
import { FeedbackControls } from "./feedbackControls";

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
	const updateText = useMutation(api.drafts.mutate.updateText);

	const loaded = drafts !== undefined;
	const rows = drafts ?? [];
	const filtered = channel === "all" ? rows : rows.filter((d) => d.channel === channel);
	const defaultImageProvider: ImageProvider = settings?.defaultImageProvider ?? "nano-banana";
	const outputLanguages = (settings?.outputLanguages ?? FALLBACK_OUTPUT_LANGUAGES).filter(
		(lang): lang is OutputLanguage => lang === "ar-khaleeji" || lang === "ar-msa" || lang === "ar-levantine",
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
							outputLanguages={outputLanguages}
							onApprove={() => approve({ id: d._id })}
							onReject={() => reject({ id: d._id })}
							onUnschedule={() => unschedule({ id: d._id })}
							onSaveText={(lang, text) => updateText({ id: d._id, lang, text })}
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
	outputLanguages,
	onApprove,
	onReject,
	onUnschedule,
	onSaveText,
}: {
	draft: Doc<"drafts">;
	defaultImageProvider: ImageProvider;
	outputLanguages: OutputLanguage[];
	onApprove: () => void;
	onReject: () => void;
	onUnschedule: () => void;
	onSaveText: (lang: OutputLanguage, text: string) => Promise<unknown>;
}) => {
	const variant = channelFrame(draft.channel);
	const videoChannel = isVideoChannel(draft.channel);

	const isCarousel = draft.mediaKind === "carousel";

	const asset = useQuery(api.mediaAssets.list.firstReadyByDraft, isCarousel ? "skip" : { draftId: draft._id });
	const baseAsset = useQuery(api.mediaAssets.list.baseReadyByDraft, isCarousel ? "skip" : { draftId: draft._id });
	const assetLoaded = isCarousel ? true : asset !== undefined;

	const generate = useAction(api.generate.image.action.generateForDraft);
	const generateCarousel = useAction(api.generate.image.carouselAction.generateCarouselForDraft);
	const bake = useAction(api.generate.image.bakedAction.bakedForDraft);
	const bakeCarousel = useAction(api.generate.image.bakedCarouselAction.bakedCarouselForDraft);
	const generateTranslation = useAction(api.generate.translate.generateTranslation);
	const [picker, setPicker] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [baking, setBaking] = useState(false);
	const [genError, setGenError] = useState<string | null>(null);
	const [view, setView] = useState<"overlay" | "base">("overlay");
	const [schedulerOpen, setSchedulerOpen] = useState(false);
	const [editing, setEditing] = useState(false);
	const [selectedLang, setSelectedLang] = useState<OutputLanguage>("en");
	const selectedText = textForLanguage(draft, selectedLang);
	const selectedChars = selectedText.length;
	const [editDraft, setEditDraft] = useState(selectedText);
	const [editError, setEditError] = useState<string | null>(null);
	const [editSaving, setEditSaving] = useState(false);
	const [translating, setTranslating] = useState<OutputLanguage | null>(null);
	const editLocked =
		!!draft.postizStatus && draft.postizStatus !== "failed"
			? `Copy locked while post is ${draft.postizStatus} — unschedule first`
			: null;

	const saveAr = async () => {
		setEditSaving(true);
		setEditError(null);
		try {
			await onSaveText(selectedLang, editDraft);
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
		dir: selectedLang === "en" ? ("ltr" as const) : ("rtl" as const),
		lang: selectedLang === "en" ? "en" : "ar",
	};

	const selectLanguage = async (lang: OutputLanguage) => {
		setEditing(false);
		setEditError(null);
		setSelectedLang(lang);
		const existing = textForLanguage(draft, lang);
		setEditDraft(existing);
		if (lang !== "en" && !hasTranslation(draft, lang)) {
			setTranslating(lang);
			try {
				const result = await generateTranslation({ draftId: draft._id, targetLang: lang });
				if (!result.ok) setGenError(result.error);
				else setEditDraft(result.text);
			} catch (err) {
				setGenError(err instanceof Error ? err.message : String(err));
			} finally {
				setTranslating(null);
			}
		}
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

	const runBake = async () => {
		setBaking(true);
		setGenError(null);
		try {
			const r = isCarousel
				? await bakeCarousel({ draftId: draft._id, targetLang: selectedLang })
				: await bake({ draftId: draft._id, targetLang: selectedLang });
			if (!r.ok) setGenError(r.error);
			else setView("overlay");
		} catch (err) {
			setGenError(err instanceof Error ? err.message : String(err));
		} finally {
			setBaking(false);
		}
	};

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
	const currentIsBase = !!asset && asset.state === "ready" && !asset.overlaidFrom;
	const carouselHasComposite = carouselReadyCompositeCount > 0;
	const carouselNeedsBake =
		isCarousel && carouselReadyBaseCount > 0 && carouselReadyCompositeCount < carouselReadyBaseCount;
	const showBakeButton = isCarousel ? carouselNeedsBake : !videoChannel && currentIsBase;
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
							<div
								className={selectedLang === "en" ? "en-text" : "ar-text"}
								style={{ fontSize: 13, textWrap: "pretty" }}
							>
								{selectedText || "Generate this language first."}
							</div>
						)}
						<LanguageSwitcher
							draft={draft}
							languages={outputLanguages}
							selected={selectedLang}
							onSelect={selectLanguage}
							translating={translating}
						/>
						<FeedbackControls targetKind="draft" targetId={draft._id} draftId={draft._id} compact />
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
								ar={selectedText}
								channel={draft.channel}
							/>
							{hasComposite && <BaseOverlayToggle value={view} onChange={setView} />}
							{displayedAsset && (
								<FeedbackControls
									targetKind="mediaAsset"
									targetId={displayedAsset._id}
									draftId={draft._id}
									compact
								/>
							)}
						</div>
						<div className="copy">
							{editing ? (
								<ArEditor {...editorProps} />
							) : (
								<div
									className={selectedLang === "en" ? "en-text" : "ar-text"}
									style={{ fontSize: 14, textWrap: "pretty" }}
								>
									{selectedText || "Generate this language first."}
								</div>
							)}
							<LanguageSwitcher
								draft={draft}
								languages={outputLanguages}
								selected={selectedLang}
								onSelect={selectLanguage}
								translating={translating}
							/>
							<FeedbackControls targetKind="draft" targetId={draft._id} draftId={draft._id} compact />
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
					{selectedChars} chars · {LANGUAGE_LABELS[selectedLang]}
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
					) : showBakeButton ? (
						<button
							type="button"
							className="btn xs"
							disabled={baking}
							onClick={runBake}
							title={`Overlay ${LANGUAGE_LABELS[selectedLang]} text via gpt-image-2`}
						>
							{baking ? (
								<>
									<Icons.Clock size={11} /> overlaying…
								</>
							) : (
								<>
									<Icons.Sparkle size={11} /> Overlay {LANGUAGE_LABELS[selectedLang]}
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
						title={editLocked ?? `Edit ${LANGUAGE_LABELS[selectedLang]} (E)`}
						disabled={!!editLocked}
						onClick={() => {
							setEditDraft(textForLanguage(draft, selectedLang));
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
						publishLang={selectedLang}
						onClose={() => setSchedulerOpen(false)}
						onScheduled={() => setSchedulerOpen(false)}
					/>
				)}
			</div>
		</div>
	);
};
