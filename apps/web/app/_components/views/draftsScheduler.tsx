"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useState } from "react";
import { useMountEffect } from "../../../lib/use-mount-effect";
import { fmtDate } from "../format";
import { Icons } from "../icons";
import type { Channel } from "../types";

// Per-channel Postiz provider match so we can filter the integration
// picker down to the socials that can actually serve this draft.
const CHANNEL_TO_POSTIZ: Partial<Record<Channel, string>> = {
	x: "x",
	ig: "instagram",
	"ig-reel": "instagram",
	tiktok: "tiktok",
	"yt-shorts": "youtube",
	"fb-page": "facebook",
	"linkedin-page": "linkedin",
};

// Default scheduled time = 1h from now, rounded up to the next :00 or :30.
const defaultSlotMs = (): number => {
	const now = Date.now() + 60 * 60 * 1000;
	const d = new Date(now);
	const minutes = d.getMinutes();
	d.setMinutes(minutes < 30 ? 30 : 60, 0, 0);
	return d.getTime();
};

// Convert unix ms ↔ value suitable for <input type="datetime-local">
const msToInput = (ms: number): string => {
	const d = new Date(ms);
	const pad = (n: number) => n.toString().padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const inputToMs = (v: string): number => new Date(v).getTime();

type Integration = {
	id: string;
	name: string;
	providerIdentifier: string;
	picture: string | null;
	disabled: boolean;
};

export const SchedulePopover = ({
	draftId,
	channel,
	selection,
	onClose,
	onScheduled,
}: {
	draftId: Id<"drafts">;
	channel: Channel;
	selection: "base" | "overlay";
	onClose: () => void;
	onScheduled: (scheduledAt: number) => void;
}) => {
	const listIntegrations = useAction(api.publish.integrations.listPostizIntegrations);
	const scheduleAction = useAction(api.publish.scheduleDraft.scheduleDraft);
	const [integrations, setIntegrations] = useState<Integration[] | null>(null);
	const [integrationsError, setIntegrationsError] = useState<string | null>(null);
	const [integrationId, setIntegrationId] = useState<string | null>(null);
	const [when, setWhen] = useState<string>(msToInput(defaultSlotMs()));
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	useMountEffect(() => {
		let cancelled = false;
		listIntegrations({})
			.then((r) => {
				if (cancelled) return;
				if (!r.ok) {
					setIntegrationsError(r.error);
					return;
				}
				const wanted = CHANNEL_TO_POSTIZ[channel];
				const filtered = wanted
					? r.integrations.filter((i) => i.providerIdentifier === wanted && !i.disabled)
					: r.integrations.filter((i) => !i.disabled);
				setIntegrations(filtered);
				setIntegrationId(filtered[0]?.id ?? null);
			})
			.catch((err) => {
				if (!cancelled) setIntegrationsError(err instanceof Error ? err.message : String(err));
			});
		return () => {
			cancelled = true;
		};
	});

	const submit = async () => {
		if (!integrationId) return;
		const scheduledAt = inputToMs(when);
		if (!Number.isFinite(scheduledAt) || scheduledAt < Date.now()) {
			setSubmitError("Pick a time in the future");
			return;
		}
		setSubmitting(true);
		setSubmitError(null);
		try {
			const r = await scheduleAction({ draftId, scheduledAt, selection, integrationId });
			if (!r.ok) {
				setSubmitError(r.error);
				return;
			}
			onScheduled(r.scheduledAt);
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div
			role="dialog"
			aria-label="Schedule publish"
			style={{
				position: "absolute",
				bottom: "calc(100% + 4px)",
				right: 0,
				zIndex: 6,
				background: "var(--surface)",
				border: "1px solid var(--border)",
				borderRadius: "var(--r-md)",
				padding: 10,
				width: 280,
				boxShadow: "var(--shadow-md)",
				display: "flex",
				flexDirection: "column",
				gap: 8,
			}}
		>
			<div
				className="mono"
				style={{
					fontSize: 10,
					color: "var(--muted)",
					textTransform: "uppercase",
					letterSpacing: "0.08em",
				}}
			>
				schedule · {selection}
			</div>

			{integrationsError ? (
				<div className="mono" style={{ fontSize: 11, color: "var(--st-rejected-fg)" }}>
					{integrationsError}
				</div>
			) : integrations === null ? (
				<div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
					loading integrations…
				</div>
			) : integrations.length === 0 ? (
				<div className="mono" style={{ fontSize: 11, color: "var(--st-rejected-fg)" }}>
					No {CHANNEL_TO_POSTIZ[channel] ?? "matching"} socials connected in Postiz. Link one first.
				</div>
			) : (
				<>
					<label
						className="mono"
						style={{ fontSize: 10, color: "var(--muted-2)", display: "flex", flexDirection: "column", gap: 4 }}
					>
						account
						<select
							value={integrationId ?? ""}
							onChange={(e) => setIntegrationId(e.target.value)}
							style={{
								padding: "6px 8px",
								fontSize: 12,
								border: "1px solid var(--border)",
								borderRadius: "var(--r-sm)",
								background: "var(--surface)",
								color: "var(--ink)",
							}}
						>
							{integrations.map((i) => (
								<option key={i.id} value={i.id}>
									{i.name} ({i.providerIdentifier})
								</option>
							))}
						</select>
					</label>

					<label
						className="mono"
						style={{ fontSize: 10, color: "var(--muted-2)", display: "flex", flexDirection: "column", gap: 4 }}
					>
						when
						<input
							type="datetime-local"
							value={when}
							onChange={(e) => setWhen(e.target.value)}
							style={{
								padding: "6px 8px",
								fontSize: 12,
								border: "1px solid var(--border)",
								borderRadius: "var(--r-sm)",
								background: "var(--surface)",
								color: "var(--ink)",
							}}
						/>
					</label>

					<div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
						will publish {fmtDate(inputToMs(when))} local
					</div>

					{submitError && (
						<div className="mono" style={{ fontSize: 10.5, color: "var(--st-rejected-fg)" }}>
							{submitError}
						</div>
					)}

					<div className="row gap-2" style={{ justifyContent: "flex-end" }}>
						<button type="button" className="btn ghost xs" onClick={onClose}>
							cancel
						</button>
						<button
							type="button"
							className="btn accent xs"
							disabled={submitting || !integrationId}
							onClick={submit}
						>
							{submitting ? (
								<>
									<Icons.Clock size={11} /> scheduling…
								</>
							) : (
								<>
									<Icons.Sparkle size={11} /> Schedule
								</>
							)}
						</button>
					</div>
				</>
			)}
		</div>
	);
};
