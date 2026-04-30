"use client";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useMemo, useRef, useState } from "react";
import { useMountEffect } from "../../lib/use-mount-effect";
import { captureClientEvent, identifyClientUser, resetClientUser } from "../_lib/posthog";
import { HintBar, TopChrome } from "./chrome";
import { NEWSLETTER } from "./data";
import { Palette } from "./palette";
import { FilterSeg, Select } from "./primitives";
import { Sidebar } from "./sidebar";
import type { Analysis, CapturePayload, InboxItem, ProviderId, State, ViewKey } from "./types";
import { AnalysesView } from "./views/analyses";
import { BrandView } from "./views/brand";
import { DraftsView } from "./views/drafts";
import { InboxView } from "./views/inbox";
import { MetricsView } from "./views/metrics";
import { NewsletterView } from "./views/newsletter";
import { ReelsView } from "./views/reels";
import { SettingsView } from "./views/settings";
import { TemplatesView } from "./views/templates";
import { WebsiteView } from "./views/website";

type Hint = { keys: string[]; label: string };

const HINTS_BY_VIEW: Record<ViewKey, Hint[]> = {
	inbox: [
		{ keys: ["J", "K"], label: "navigate" },
		{ keys: ["E"], label: "edit" },
		{ keys: ["A"], label: "approve" },
		{ keys: ["R"], label: "reject" },
		{ keys: ["⌘", "↵"], label: "analyze" },
		{ keys: ["⌘", "K"], label: "palette" },
	],
	analyses: [
		{ keys: ["J", "K"], label: "navigate" },
		{ keys: ["↵"], label: "promote" },
		{ keys: ["⌘", "↵"], label: "re-run" },
		{ keys: ["⌘", "K"], label: "palette" },
	],
	drafts: [
		{ keys: ["J", "K"], label: "navigate" },
		{ keys: ["E"], label: "edit" },
		{ keys: ["A"], label: "approve" },
		{ keys: ["R"], label: "reject" },
		{ keys: ["⌘", "K"], label: "palette" },
	],
	templates: [
		{ keys: ["G", "T"], label: "templates" },
		{ keys: ["⌘", "K"], label: "palette" },
	],
	metrics: [
		{ keys: ["G", "M"], label: "metrics" },
		{ keys: ["⌘", "K"], label: "palette" },
	],
	reels: [
		{ keys: ["J", "K"], label: "navigate" },
		{ keys: ["↵"], label: "promote" },
		{ keys: ["⌘", "K"], label: "palette" },
	],
	newsletter: [
		{ keys: ["↑", "↓"], label: "reorder" },
		{ keys: ["P"], label: "preview" },
		{ keys: ["⌘", "↵"], label: "send now" },
		{ keys: ["⌘", "K"], label: "palette" },
	],
	website: [
		{ keys: ["⌘", "1"], label: "EN pane" },
		{ keys: ["⌘", "2"], label: "AR pane" },
		{ keys: ["⌘", "↵"], label: "open PR" },
		{ keys: ["⌘", "K"], label: "palette" },
	],
	settings: [{ keys: ["⌘", "K"], label: "palette" }],
	brand: [
		{ keys: ["G", "B"], label: "brand" },
		{ keys: ["⌘", "K"], label: "palette" },
	],
};

const VIEW_STORAGE_KEY = "bp.view";

type CurrentUser = {
	_id: string;
	email?: string | null;
	name?: string | null;
};

const isViewKey = (v: string): v is ViewKey =>
	v === "inbox" ||
	v === "analyses" ||
	v === "drafts" ||
	v === "templates" ||
	v === "metrics" ||
	v === "reels" ||
	v === "newsletter" ||
	v === "website" ||
	v === "settings" ||
	v === "brand";

function providerLabel(provider: ProviderId | undefined): string {
	if (provider === "claude") return "claude-sonnet-4-6";
	if (provider === "openrouter") return "openrouter";
	if (provider === "deepseek") return "deepseek-v4-pro";
	return "glm-5.1";
}

