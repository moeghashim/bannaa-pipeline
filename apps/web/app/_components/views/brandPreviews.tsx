"use client";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useState } from "react";
import { Icons } from "../icons";
import { Select } from "../primitives";
import type { Channel } from "../types";

type Brand = Doc<"brands">;

const CHANNELS: { value: Channel; label: string }[] = [
	{ value: "x", label: "X" },
	{ value: "ig", label: "Instagram" },
	{ value: "ig-reel", label: "IG Reel" },
	{ value: "tiktok", label: "TikTok" },
	{ value: "yt-shorts", label: "YT Shorts" },
	{ value: "fb-page", label: "Facebook" },
	{ value: "linkedin-page", label: "LinkedIn" },
];

function renderBrandPrompt(brand: Brand, channel: Channel): string {
	const override = brand.tone.channelOverrides?.[channel];
	const arPreset = brand.tone.arPresets[brand.tone.activeArPreset];
	const doPhrases = brand.tone.doPhrases.length > 0 ? brand.tone.doPhrases.join(", ") : "(none)";
	const dontPhrases = brand.tone.dontPhrases.length > 0 ? brand.tone.dontPhrases.join(", ") : "(none)";

	return [
		`Active brand: ${brand.name}`,
		`Voice persona: ${brand.tone.voicePersona}`,
		`Register: ${brand.tone.register}`,
		`Reading level: ${brand.tone.readingLevel}`,
		`Max sentence length: ${brand.tone.maxSentenceChars} characters`,
		`Emoji policy: ${brand.tone.emojiPolicy}`,
		`Preferred phrases: ${doPhrases}`,
		`Avoid phrases: ${dontPhrases}`,
		override ? `Channel tone override: ${override}` : "Channel tone override: (none)",
		arPreset ? `Arabic voice preset: ${arPreset}` : `Arabic voice preset key: ${brand.tone.activeArPreset}`,
	].join("\n");
}

export const BrandPreviewSection = ({
	brand,
	channel,
	onChannelChange,
}: {
	brand: Brand;
	channel: Channel;
	onChannelChange: (channel: Channel) => void;
}) => {
	const previewDraft = useAction(api.brand.preview.previewDraft);
	const previewBakedImage = useAction(api.brand.preview.previewBakedImage);
	const [systemPrompt, setSystemPrompt] = useState("");
	const [draftState, setDraftState] = useState<
		| { status: "idle" }
		| { status: "loading" }
		| { status: "ready"; primary: string; cost: number; model: string }
		| { status: "error"; error: string }
	>({ status: "idle" });
	const [imageState, setImageState] = useState<
		| { status: "idle" }
		| { status: "loading" }
		| { status: "ready"; url: string | null; cached: boolean; cost: number; model: string }
		| { status: "error"; error: string }
	>({ status: "idle" });

	const runDraftPreview = async () => {
		setDraftState({ status: "loading" });
		const result = await previewDraft({ channel });
		if (result.ok) {
			setDraftState({
				status: "ready",
				primary: result.primary,
				cost: result.cost,
				model: result.model,
			});
		} else {
			setDraftState({ status: "error", error: result.error });
		}
	};

	const runImagePreview = async () => {
		setImageState({ status: "loading" });
		const result = await previewBakedImage({});
		if (result.ok) {
			setImageState({
				status: "ready",
				url: result.url,
				cached: result.cached,
				cost: result.cost,
				model: result.model,
			});
		} else {
			setImageState({ status: "error", error: result.error });
		}
	};

	return (
		<div className="settings-group">
			<h3>Previews</h3>
			<p className="sub">Run the current brand through the same prompt path used by generation.</p>
			<div className="setting-row">
				<div>
					<div className="lbl">Preview channel</div>
					<div className="hlp">Used for the system prompt and live draft preview.</div>
				</div>
				<Select value={channel} onChange={(value) => onChannelChange(value as Channel)} options={CHANNELS} />
			</div>
			<div className="setting-row">
				<div>
					<div className="lbl">System prompt</div>
					<div className="hlp">No provider call.</div>
				</div>
				<div className="col gap-2">
					<button
						type="button"
						className="btn sm"
						onClick={() => setSystemPrompt(renderBrandPrompt(brand, channel))}
					>
						<Icons.Sparkle size={12} /> Preview system prompt
					</button>
					{systemPrompt && <PreviewBlock>{systemPrompt}</PreviewBlock>}
				</div>
			</div>
			<div className="setting-row">
				<div>
					<div className="lbl">Draft preview</div>
					<div className="hlp">Runs the current LLM provider against a canned analysis fixture.</div>
				</div>
				<div className="col gap-2">
					<button
						type="button"
						className="btn sm"
						onClick={runDraftPreview}
						disabled={draftState.status === "loading"}
					>
						<Icons.Play size={12} /> {draftState.status === "loading" ? "Generating..." : "Preview draft"}
					</button>
					{draftState.status === "ready" && (
						<PreviewBlock>
							{`EN\n${draftState.primary}\n\n${draftState.model} · $${draftState.cost.toFixed(4)}`}
						</PreviewBlock>
					)}
					{draftState.status === "error" && <ErrorText>{draftState.error}</ErrorText>}
				</div>
			</div>
			<div className="setting-row">
				<div>
					<div className="lbl">Baked image preview</div>
					<div className="hlp">Uses gpt-image-2 and caches identical design inputs.</div>
				</div>
				<div className="col gap-2">
					<button
						type="button"
						className="btn sm"
						onClick={runImagePreview}
						disabled={imageState.status === "loading"}
					>
						<Icons.Play size={12} /> {imageState.status === "loading" ? "Rendering..." : "Preview baked image"}
					</button>
					{imageState.status === "ready" && (
						<div className="col gap-2">
							<div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
								{imageState.cached ? "cached" : "rendered"} · {imageState.model} · ${imageState.cost.toFixed(4)}
							</div>
							{imageState.url && (
								// biome-ignore lint/performance/noImgElement: Convex storage URLs are short-lived.
								<img
									src={imageState.url}
									alt="Brand baked preview"
									style={{
										width: "100%",
										maxWidth: 360,
										aspectRatio: "1 / 1",
										objectFit: "cover",
										borderRadius: "var(--r-md)",
										border: "1px solid var(--border)",
									}}
								/>
							)}
						</div>
					)}
					{imageState.status === "error" && <ErrorText>{imageState.error}</ErrorText>}
				</div>
			</div>
		</div>
	);
};

const PreviewBlock = ({ children }: { children: string }) => (
	<pre
		className="mono"
		style={{
			margin: 0,
			whiteSpace: "pre-wrap",
			fontSize: 11,
			color: "var(--ink)",
			background: "var(--surface-sunk)",
			border: "1px solid var(--border)",
			borderRadius: "var(--r-md)",
			padding: 10,
		}}
	>
		{children}
	</pre>
);

const ErrorText = ({ children }: { children: string }) => (
	<div className="mono" style={{ fontSize: 11, color: "var(--st-rejected-fg)" }}>
		{children}
	</div>
);
