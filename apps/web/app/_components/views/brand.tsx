"use client";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Icons } from "../icons";
import { Chip, Select } from "../primitives";
import type { Channel } from "../types";
import { BrandPreviewSection } from "./brandPreviews";
import { DesignMdImport } from "./designMdImport";

const CHANNELS: { value: Channel; label: string }[] = [
	{ value: "x", label: "X" },
	{ value: "ig", label: "Instagram" },
	{ value: "ig-reel", label: "IG Reel" },
	{ value: "tiktok", label: "TikTok" },
	{ value: "yt-shorts", label: "YT Shorts" },
	{ value: "fb-page", label: "Facebook" },
	{ value: "linkedin-page", label: "LinkedIn" },
];

type Brand = Doc<"brands">;
type Tone = Brand["tone"];
type Design = Brand["design"];

function linesToArray(value: string): string[] {
	return value
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

const Field = ({ label, help, children }: { label: string; help?: string; children: ReactNode }) => (
	<div className="setting-row">
		<div>
			<div className="lbl">{label}</div>
			{help && <div className="hlp">{help}</div>}
		</div>
		<div>{children}</div>
	</div>
);

export const BrandView = () => {
	const brand = useQuery(api.brand.doc.getActive, {});
	const versions = useQuery(api.brand.doc.listVersions, {});
	const versionSummary = useQuery(api.brand.doc.listVersionsSummary, {});
	const currentFeedback = useQuery(
		api.feedback.index.summaryByBrand,
		brand ? { brandVersion: brand.version } : "skip",
	);
	const previousFeedback = useQuery(
		api.feedback.index.summaryByBrand,
		brand && brand.version > 1 ? { brandVersion: brand.version - 1 } : "skip",
	);
	const ensureActive = useMutation(api.brand.doc.ensureActive);
	const updateActive = useMutation(api.brand.doc.updateActive);
	const publishVersion = useMutation(api.brand.doc.publishVersion);

	const [promptChannel, setPromptChannel] = useState<Channel>("ig");
	const [publishNote, setPublishNote] = useState("");
	const [publishing, setPublishing] = useState(false);

	if (brand === undefined) {
		return (
			<div className="settings-view">
				<div className="empty-state">Loading brand config...</div>
			</div>
		);
	}

	if (brand === null) {
		return (
			<div className="settings-view">
				<div className="settings-group">
					<h3>Brand</h3>
					<p className="sub">Seed the active brand from the current hard-coded defaults.</p>
					<button type="button" className="btn accent" onClick={() => void ensureActive({})}>
						<Icons.Plus size={12} /> Initialize brand
					</button>
				</div>
			</div>
		);
	}

	const patchTone = (patch: Partial<Tone>) => {
		void updateActive({ tone: { ...brand.tone, ...patch } });
	};

	const patchDesign = (patch: Partial<Design>) => {
		void updateActive({ design: { ...brand.design, ...patch } });
	};

	const publish = async () => {
		setPublishing(true);
		try {
			await publishVersion({ note: publishNote.trim() || undefined });
			setPublishNote("");
		} finally {
			setPublishing(false);
		}
	};

	return (
		<div className="settings-view" style={{ maxWidth: 1120 }}>
			<div className="settings-group">
				<div className="row gap-2" style={{ justifyContent: "space-between", alignItems: "center" }}>
					<div>
						<h3>Brand</h3>
						<p className="sub">
							Active brand config read by draft, carousel, background-image, and baked-text generation.
						</p>
					</div>
					<div className="row gap-2">
						<Chip state="approved" label={`v${brand.version}`} />
						<span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>
							{versions?.length ?? 0} published versions
						</span>
					</div>
				</div>

				<Field label="Name">
					<input
						className="input"
						defaultValue={brand.name}
						onBlur={(e) => {
							const name = e.currentTarget.value.trim();
							if (name && name !== brand.name) void updateActive({ name });
						}}
					/>
				</Field>
			</div>

			<div className="brand-editor-grid">
				<div className="settings-group">
					<h3>Tone</h3>
					<p className="sub">Text voice, Arabic preset, and channel-specific tone guidance.</p>

					<Field label="Voice persona">
						<textarea
							className="input"
							defaultValue={brand.tone.voicePersona}
							rows={3}
							style={{ height: "auto", minHeight: 72, paddingTop: 8 }}
							onBlur={(e) => patchTone({ voicePersona: e.currentTarget.value.trim() })}
						/>
					</Field>
					<Field label="Register">
						<Select
							value={brand.tone.register}
							onChange={(register) => patchTone({ register: register as Tone["register"] })}
							options={[
								{ value: "formal", label: "Formal" },
								{ value: "casual", label: "Casual" },
								{ value: "playful", label: "Playful" },
							]}
						/>
					</Field>
					<Field label="Reading level">
						<Select
							value={brand.tone.readingLevel}
							onChange={(readingLevel) => patchTone({ readingLevel: readingLevel as Tone["readingLevel"] })}
							options={[
								{ value: "beginner", label: "Beginner" },
								{ value: "intermediate", label: "Intermediate" },
								{ value: "advanced", label: "Advanced" },
							]}
						/>
					</Field>
					<Field label="Max sentence">
						<input
							className="input"
							type="number"
							min={40}
							max={500}
							defaultValue={brand.tone.maxSentenceChars}
							onBlur={(e) => patchTone({ maxSentenceChars: Number(e.currentTarget.value) || 220 })}
						/>
					</Field>
					<Field label="Emoji policy">
						<Select
							value={brand.tone.emojiPolicy}
							onChange={(emojiPolicy) => patchTone({ emojiPolicy: emojiPolicy as Tone["emojiPolicy"] })}
							options={[
								{ value: "never", label: "Never" },
								{ value: "sparse", label: "Sparse" },
								{ value: "free", label: "Free" },
							]}
						/>
					</Field>
					<Field label="Do phrases" help="One phrase per line.">
						<textarea
							className="input"
							defaultValue={brand.tone.doPhrases.join("\n")}
							rows={4}
							style={{ height: "auto", minHeight: 92, paddingTop: 8 }}
							onBlur={(e) => patchTone({ doPhrases: linesToArray(e.currentTarget.value) })}
						/>
					</Field>
					<Field label="Don't phrases" help="One phrase per line.">
						<textarea
							className="input"
							defaultValue={brand.tone.dontPhrases.join("\n")}
							rows={4}
							style={{ height: "auto", minHeight: 92, paddingTop: 8 }}
							onBlur={(e) => patchTone({ dontPhrases: linesToArray(e.currentTarget.value) })}
						/>
					</Field>
					<Field label="Arabic preset">
						<Select
							value={brand.tone.activeArPreset}
							onChange={(activeArPreset) => patchTone({ activeArPreset })}
							options={Object.keys(brand.tone.arPresets).map((key) => ({ value: key, label: key }))}
						/>
					</Field>
					<Field label="Channel override">
						<div className="col gap-2">
							<Select
								value={promptChannel}
								onChange={(value) => setPromptChannel(value as Channel)}
								options={CHANNELS}
							/>
							<textarea
								key={`${brand._id}-${brand.updatedAt}-${promptChannel}`}
								className="input"
								defaultValue={brand.tone.channelOverrides?.[promptChannel] ?? ""}
								rows={3}
								style={{ height: "auto", minHeight: 72, paddingTop: 8 }}
								onBlur={(e) =>
									patchTone({
										channelOverrides: {
											...(brand.tone.channelOverrides ?? {}),
											[promptChannel]: e.currentTarget.value.trim(),
										},
									})
								}
							/>
						</div>
					</Field>
				</div>

				<div className="settings-group">
					<h3>Design</h3>
					<p className="sub">Palette, typography, image style, and baked-text chrome.</p>

					<Field label="Palette">
						<div className="col gap-2">
							{(["primary", "accent", "neutral", "background", "text"] as const).map((key) => (
								<label key={key} className="brand-design-row">
									<span
										style={{
											width: 18,
											height: 18,
											borderRadius: 4,
											border: "1px solid var(--border)",
											background: brand.design.palette[key].startsWith("#")
												? brand.design.palette[key]
												: "var(--surface-sunk)",
										}}
									/>
									<span className="mono" style={{ fontSize: 11 }}>
										{key}
									</span>
									<input
										className="input"
										defaultValue={brand.design.palette[key]}
										onBlur={(e) =>
											patchDesign({
												palette: { ...brand.design.palette, [key]: e.currentTarget.value.trim() },
											})
										}
									/>
								</label>
							))}
						</div>
					</Field>
					<Field label="Typography">
						<div className="col gap-2">
							{(["heading", "body", "mono"] as const).map((key) => (
								<label key={key} className="brand-design-row">
									<span aria-hidden />
									<span className="mono" style={{ fontSize: 11 }}>
										{key}
									</span>
									<input
										className="input"
										defaultValue={brand.design.typography[key]}
										onBlur={(e) =>
											patchDesign({
												typography: { ...brand.design.typography, [key]: e.currentTarget.value.trim() },
											})
										}
									/>
								</label>
							))}
						</div>
					</Field>
					<Field label="Chip text">
						<input
							className="input"
							defaultValue={brand.design.logoChipText}
							onBlur={(e) => patchDesign({ logoChipText: e.currentTarget.value.trim() })}
						/>
					</Field>
					<Field label="Footer">
						<div className="col gap-2">
							<input
								className="input"
								defaultValue={brand.design.footerText}
								onBlur={(e) => patchDesign({ footerText: e.currentTarget.value.trim() })}
							/>
							<input
								className="input"
								defaultValue={brand.design.footerUrl}
								onBlur={(e) => patchDesign({ footerUrl: e.currentTarget.value.trim() })}
							/>
						</div>
					</Field>
					<Field label="Layout">
						<div className="col gap-2">
							<Select
								value={brand.design.layout.chipPosition}
								onChange={(chipPosition) =>
									patchDesign({
										layout: {
											...brand.design.layout,
											chipPosition: chipPosition as Design["layout"]["chipPosition"],
										},
									})
								}
								options={[
									{ value: "top-left", label: "Chip top-left" },
									{ value: "top-right", label: "Chip top-right" },
								]}
							/>
							<Select
								value={brand.design.layout.footerPosition}
								onChange={(footerPosition) =>
									patchDesign({
										layout: {
											...brand.design.layout,
											footerPosition: footerPosition as Design["layout"]["footerPosition"],
										},
									})
								}
								options={[
									{ value: "bottom-left", label: "Footer bottom-left" },
									{ value: "bottom-right", label: "Footer bottom-right" },
								]}
							/>
							<input
								className="input"
								type="number"
								min={16}
								max={96}
								defaultValue={brand.design.layout.margins}
								onBlur={(e) =>
									patchDesign({
										layout: { ...brand.design.layout, margins: Number(e.currentTarget.value) || 48 },
									})
								}
							/>
						</div>
					</Field>
					<Field label="Image style">
						<textarea
							className="input"
							defaultValue={brand.design.imageStyleGuide}
							rows={5}
							style={{ height: "auto", minHeight: 116, paddingTop: 8 }}
							onBlur={(e) => patchDesign({ imageStyleGuide: e.currentTarget.value.trim() })}
						/>
					</Field>
					<Field label="Banned subjects" help="One subject per line.">
						<textarea
							className="input"
							defaultValue={brand.design.bannedSubjects.join("\n")}
							rows={4}
							style={{ height: "auto", minHeight: 92, paddingTop: 8 }}
							onBlur={(e) => patchDesign({ bannedSubjects: linesToArray(e.currentTarget.value) })}
						/>
					</Field>
				</div>
			</div>

			<DesignMdImport
				brand={brand}
				onApply={(patch) => {
					void updateActive(patch);
				}}
			/>

			<BrandPreviewSection brand={brand} channel={promptChannel} onChannelChange={setPromptChannel} />

			<div className="settings-group">
				<h3>Publish</h3>
				<p className="sub">
					Live generations use the edited brand now and tag runs with the last published version.
				</p>
				<div className="setting-row">
					<div>
						<div className="lbl">Publish v{brand.version + 1}</div>
						<div className="hlp">Creates an immutable snapshot and bumps the brand version.</div>
					</div>
					<div className="row gap-2" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
						<input
							className="input"
							placeholder="Optional version note"
							value={publishNote}
							onChange={(e) => setPublishNote(e.currentTarget.value)}
							style={{ flex: "1 1 200px", minWidth: 0, maxWidth: 280 }}
						/>
						<button
							type="button"
							className="btn accent"
							onClick={publish}
							disabled={publishing}
							style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}
						>
							<Icons.Check size={12} /> {publishing ? "Publishing..." : `Publish v${brand.version + 1}`}
						</button>
					</div>
				</div>
			</div>

			<div className="settings-group">
				<h3>Eval history</h3>
				<p className="sub">Approval rate, failure tags, and generation runs grouped by brand version.</p>
				<div className="setting-row">
					<div>
						<div className="lbl">Current vs previous</div>
						<div className="hlp">Based on explicit feedback captured in Drafts.</div>
					</div>
					<div className="row gap-3" style={{ flexWrap: "wrap" }}>
						<span className="mono" style={{ fontSize: 12 }}>
							v{brand.version}: {Math.round((currentFeedback?.approvalRate ?? 0) * 100)}% approval
						</span>
						<span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
							v{brand.version - 1}: {Math.round((previousFeedback?.approvalRate ?? 0) * 100)}% approval
						</span>
						<span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
							regenerate {Math.round((currentFeedback?.regenerateRate ?? 0) * 100)}%
						</span>
					</div>
				</div>
				<div className="setting-row">
					<div>
						<div className="lbl">Top failure tags</div>
					</div>
					<div className="row gap-2" style={{ flexWrap: "wrap" }}>
						{(currentFeedback?.topTags ?? []).length === 0 ? (
							<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
								no feedback yet
							</span>
						) : (
							currentFeedback?.topTags.map((tag) => (
								<span key={tag.tag} className="concept-tag">
									{tag.tag} · {tag.count}
								</span>
							))
						)}
					</div>
				</div>
				<div className="provider-tiles" style={{ maxWidth: "none", gridTemplateColumns: "repeat(4, 1fr)" }}>
					{(versionSummary ?? []).slice(0, 4).map((row) => (
						<div key={row.brandVersion} className="provider-tile">
							<div className="row gap-2" style={{ justifyContent: "space-between" }}>
								<strong>v{row.brandVersion}</strong>
								<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
									{row.runs} runs
								</span>
							</div>
							<div className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
								${row.cost.toFixed(4)}
							</div>
						</div>
					))}
					{(versionSummary ?? []).length === 0 && (
						<div className="provider-tile">
							<div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
								No brand-versioned runs yet.
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
