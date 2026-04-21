"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Icons } from "../icons";
import { Chip } from "../primitives";

const PROVIDERS = [
	{ k: "glm" as const, name: "GLM 5.1", note: "fast · Khaleeji-friendly" },
	{ k: "claude" as const, name: "Claude Sonnet 4.6", note: "highest quality AR" },
	{ k: "openrouter" as const, name: "OpenRouter", note: "route to any frontier model" },
];

export const SettingsView = () => {
	const settings = useQuery(api.settings.doc.get, {});
	const setDefaultProvider = useMutation(api.settings.doc.setDefaultProvider);
	const active = settings?.defaultProvider ?? "glm";

	return (
		<div className="settings-view">
			<div className="settings-group">
				<h3>LLM provider</h3>
				<p className="sub">
					Default provider used for every analysis. Per-item override is not supported — switch the global default
					here.
				</p>
				<div className="provider-tiles">
					{PROVIDERS.map((p) => (
						<button
							key={p.k}
							type="button"
							className={`provider-tile${active === p.k ? " active" : ""}`}
							onClick={() => {
								if (active !== p.k) {
									void setDefaultProvider({ provider: p.k });
								}
							}}
						>
							<div className="row gap-2" style={{ marginBottom: 6, justifyContent: "space-between" }}>
								<span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</span>
								{active === p.k && <Icons.Check size={13} sw={2} style={{ color: "var(--accent-ink)" }} />}
							</div>
							<div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
								{p.note}
							</div>
						</button>
					))}
				</div>
			</div>

			<div className="settings-group">
				<h3>Connections</h3>
				<p className="sub">Credentials for the pipeline's upstream and downstream hops.</p>
				<div className="setting-row">
					<div>
						<div className="lbl">X (bookmarks)</div>
						<div className="hlp">Cron reads your bookmarks every 15 min.</div>
					</div>
					<div className="row gap-2">
						<Chip state="approved" label="connected" />
						<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
							@operator · expires in 62 days
						</span>
					</div>
				</div>
				<div className="setting-row">
					<div>
						<div className="lbl">YouTube</div>
						<div className="hlp">Channels and watch-later ingestion.</div>
					</div>
					<div className="row gap-2">
						<Chip state="approved" label="connected" />
						<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
							3 subscriptions monitored
						</span>
					</div>
				</div>
				<div className="setting-row">
					<div>
						<div className="lbl">Resend</div>
						<div className="hlp">Newsletter delivery.</div>
					</div>
					<div className="row gap-2">
						<Chip state="approved" label="connected" />
						<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
							list · bannaa weekly · 2,184 subscribers
						</span>
					</div>
				</div>
				<div className="setting-row">
					<div>
						<div className="lbl">Postiz</div>
						<div className="hlp">Social scheduling (X / IG / TikTok / YT / FB Page / LinkedIn Page).</div>
					</div>
					<div className="row gap-2">
						<Chip state="analyzing" label="reconnecting" />
						<button type="button" className="btn xs">
							Reauth
						</button>
					</div>
				</div>
				<div className="setting-row">
					<div>
						<div className="lbl">GitHub</div>
						<div className="hlp">PRs against bannaa.co content repo.</div>
					</div>
					<div className="row gap-2">
						<Chip state="approved" label="connected" />
						<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
							bannaa/bannaa.co · main
						</span>
					</div>
				</div>
			</div>

			<div className="settings-group">
				<h3>Cron schedule</h3>
				<p className="sub">Automated ingestion and analysis jobs.</p>
				<div className="setting-row">
					<div>
						<div className="lbl">X bookmarks sync</div>
					</div>
					<div className="row gap-2">
						<span className="mono" style={{ fontSize: 12 }}>
							every 15 min
						</span>
						<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
							next in 8m
						</span>
					</div>
				</div>
				<div className="setting-row">
					<div>
						<div className="lbl">YouTube sync</div>
					</div>
					<div className="row gap-2">
						<span className="mono" style={{ fontSize: 12 }}>
							hourly
						</span>
					</div>
				</div>
				<div className="setting-row">
					<div>
						<div className="lbl">Auto-analyze new items</div>
						<div className="hlp">If on, items are analyzed as soon as they arrive.</div>
					</div>
					<div>
						<label className="row gap-2" style={{ fontSize: 12 }}>
							<input type="checkbox" defaultChecked style={{ accentColor: "var(--accent)" }} />
							Enabled · budget cap <span className="mono">$6.00/day</span>
						</label>
					</div>
				</div>
			</div>

			<div className="settings-group">
				<h3>Content scope</h3>
				<p className="sub">Strict AI-education scope. Three tracks, 94 concepts, 38 templates.</p>
				<div className="setting-row">
					<div>
						<div className="lbl">Tracks</div>
					</div>
					<div className="row gap-2" style={{ flexWrap: "wrap" }}>
						{["Foundations", "Agents", "Media"].map((t) => (
							<span key={t} className="concept-tag">
								{t}
							</span>
						))}
					</div>
				</div>
				<div className="setting-row">
					<div>
						<div className="lbl">Ontology</div>
					</div>
					<div className="row gap-2">
						<span className="mono" style={{ fontSize: 12 }}>
							94 concepts · 38 templates
						</span>
						<button type="button" className="btn xs">
							Edit
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
