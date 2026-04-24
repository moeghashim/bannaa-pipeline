"use client";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";

export const DraftMedia = ({
	asset,
	assetLoaded,
	variant,
}: {
	asset: Doc<"mediaAssets"> | null;
	assetLoaded: boolean;
	variant: "square" | "vertical";
	ar?: string;
	channel?: string;
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

	// No asset (or failed) — show a dashed placeholder.
	return (
		<div
			className="skeleton"
			style={{
				width: w,
				height: h,
				flexShrink: 0,
				borderRadius: "var(--r-md)",
				border: "1px dashed var(--border-faint)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: 10,
				color: "var(--muted)",
			}}
		>
			no image yet
		</div>
	);
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
