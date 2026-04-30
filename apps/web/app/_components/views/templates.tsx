"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { fmtDate } from "../format";
import { Icons } from "../icons";
import type { Channel } from "../types";
import { CHANNELS, channelLabel } from "./draftsChannels";

export const TemplatesView = () => {
	const [channel, setChannel] = useState<Channel | "all">("all");
	const templates = useQuery(api.postTemplates.list.list, { channel });
	const candidates = useQuery(api.postTemplates.list.topCandidates, { channel });
	const update = useMutation(api.postTemplates.mutate.update);
	const [editing, setEditing] = useState<string | null>(null);
	const [draftName, setDraftName] = useState("");
	const [draftNotes, setDraftNotes] = useState("");

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
					</button>
				))}
			</div>
			<div className="settings-grid" style={{ alignItems: "start" }}>
				<section className="settings-panel">
					<div className="settings-panel-head">
						<div>
							<div className="section-h">Saved templates</div>
							<p>Reusable full-post structures, separate from opener hook templates.</p>
						</div>
					</div>
					<div className="col gap-2">
						{templates === undefined ? (
							<div className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>
								Loading templates…
							</div>
						) : templates.length === 0 ? (
							<div className="empty-state" style={{ padding: "42px 12px" }}>
								<div className="icn">
									<Icons.Edit size={18} />
								</div>
								<h4>No templates yet</h4>
							</div>
						) : (
							templates.map((template) => {
								const isEditing = editing === template._id;
								return (
									<div key={template._id} className="out-card" style={{ alignItems: "flex-start" }}>
										<div className="kind">{channelLabel(template.channel)}</div>
										<div style={{ flex: 1, minWidth: 0 }}>
											{isEditing ? (
												<>
													<input
														value={draftName}
														onChange={(event) => setDraftName(event.target.value)}
														style={{ width: "100%", marginBottom: 6 }}
													/>
													<textarea
														value={draftNotes}
														onChange={(event) => setDraftNotes(event.target.value)}
														rows={6}
														style={{ width: "100%", resize: "vertical" }}
													/>
												</>
											) : (
												<>
													<div style={{ fontWeight: 600, fontSize: 13 }}>{template.name}</div>
													<div
														className="mono"
														style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}
													>
														used {template.usageCount} · updated {fmtDate(template.updatedAt)}
														{template.sourceViews != null ? ` · ${template.sourceViews} views` : ""}
													</div>
													<div
														style={{
															fontSize: 12.5,
															lineHeight: 1.55,
															color: "var(--ink-2)",
															marginTop: 8,
														}}
													>
														{template.structureNotes}
													</div>
												</>
											)}
										</div>
										{isEditing ? (
											<button
												type="button"
												className="btn xs"
												onClick={() => {
													void update({
														id: template._id,
														name: draftName,
														structureNotes: draftNotes,
														channel: template.channel,
													});
													setEditing(null);
												}}
											>
												<Icons.Check size={11} sw={2} /> Save
											</button>
										) : (
											<button
												type="button"
												className="btn ghost xs"
												onClick={() => {
													setEditing(template._id);
													setDraftName(template.name);
													setDraftNotes(template.structureNotes);
												}}
											>
												<Icons.Edit size={11} />
											</button>
										)}
									</div>
								);
							})
						)}
					</div>
				</section>
				<section className="settings-panel">
					<div className="settings-panel-head">
						<div>
							<div className="section-h">Top performers</div>
							<p>Published drafts ranked by rating plus available engagement.</p>
						</div>
					</div>
					<div className="col gap-2">
						{(candidates ?? []).map((candidate) => (
							<div key={candidate.draftId} className="out-card" style={{ alignItems: "flex-start" }}>
								<div className="kind">{channelLabel(candidate.channel)}</div>
								<div style={{ flex: 1, minWidth: 0 }}>
									<div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 5 }}>
										score {Math.round(candidate.score)} · rating {candidate.rating ?? "n/a"} · views{" "}
										{candidate.views ?? "n/a"}
									</div>
									<div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
										{candidate.primary}
									</div>
								</div>
								{candidate.alreadyTemplate && (
									<span className="mono" style={{ fontSize: 10, color: "var(--accent-ink)" }}>
										saved
									</span>
								)}
							</div>
						))}
					</div>
				</section>
			</div>
		</div>
	);
};