function toLocalInboxItem(doc: Doc<"inboxItems">): InboxItem {
	return {
		id: doc._id,
		source: doc.source,
		handle: doc.handle,
		title: doc.title,
		snippet: doc.snippet,
		lang: doc.lang,
		captured: new Date(doc.captured).toISOString(),
		state: doc.state,
		url: doc.url,
		length: doc.length,
	};
}

function toLocalAnalysis(doc: Doc<"analyses">): Analysis {
	return {
		id: doc._id,
		itemId: doc.itemId,
		provider: doc.provider,
		runAt: new Date(doc.runAt).toISOString(),
		cost: "",
		tokens: "",
		summary: doc.summary,
		concepts: doc.concepts,
		track: doc.track,
		tier: "medium",
		outputs: doc.outputs,
		keyPoints: doc.keyPoints,
	};
}

function PostHogIdentityBridge({ user }: { user: CurrentUser | null | undefined }) {
	const userRef = useRef(user);
	const lastUserIdRef = useRef<string | null | undefined>(undefined);
	userRef.current = user;

	useMountEffect(() => {
		const syncIdentity = () => {
			const current = userRef.current;
			if (current === undefined) return;

			const nextUserId = current?._id ?? null;
			if (lastUserIdRef.current === nextUserId) return;

			if (current) {
				identifyClientUser({ id: current._id, email: current.email, name: current.name });
			} else {
				resetClientUser();
			}
			lastUserIdRef.current = nextUserId;
		};

		syncIdentity();
		const interval = window.setInterval(syncIdentity, 500);
		return () => window.clearInterval(interval);
	});

	return null;
}

