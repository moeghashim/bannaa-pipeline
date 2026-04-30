"use client";

import { api } from "@convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useMountEffect } from "../../../lib/use-mount-effect";
import { Icons } from "../icons";
import { Chip } from "../primitives";
import type { ImageProvider } from "../types";
import { SettingsBrandSection } from "./settingsBrand";
import { SettingsOverlayModelSection } from "./settingsOverlayModel";
import { SettingsPrimaryLanguageSection } from "./settingsPrimaryLanguage";
import { SettingsTranslationTargetsSection } from "./settingsTranslationTargets";

function fmtRelative(ms: number | undefined): string {
	if (!ms) return "never";
	const diff = Math.max(0, Date.now() - ms) / 1000;
	if (diff < 60) return `${Math.floor(diff)}s ago`;
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	return `${Math.floor(diff / 86400)}d ago`;
}

const PROVIDERS = [
	{ k: "glm" as const, name: "GLM 5.1", note: "fast · multilingual" },
	{ k: "claude" as const, name: "Claude Sonnet 4.6", note: "highest quality AR" },
	{ k: "openrouter" as const, name: "OpenRouter", note: "route to any frontier model" },
	{ k: "deepseek" as const, name: "DeepSeek V4 Pro", note: "cost-efficient open weights" },
];

const IMAGE_PROVIDERS: { k: ImageProvider; name: string; note: string; envVar: string }[] = [
	{
		k: "nano-banana",
		name: "Nano Banana",
		note: "Google Gemini 2.5 Flash Image · ~$0.04",
		envVar: "GOOGLE_API_KEY",
	},
	{ k: "gpt-image", name: "GPT Image", note: "OpenAI gpt-image-1 · ~$0.04", envVar: "OPENAI_API_KEY" },
	{ k: "grok", name: "Grok", note: "xAI grok-2-image · ~$0.07", envVar: "GROK_API_KEY" },
	{ k: "ideogram", name: "Ideogram", note: "Ideogram v3 · ~$0.08", envVar: "IDEOGRAM_API_KEY" },
	{
		k: "openrouter",
		name: "OpenRouter",
		note: "routes to image-capable models · ~$0.04",
		envVar: "OPENROUTER_API_KEY",
	},
];

type ImageKeys = {
	google: boolean;
	openai: boolean;
	grok: boolean;
	ideogram: boolean;
	openrouter: boolean;
};

