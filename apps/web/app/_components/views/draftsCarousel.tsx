"use client";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";

// Carousel helpers split out of drafts.tsx so the parent file stays under
// the 600-line cap. Kept as pure rendering + a tiny `ReadyImage`
// re-declaration — all state lives on the calling DraftCard.

export function carouselStatusLabel(input: {
	expected: number;
	ready: number;
	composited: number;
	generating: number;
	failed: number;
}): string {
	const { expected, ready, composited, generating, failed } = input;
	if (expected === 0) return "no slides";
	if (composited >= expected) return `${composited}/${expected} composited`;
	if (composited > 0) return `${composited}/${expected} composited · ${ready - composited} base`;
	if (ready >= expected) return `${ready}/${expected} base ready`;
	if (generating > 0) return `${ready}/${expected} ready · ${generating} generating`;
	if (failed > 0) return `${failed} failed`;
	if (ready > 0) return `${ready}/${expected} ready`;
	return `${expected} planned`;
}

export const CarouselStrip = ({
	script,
	slots,
	baseSlots,
	status,
	view,
}: {
	script: Doc<"carouselSlides">[];
	slots: Doc<"mediaAssets">[];
	baseSlots: Doc<"mediaAssets">[];
	status: Doc<"mediaAssets">[];
	view: "overlay" | "base";
}) => {
	const displaySlots = view === "base" ? baseSlots : slots;
	const assetByIndex = new Map<number, Doc<"mediaAssets">>();
	for (const a of displaySlots) assetByIndex.set(a.orderIndex, a);
	const generatingByIndex = new Set<number>();
	const failedByIndex = new Set<number>();
	for (const a of status) {
		if (a.state === "generating") generatingByIndex.add(a.orderIndex);
		if (a.state === "failed") failedByIndex.add(a.orderIndex);
	}

	const total = script.length;

	if (total === 0) {
		return (
			<div className="skeleton" style={{ width: "100%", height: 160, borderRadius: "var(--r-md)", flexShrink: 0 }} />
		);
	}

	return (
		<div
			style={{
				display: "flex",
				gap: 8,
				overflowX: "auto",
				paddingBottom: 4,
				scrollSnapType: "x mandatory",
			}}
		>
			{script.map((slide) => {
				const asset = assetByIndex.get(slide.orderIndex) ?? null;
				const isGenerating = generatingByIndex.has(slide.orderIndex);
				const isFailed = failedByIndex.has(slide.orderIndex);
				return (
					<CarouselSlide
						key={slide._id}
						slide={slide}
						asset={asset}
						total={total}
						isGenerating={isGenerating}
						isFailed={isFailed}
					/>
				);
			})}
		</div>
	);
};

const CarouselSlide = ({
	slide,
	asset,
	total,
	isGenerating,
	isFailed,
}: {
	slide: Doc<"carouselSlides">;
	asset: Doc<"mediaAssets"> | null;
	total: number;
	isGenerating: boolean;
	isFailed: boolean;
}) => {
	const size = 160;

	let body: ReactNode;
	if (asset?.state === "ready" && asset.storageId) {
		body = <CarouselReadyImage storageId={asset.storageId} size={size} alt={slide.imagePrompt.slice(0, 80)} />;
	} else if (isGenerating) {
		body = (
			<div
				className="skeleton"
				style={{ width: size, height: size, flexShrink: 0, position: "relative", overflow: "hidden" }}
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
	} else if (isFailed) {
		body = (
			<div
				style={{
					width: size,
					height: size,
					flexShrink: 0,
					borderRadius: "var(--r-md)",
					border: "1px solid var(--border)",
					background: "var(--surface-2)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 10,
					color: "var(--st-rejected-fg)",
				}}
				className="mono"
			>
				failed
			</div>
		);
	} else {
		body = (
			<div
				className="skeleton"
				style={{
					width: size,
					height: size,
					flexShrink: 0,
					borderRadius: "var(--r-md)",
					border: "1px dashed var(--border-faint)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 10,
					color: "var(--muted)",
					textAlign: "center",
					padding: "0 12px",
				}}
			>
				planned
			</div>
		);
	}

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 4,
				flexShrink: 0,
				width: size,
				scrollSnapAlign: "start",
				position: "relative",
			}}
		>
			<div style={{ position: "relative" }}>
				{body}
				<span
					className="mono"
					style={{
						position: "absolute",
						top: 6,
						right: 6,
						background: "rgba(0,0,0,0.55)",
						color: "#fff8ec",
						padding: "2px 6px",
						borderRadius: "var(--r-sm)",
						fontSize: 10,
						letterSpacing: "0.08em",
					}}
				>
					{slide.orderIndex}/{total}
				</span>
			</div>
			<div
				className="ar-text"
				dir="rtl"
				lang="ar"
				style={{ fontSize: 11, lineHeight: 1.35, textWrap: "pretty", color: "var(--ink-2)" }}
			>
				{slide.primary ?? slide.ar}
			</div>
		</div>
	);
};

const CarouselReadyImage = ({ storageId, size, alt }: { storageId: Id<"_storage">; size: number; alt: string }) => {
	const url = useQuery(api.mediaAssets.url.resolveUrl, { storageId });
	if (!url) return <div className="skeleton" style={{ width: size, height: size, flexShrink: 0 }} />;
	return (
		// biome-ignore lint/performance/noImgElement: Convex storage URLs are short-lived, not Next.js-optimizable
		<img
			src={url}
			alt={alt}
			width={size}
			height={size}
			style={{
				width: size,
				height: size,
				objectFit: "cover",
				borderRadius: "var(--r-md)",
				flexShrink: 0,
			}}
		/>
	);
};