export function Shell() {
	const [view, setView] = useState<ViewKey>("inbox");
	const [paletteOpen, setPaletteOpen] = useState(false);

	const inboxDocs = useQuery(api.inbox.list.list, {});
	const analysisDocs = useQuery(api.analyses.list.list, {});
	const me = useQuery(api.users.me.me, {});
	const budget = useQuery(api.budget.todaySpend.todaySpend, {});
	const settings = useQuery(api.settings.doc.get, {});

	const captureMutation = useMutation(api.inbox.capture.capture);
	const deleteItemMutation = useMutation(api.inbox.destroy.deleteItem);
	const analyzeAction = useAction(api.analyze.run.run);

	const inboxItems = useMemo(() => (inboxDocs ?? []).map(toLocalInboxItem), [inboxDocs]);
	const analyses = useMemo(() => (analysisDocs ?? []).map(toLocalAnalysis), [analysisDocs]);

	const [inboxSel, setInboxSel] = useState<string>("");
	const [inboxFocus, setInboxFocus] = useState(0);
	const [inboxChk, setInboxChk] = useState<Set<string>>(new Set());
	const [inboxFilter, setInboxFilter] = useState("all");
	const [inboxSource, setInboxSource] = useState("all");

	const [analysisSel, setAnalysisSel] = useState("");

	const [draftsChannel, setDraftsChannel] = useState("all");

	const [wsSel, setWsSel] = useState("ws_01");

	const stateRef = useRef({
		view,
		paletteOpen,
		inboxItems,
		inboxFilter,
		inboxSource,
		inboxFocus,
	});
	stateRef.current = { view, paletteOpen, inboxItems, inboxFilter, inboxSource, inboxFocus };

	const navigate = (v: ViewKey) => {
		if (view !== v) captureClientEvent("view_changed", { from: view, to: v });
		setView(v);
		try {
			window.localStorage.setItem(VIEW_STORAGE_KEY, v);
		} catch {
			/* ignore quota */
		}
	};

	useMountEffect(() => {
		try {
			const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
			if (stored && isViewKey(stored)) setView(stored);
		} catch {
			/* ignore */
		}

		let chainTimer: number | null = null;
		let chainActive = false;

		const onKey = (e: KeyboardEvent) => {
			const s = stateRef.current;
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName?.toLowerCase() ?? "";
			const typing = tag === "input" || tag === "textarea" || target?.isContentEditable === true;

			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setPaletteOpen((p) => {
					const next = !p;
					if (next) captureClientEvent("palette_opened", { trigger: "shortcut" });
					return next;
				});
				return;
			}
			if (e.key === "Escape" && s.paletteOpen) {
				setPaletteOpen(false);
				return;
			}
			if (typing) return;

			if (chainActive) {
				const map: Record<string, ViewKey> = {
					i: "inbox",
					a: "analyses",
					d: "drafts",
					t: "templates",
					m: "metrics",
					r: "reels",
					n: "newsletter",
					w: "website",
					s: "settings",
					b: "brand",
				};
				const next = map[e.key.toLowerCase()];
				if (next) {
					e.preventDefault();
					navigate(next);
				}
				chainActive = false;
				if (chainTimer !== null) window.clearTimeout(chainTimer);
				chainTimer = null;
				return;
			}

			if (e.key.toLowerCase() === "g") {
				chainActive = true;
				if (chainTimer !== null) window.clearTimeout(chainTimer);
				chainTimer = window.setTimeout(() => {
					chainActive = false;
				}, 1200);
				return;
			}

			if (s.view === "inbox") {
				const list = s.inboxItems.filter(
					(it) =>
						(s.inboxFilter === "all" || it.state === s.inboxFilter) &&
						(s.inboxSource === "all" || it.source === s.inboxSource),
				);
				if (e.key.toLowerCase() === "j") {
					e.preventDefault();
					setInboxFocus((f) => {
						const nf = Math.min(f + 1, list.length - 1);
						const nextItem = list[nf];
						if (nextItem) setInboxSel(nextItem.id);
						return nf;
					});
				}
				if (e.key.toLowerCase() === "k") {
					e.preventDefault();
					setInboxFocus((f) => {
						const nf = Math.max(f - 1, 0);
						const nextItem = list[nf];
						if (nextItem) setInboxSel(nextItem.id);
						return nf;
					});
				}
			}
		};

		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			if (chainTimer !== null) window.clearTimeout(chainTimer);
		};
	});

	const counts: Partial<Record<State, number>> = useMemo(() => {
		const c: Partial<Record<State, number>> = {};
		for (const i of inboxItems) c[i.state] = (c[i.state] ?? 0) + 1;
		return c;
	}, [inboxItems]);

	const onAnalyze = async (ids: string[]) => {
		setInboxChk(new Set());
		for (const id of ids) {
			void analyzeAction({ id: id as Id<"inboxItems"> });
		}
	};

	const onCapture = async (payload: CapturePayload, done: () => void) => {
		try {
			await captureMutation({ raw: payload.raw });
		} finally {
			done();
		}
	};

	const onDelete = async (id: string) => {
		await deleteItemMutation({ id: id as Id<"inboxItems"> });
	};

	const onOpenAnalysis = (id: string) => {
		setAnalysisSel(id);
		navigate("analyses");
	};

	const onOpenDrafts = (channel: string) => {
		setDraftsChannel(channel);
		navigate("drafts");
	};

	const chrome = resolveChrome(view, inboxItems, counts, inboxFilter, setInboxFilter, inboxSource, setInboxSource);
	const llmLabel = providerLabel(settings?.defaultProvider);

	const identity = me
		? { initial: (me.name ?? me.email ?? "?").slice(0, 1).toUpperCase(), name: me.name ?? me.email ?? "operator" }
		: { initial: "·", name: "loading…" };

	return (
		<>
			<PostHogIdentityBridge user={me} />
			<div className="app">
				<Sidebar active={view} onNav={navigate} counts={counts} identity={identity} />
				<div className="main">
					<TopChrome
						title={chrome.title}
						subtitle={chrome.subtitle}
						filters={chrome.filters}
						actions={chrome.actions}
						onOpenPalette={() => {
							captureClientEvent("palette_opened", { trigger: "click" });
							setPaletteOpen(true);
						}}
					/>
					<div className="view">
						{view === "inbox" && (
							<InboxView
								items={inboxItems}
								onCapture={onCapture}
								selected={inboxSel || inboxItems[0]?.id || ""}
								setSelected={setInboxSel}
								focusIdx={inboxFocus}
								setFocusIdx={setInboxFocus}
								checked={inboxChk}
								setChecked={setInboxChk}
								onAnalyze={onAnalyze}
								onReject={onDelete}
								onOpenAnalysis={onOpenAnalysis}
								filter={inboxFilter}
								sourceFilter={inboxSource}
								loading={inboxDocs === undefined}
								llmLabel={llmLabel}
							/>
						)}
						{view === "analyses" && (
							<AnalysesView
								selected={analysisSel}
								setSelected={setAnalysisSel}
								items={inboxItems}
								analyses={analyses}
								onOpenDrafts={onOpenDrafts}
								onDelete={onDelete}
							/>
						)}
						{view === "drafts" && <DraftsView channel={draftsChannel} setChannel={setDraftsChannel} />}
						{view === "templates" && <TemplatesView />}
						{view === "metrics" && <MetricsView />}
						{view === "reels" && <ReelsView />}
						{view === "newsletter" && <NewsletterView />}
						{view === "website" && <WebsiteView selected={wsSel} setSelected={setWsSel} />}
						{view === "settings" && <SettingsView onOpenBrand={() => navigate("brand")} />}
						{view === "brand" && <BrandView />}
					</div>
				</div>
				<HintBar
					hints={HINTS_BY_VIEW[view]}
					spendToday={budget?.total ?? 0}
					spendCap={budget?.cap ?? 6}
					runCount={budget?.runs ?? 0}
					providerLabel={llmLabel}
				/>
			</div>

			<Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNav={navigate} />
		</>
	);
}

