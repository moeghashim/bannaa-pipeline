"use client";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { HyperFrame } from "../primitives";

export const DraftMedia = ({
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
