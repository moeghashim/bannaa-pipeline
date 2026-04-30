"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useState } from "react";
import { Icons } from "../icons";
import type { Channel } from "../types";
import { TemplatePicker } from "./templatePicker";

const KIND_TO_CHANNEL: Record<"tweet" | "reel" | "website", Channel | null> = {
	tweet: "x",
	reel: "ig-reel",
	website: null,
};

export const PromoteRow = ({
	analysisId,
	kind,
	hook,
	outputIndex,
}: {
	analysisId: string;
	kind: string;
	hook: string;
	outputIndex: number;
}) => {
	const promote = useAction(api.generate.draft.fromAnalysisOutput);
	const [postTemplateId, setPostTemplateId] = useState<Id<"postTemplates"> | null>(null);
	const [status, setStatus] = useState<"idle" | "promoting" | "done" | "error">("idle");
	const [message, setMessage] = useState<string | null>(null);

	const channel = kind === "tweet" || kind === "reel" || kind === "website" ? KIND_TO_CHANNEL[kind] : null;

	const onClick = async () => {
		if (!channel) return;
		setStatus("promoting");
		setMessage(null);
		try {
			const res = await promote({
				analysisId: analysisId as Id<"analyses">,
				channel,
				outputIndex,
				postTemplateId: postTemplateId ?? undefined,
			});
			if (res.ok) {
				setStatus("done");
				setMessage(`drafted on ${channel}`);
			} else {
				setStatus("error");
				setMessage(res.error);
			}
		} catch (err) {
			setStatus("error");
			setMessage(err instanceof Error ? err.message : String(err));
		}
	};

	return (
		<div className="out-card">
			<div className="kind">{kind}</div>
			<div style={{ flex: 1, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
				{hook}
				{message && (
					<div
						className="mono"
						style={{
							marginTop: 6,
							fontSize: 10.5,
							color: status === "error" ? "var(--st-rejected-fg)" : "var(--accent-ink)",
						}}
					>
						{message}
					</div>
				)}
			</div>
			{channel ? (
				<>
					<TemplatePicker
						channel={channel}
						value={postTemplateId}
						onChange={setPostTemplateId}
						disabled={status === "promoting" || status === "done"}
					/>
					<button
						type="button"
						className="btn xs"
						onClick={onClick}
						disabled={status === "promoting" || status === "done"}
					>
						{status === "promoting" ? (
							<>
								<Icons.Clock size={11} /> promoting…
							</>
						) : status === "done" ? (
							<>
								<Icons.Check size={11} sw={2} /> drafted
							</>
						) : (
							<>
								<Icons.Arrow size={11} /> Promote
							</>
						)}
					</button>
				</>
			) : (
				<button type="button" className="btn xs" disabled title="Website proposals come in Phase 3">
					<Icons.Arrow size={11} /> Promote
				</button>
			)}
		</div>
	);
};

const SLIDE_OPTIONS: number[] = [3, 4, 5];

export const PromoteCarouselRow = ({
	analysisId,
	onOpenDrafts,
}: {
	analysisId: string;
	onOpenDrafts?: (channel: string) => void;
}) => {
	const promoteCarousel = useAction(api.generate.carousel.fromAnalysis);
	const [slideCount, setSlideCount] = useState<number>(3);
	const [postTemplateId, setPostTemplateId] = useState<Id<"postTemplates"> | null>(null);
	const [status, setStatus] = useState<"idle" | "promoting" | "done" | "error">("idle");
	const [message, setMessage] = useState<string | null>(null);

	const onClick = async () => {
		setStatus("promoting");
		setMessage(null);
		try {
			const res = await promoteCarousel({
				analysisId: analysisId as Id<"analyses">,
				slideCount,
				postTemplateId: postTemplateId ?? undefined,
			});
			if (res.ok) {
				setStatus("done");
				setMessage(`drafted carousel (${res.slideCount} slides)`);
				if (onOpenDrafts) {
					setTimeout(() => onOpenDrafts("ig"), 500);
				}
			} else {
				setStatus("error");
				setMessage(res.error);
			}
		} catch (err) {
			setStatus("error");
			setMessage(err instanceof Error ? err.message : String(err));
		}
	};

	return (
		<div className="out-card">
			<div className="kind">carousel</div>
			<div style={{ flex: 1, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
				IG feed carousel with a shared style anchor across slides.
				{message && (
					<div
						className="mono"
						style={{
							marginTop: 6,
							fontSize: 10.5,
							color: status === "error" ? "var(--st-rejected-fg)" : "var(--accent-ink)",
						}}
					>
						{message}
					</div>
				)}
			</div>
			<div role="group" aria-label="Slide count" className="filter-seg" style={{ fontSize: 11, marginRight: 8 }}>
				{SLIDE_OPTIONS.map((n) => (
					<button
						key={n}
						type="button"
						className={slideCount === n ? "active" : ""}
						onClick={() => setSlideCount(n)}
						disabled={status === "promoting" || status === "done"}
					>
						{n}
					</button>
				))}
			</div>
			<TemplatePicker
				channel="ig"
				value={postTemplateId}
				onChange={setPostTemplateId}
				disabled={status === "promoting" || status === "done"}
			/>
			<button
				type="button"
				className="btn xs"
				onClick={onClick}
				disabled={status === "promoting" || status === "done"}
				title="Promote as IG carousel"
			>
				{status === "promoting" ? (
					<>
						<Icons.Clock size={11} /> promoting…
					</>
				) : status === "done" ? (
					<>
						<Icons.Check size={11} sw={2} /> drafted
					</>
				) : (
					<>
						<Icons.Arrow size={11} /> Promote as IG carousel
					</>
				)}
			</button>
		</div>
	);
};