const ImageProviderSection = () => {
	const settings = useQuery(api.settings.doc.get, {});
	const setDefaultImageProvider = useMutation(api.settings.doc.setDefaultImageProvider);
	const imageKeys = useAction(api.env.imageKeys.imageKeysPresent);

	const active: ImageProvider = settings?.defaultImageProvider ?? "nano-banana";
	const [keys, setKeys] = useState<ImageKeys | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useMountEffect(() => {
		let cancelled = false;
		imageKeys({})
			.then((k) => {
				if (!cancelled) setKeys(k);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : String(err));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	});

	const keyFor = (envVar: string): boolean => {
		if (!keys) return false;
		if (envVar === "GOOGLE_API_KEY") return keys.google;
		if (envVar === "OPENAI_API_KEY") return keys.openai;
		if (envVar === "GROK_API_KEY") return keys.grok;
		if (envVar === "IDEOGRAM_API_KEY") return keys.ideogram;
		if (envVar === "OPENROUTER_API_KEY") return keys.openrouter;
		return false;
	};

	return (
		<div className="settings-group">
			<h3>Image provider</h3>
			<p className="sub">
				Default provider for single-image generation on text-channel drafts. Video channels (Reels / TikTok / YT
				Shorts) are skipped here — they'll get their own phase.
			</p>
			<div className="provider-tiles">
				{IMAGE_PROVIDERS.map((p) => {
					const configured = keyFor(p.envVar);
					return (
						<button
							key={p.k}
							type="button"
							className={`provider-tile${active === p.k ? " active" : ""}`}
							onClick={() => {
								if (active !== p.k) {
									void setDefaultImageProvider({ provider: p.k });
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
							<div
								className="mono"
								style={{
									fontSize: 10,
									marginTop: 6,
									color: configured ? "var(--accent-ink)" : "var(--st-rejected-fg)",
								}}
							>
								{loading ? "checking…" : configured ? "configured" : "key missing"}
							</div>
						</button>
					);
				})}
			</div>
			{error && (
				<div className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--st-rejected-fg)" }}>
					{error}
				</div>
			)}
		</div>
	);
};

const ImageConnectionRow = ({
	label,
	help,
	envVar,
	configured,
	loading,
}: {
	label: string;
	help: string;
	envVar: string;
	configured: boolean;
	loading: boolean;
}) => {
	return (
		<div className="setting-row">
			<div>
				<div className="lbl">{label}</div>
				<div className="hlp">{help}</div>
			</div>
			<div className="row gap-2" style={{ flexWrap: "wrap" }}>
				{loading ? (
					<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
						checking…
					</span>
				) : configured ? (
					<>
						<Chip state="approved" label="configured" />
						<span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
							{envVar}
						</span>
					</>
				) : (
					<>
						<Chip state="new" label="not configured" />
						<span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
							run <code>npx convex env set {envVar} …</code>
						</span>
					</>
				)}
			</div>
		</div>
	);
};

const ImageConnections = () => {
	const imageKeys = useAction(api.env.imageKeys.imageKeysPresent);
	const [keys, setKeys] = useState<ImageKeys | null>(null);
	const [loading, setLoading] = useState(true);

	useMountEffect(() => {
		let cancelled = false;
		imageKeys({})
			.then((k) => {
				if (!cancelled) setKeys(k);
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	});

	return (
		<>
			<ImageConnectionRow
				label="Google (Nano Banana / Gemini)"
				help="Gemini 2.5 Flash Image for single-image drafts."
				envVar="GOOGLE_API_KEY"
				configured={keys?.google ?? false}
				loading={loading}
			/>
			<ImageConnectionRow
				label="OpenAI (GPT Image)"
				help="gpt-image-1 — distinct from the OpenRouter key."
				envVar="OPENAI_API_KEY"
				configured={keys?.openai ?? false}
				loading={loading}
			/>
			<ImageConnectionRow
				label="Grok (xAI)"
				help="grok-2-image via api.x.ai."
				envVar="GROK_API_KEY"
				configured={keys?.grok ?? false}
				loading={loading}
			/>
			<ImageConnectionRow
				label="Ideogram"
				help="Ideogram v3 — good photo-realism + typography."
				envVar="IDEOGRAM_API_KEY"
				configured={keys?.ideogram ?? false}
				loading={loading}
			/>
		</>
	);
};

const PostizConnection = () => {
	const keyPresent = useAction(api.env.postiz.postizKeyPresent);
	const statusCheck = useAction(api.publish.status.postizStatus);
	const [configured, setConfigured] = useState<boolean | null>(null);
	const [live, setLive] = useState<{ ok: true; providers: string[] } | { ok: false; error: string } | null>(null);
	const [checking, setChecking] = useState(false);

	useMountEffect(() => {
		let cancelled = false;
		keyPresent({})
			.then((r) => {
				if (cancelled) return;
				setConfigured(r.apiKey);
				if (r.apiKey) {
					// Only ping Postiz if the key is even set — no point wasting
					// an HTTP call on a pre-flight that will definitely 401.
					setChecking(true);
					statusCheck({})
						.then((s) => {
							if (cancelled) return;
							setLive(s.ok ? { ok: true, providers: s.providers } : { ok: false, error: s.error });
						})
						.catch((err) => {
							if (cancelled) return;
							setLive({ ok: false, error: err instanceof Error ? err.message : String(err) });
						})
						.finally(() => {
							if (!cancelled) setChecking(false);
						});
				}
			})
			.catch(() => {
				if (!cancelled) setConfigured(false);
			});
		return () => {
			cancelled = true;
		};
	});

	return (
		<div className="setting-row">
			<div>
				<div className="lbl">Postiz</div>
				<div className="hlp">
					Social scheduling (X / IG / TikTok / YT / FB Page / LinkedIn Page). Hosted plan — connect socials in the
					Postiz dashboard.
				</div>
			</div>
			<div className="row gap-2" style={{ flexWrap: "wrap" }}>
				{configured === null ? (
					<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
						checking…
					</span>
				) : !configured ? (
					<>
						<Chip state="new" label="not configured" />
						<span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
							run <code>npx convex env set POSTIZ_API_KEY …</code>
						</span>
					</>
				) : checking ? (
					<>
						<Chip state="approved" label="key set" />
						<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
							verifying…
						</span>
					</>
				) : live?.ok ? (
					<>
						<Chip state="approved" label="connected" />
						<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
							{live.providers.length === 0
								? "0 socials connected — link them in the Postiz dashboard"
								: `${live.providers.length} social${live.providers.length === 1 ? "" : "s"}: ${live.providers.join(", ")}`}
						</span>
						<a
							className="btn ghost xs"
							href="https://app.postiz.com/launches"
							target="_blank"
							rel="noopener noreferrer"
						>
							Open Postiz
						</a>
					</>
				) : live ? (
					<>
						<Chip state="rejected" label="check failed" />
						<span className="mono" style={{ fontSize: 10.5, color: "var(--st-rejected-fg)" }}>
							{live.error}
						</span>
					</>
				) : null}
			</div>
		</div>
	);
};

const XConnection = () => {
	const status = useQuery(api.x.accounts.mineStatus, {});
	const sync = useAction(api.x.sync.syncMine);
	const setAutoSync = useMutation(api.x.accounts.setAutoSync);
	const [syncing, setSyncing] = useState(false);
	const [lastRun, setLastRun] = useState<{ inserted: number; scanned: number } | null>(null);
	const [syncError, setSyncError] = useState<string | null>(null);
	const [autoSyncOverride, setAutoSyncOverride] = useState<boolean | null>(null);

	const connect = () => {
		window.location.href = "/api/auth/x/start";
	};

	const runSync = async () => {
		setSyncing(true);
		setSyncError(null);
		try {
			const r = await sync({});
			setLastRun(r);
		} catch (err) {
			setSyncError(err instanceof Error ? err.message : String(err));
		} finally {
			setSyncing(false);
		}
	};
	const autoSyncEnabled = autoSyncOverride ?? (status?.connected ? status.autoSync : true);
	const toggleAutoSync = (next: boolean) => {
		setAutoSyncOverride(next);
		setAutoSync({ enabled: next }).catch(() => {
			setAutoSyncOverride(!next);
		});
	};

	return (
		<div className="setting-row">
			<div>
				<div className="lbl">X (bookmarks)</div>
				<div className="hlp">Cron reads your bookmarks every 15 min. OAuth 2.0 PKCE.</div>
			</div>
			<div className="row gap-2" style={{ flexWrap: "wrap" }}>
				{status?.connected ? (
					<>
						<Chip state="approved" label="connected" />
						<span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
							@{status.xHandle} · last sync {fmtRelative(status.lastSyncAt)}
						</span>
						{!autoSyncEnabled && <Chip state="new" label="paused" />}
						<button type="button" className="btn xs" onClick={runSync} disabled={syncing}>
							{syncing ? (
								<>
									<Icons.Clock size={11} /> syncing…
								</>
							) : (
								<>
									<Icons.Sparkle size={11} /> Sync now
								</>
							)}
						</button>
						<button type="button" className="btn ghost xs" onClick={connect}>
							Reconnect
						</button>
						<label
							className="row gap-2"
							style={{ fontSize: 12 }}
							title="Cron pulls bookmarks every 15 min when on"
						>
							<input
								type="checkbox"
								checked={autoSyncEnabled}
								onChange={(e) => toggleAutoSync(e.target.checked)}
								style={{ accentColor: "var(--accent)" }}
							/>
							Auto-sync
						</label>
						{lastRun && (
							<span className="mono" style={{ fontSize: 10.5, color: "var(--accent-ink)" }}>
								+{lastRun.inserted} new · {lastRun.scanned} scanned
							</span>
						)}
						{(syncError || status.lastSyncError) && (
							<span className="mono" style={{ fontSize: 10.5, color: "var(--st-rejected-fg)" }}>
								{syncError ?? status.lastSyncError}
							</span>
						)}
					</>
				) : (
					<>
						<Chip state="new" label="not connected" />
						<button type="button" className="btn xs accent" onClick={connect}>
							<Icons.Plus size={11} /> Connect X
						</button>
					</>
				)}
			</div>
		</div>
	);
};

export const SettingsView = ({ onOpenBrand }: { onOpenBrand: () => void }) => {
	const settings = useQuery(api.settings.doc.get, {});
	const setDefaultProvider = useMutation(api.settings.doc.setDefaultProvider);
	const active = settings?.defaultProvider ?? "glm";

	return (
		<div className="settings-view">
			<SettingsBrandSection onOpenBrand={onOpenBrand} />

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

			<SettingsPrimaryLanguageSection />
			<SettingsTranslationTargetsSection />

			<SettingsOverlayModelSection />

			<ImageProviderSection />

			<div className="settings-group">
				<h3>Connections</h3>
				<p className="sub">Credentials for the pipeline's upstream and downstream hops.</p>
				<XConnection />
				<ImageConnections />
				<div className="setting-row" style={{ display: "none" }} />
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
				<PostizConnection />
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