function resolveChrome(
	view: ViewKey,
	inboxItems: InboxItem[],
	counts: Partial<Record<State, number>>,
	inboxFilter: string,
	setInboxFilter: (v: string) => void,
	inboxSource: string,
	setInboxSource: (v: string) => void,
) {
	if (view === "inbox") {
		return {
			title: "Inbox",
			subtitle: `${inboxItems.length} captured`,
			filters: (
				<div className="row gap-2">
					<FilterSeg
						value={inboxFilter}
						onChange={setInboxFilter}
						options={[
							{ value: "all", label: "All", count: inboxItems.length },
							{ value: "new", label: "New", count: counts.new ?? 0 },
							{ value: "analyzing", label: "Analyzing", count: counts.analyzing ?? 0 },
							{ value: "draft", label: "Draft", count: counts.draft ?? 0 },
							{ value: "approved", label: "Approved", count: counts.approved ?? 0 },
							{ value: "rejected", label: "Rejected", count: counts.rejected ?? 0 },
						]}
					/>
					<Select
						compact
						value={inboxSource}
						onChange={setInboxSource}
						options={[
							{ value: "all", label: "All sources" },
							{ value: "x", label: "X" },
							{ value: "youtube", label: "YouTube" },
							{ value: "article", label: "Articles" },
							{ value: "manual", label: "Manual" },
						]}
					/>
				</div>
			),
			actions: null,
		};
	}
	if (view === "analyses") return { title: "Analyses", subtitle: "structured extraction · source ↔ output" };
	if (view === "drafts") return { title: "Drafts", subtitle: "across 7 channels · review gate" };
	if (view === "templates") return { title: "Templates", subtitle: "winning structures · reuse loop" };
	if (view === "metrics") return { title: "Metrics", subtitle: "channel health · platform trends" };
	if (view === "reels") return { title: "Reel Ideas", subtitle: "ideation feed · short pitch cards" };
	if (view === "newsletter")
		return { title: "Newsletter", subtitle: `issue #${NEWSLETTER.issue} · resend · sun 09:00 AST` };
	if (view === "website") return { title: "Website Proposals", subtitle: "bilingual · bannaa.co content PRs" };
	if (view === "brand") return { title: "Brand", subtitle: "tone · visual system · versions" };
	return { title: "Settings", subtitle: "providers · connections · cron" };
}
