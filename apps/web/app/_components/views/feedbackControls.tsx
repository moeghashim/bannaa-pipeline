"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Icons } from "../icons";

type TargetKind = "draft" | "mediaAsset" | "carouselSlide";
type Rating = "up" | "down" | "neutral";

const TEXT_TAGS = ["tone-off", "too-long", "too-short", "factually-wrong", "wrong-language", "off-brand", "boring"];
const MEDIA_TAGS = [
	"off-brand",
	"text-wrong",
	"composition",
	"palette-off",
	"typography",
	"wrong-subject",
	"low-quality",
];

export const FeedbackControls = ({
	targetKind,
	targetId,
	draftId,
	compact,
}: {
	targetKind: TargetKind;
	targetId: string;
	draftId: Id<"drafts">;
	compact?: boolean;
}) => {
	const rows = useQuery(api.feedback.index.forTarget, { targetKind, targetId });
	const rate = useMutation(api.feedback.index.rate);
	const regenerateWithFeedback = useAction(api.feedback.regenerate.regenerateWithFeedback);
	const [open, setOpen] = useState<Rating | null>(null);
	const [tags, setTags] = useState<string[]>([]);
	const [note, setNote] = useState("");
	const current = rows?.[0];
	const allowedTags = targetKind === "mediaAsset" ? MEDIA_TAGS : TEXT_TAGS;

	const quickRate = (rating: Rating) => {
		if (rating === "up") {
			void rate({ targetKind, targetId, rating, tags: [], note: undefined });
			return;
		}
		setTags(current?.tags ?? []);
		setNote(current?.note ?? "");
		setOpen(rating);
	};

	const submit = (rating: Rating) => {
		if (rating === "neutral") {
			void regenerateWithFeedback({
				draftId,
				targetKind,
				targetId,
				tags,
				note: note.trim() || undefined,
			});
		} else {
			void rate({ targetKind, targetId, rating, tags, note: note.trim() || undefined });
		}
		setOpen(null);
		setTags([]);
		setNote("");
	};

	return (
		<div className="row gap-1" style={{ position: "relative", flexWrap: "wrap" }}>
			<button
				type="button"
				className={`btn ghost xs${current?.rating === "up" ? " active" : ""}`}
				onClick={() => quickRate("up")}
			>
				{compact ? "👍" : "👍"}
			</button>
			<button
				type="button"
				className={`btn ghost xs${current?.rating === "down" ? " active" : ""}`}
				onClick={() => quickRate("down")}
			>
				👎
			</button>
			<button type="button" className="btn ghost xs" onClick={() => quickRate("neutral")}>
				<Icons.Sparkle size={11} /> ↻
			</button>
			{current && (
				<span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
					{current.rating}
				</span>
			)}
			{open && (
				<div
					style={{
						position: "absolute",
						top: "calc(100% + 4px)",
						right: 0,
						zIndex: 7,
						width: 260,
						background: "var(--surface)",
						border: "1px solid var(--border)",
						borderRadius: "var(--r-md)",
						boxShadow: "var(--shadow-md)",
						padding: 10,
					}}
				>
					<div className="row gap-1" style={{ flexWrap: "wrap" }}>
						{allowedTags.map((tag) => (
							<button
								key={tag}
								type="button"
								className={`btn xs${tags.includes(tag) ? " accent" : " ghost"}`}
								onClick={() =>
									setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
								}
							>
								{tag}
							</button>
						))}
					</div>
					<textarea
						className="input"
						value={note}
						maxLength={280}
						rows={3}
						placeholder="Optional note"
						onChange={(e) => setNote(e.currentTarget.value)}
						style={{ height: "auto", marginTop: 8, paddingTop: 8 }}
					/>
					<div className="row gap-2" style={{ justifyContent: "flex-end", marginTop: 8 }}>
						<button type="button" className="btn ghost xs" onClick={() => setOpen(null)}>
							cancel
						</button>
						<button type="button" className="btn accent xs" onClick={() => submit(open)}>
							save
						</button>
					</div>
				</div>
			)}
		</div>
	);
};
