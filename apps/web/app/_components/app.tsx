"use client";

import { useMemo, useRef, useState } from "react";
import { useMountEffect } from "../../lib/use-mount-effect";
import { HintBar, TopChrome } from "./chrome";
import { NEWSLETTER, DRAFTS as SEED_DRAFTS, INBOX_ITEMS as SEED_INBOX } from "./data";
import { Icons } from "./icons";
import { Palette } from "./palette";
import { FilterSeg, Select } from "./primitives";
import { Sidebar } from "./sidebar";
import type { CapturePayload, Draft, InboxItem, State, ViewKey } from "./types";
import { AnalysesView } from "./views/analyses";
import { DraftsView } from "./views/drafts";
import { InboxView } from "./views/inbox";
import { NewsletterView } from "./views/newsletter";
import { ReelsView } from "./views/reels";
import { SettingsView } from "./views/settings";
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
};

const VIEW_STORAGE_KEY = "bp.view";

const isViewKey = (v: string): v is ViewKey =>
	v === "inbox" ||
	v === "analyses" ||
	v === "drafts" ||
	v === "reels" ||
	v === "newsletter" ||
	v === "website" ||
	v === "settings";

export function Shell() {
	const [view, setView] = useState<ViewKey>("inbox");
	const [paletteOpen, setPaletteOpen] = useState(false);

	const [inboxItems, setInboxItems] = useState<InboxItem[]>(SEED_INBOX);
	const [inboxSel, setInboxSel] = useState("in_01");
	const [inboxFocus, setInboxFocus] = useState(0);
	const [inboxChk, setInboxChk] = useState<Set<string>>(new Set());
	const [inboxFilter, setInboxFilter] = useState("all");
	const [inboxSource, setInboxSource] = useState("all");
	const [progressIds, setProgressIds] = useState<string[]>([]);

	const [analysisSel, setAnalysisSel] = useState("in_02");

	const [drafts, setDrafts] = useState<Draft[]>(SEED_DRAFTS);
	const [draftsChannel, setDraftsChannel] = useState("all");

	const [wsSel, setWsSel] = useState("ws_01");

	// Keep latest state reachable from the mount-only keydown listener.
	const stateRef = useRef({
		view,
		paletteOpen,
		inboxItems,
		inboxFilter,
		inboxSource,
		inboxFocus,
	});
	stateRef.current = {
		view,
		paletteOpen,
		inboxItems,
		inboxFilter,
		inboxSource,
		inboxFocus,
	};

	const navigate = (v: ViewKey) => {
		setView(v);
		try {
			window.localStorage.setItem(VIEW_STORAGE_KEY, v);
		} catch {
			/* ignore quota */
		}
	};

	// Hydrate view from localStorage + bind the global keydown listener once.
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
				setPaletteOpen((p) => !p);
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
					r: "reels",
					n: "newsletter",
					w: "website",
					s: "settings",
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

	const onAnalyze = (ids: string[]) => {
		setInboxChk(new Set());
		for (const id of ids) {
			setInboxItems((prev) => prev.map((it) => (it.id === id ? { ...it, state: "analyzing" as const } : it)));
			setProgressIds((prev) => (prev.includes(id) ? prev : [id, ...prev]));
			window.setTimeout(() => {
				setInboxItems((prev) => prev.map((it) => (it.id === id ? { ...it, state: "draft" as const } : it)));
				window.setTimeout(() => setProgressIds((prev) => prev.filter((p) => p !== id)), 1400);
			}, 1800);
		}
	};

	const onCapture = (payload: CapturePayload, done: () => void) => {
		const id = `in_${Math.random().toString(36).slice(2, 7)}`;
		const now = new Date().toISOString();
		const title =
			payload.title ||
			(payload.source === "x"
				? `${payload.handle} · captured tweet`
				: payload.source === "youtube"
					? "Captured YouTube video"
					: payload.source === "article"
						? `Captured article · ${payload.handle}`
						: "Manual note");
		const snippet =
			payload.source === "manual"
				? payload.raw
				: "Awaiting fetch & extraction — the LLM will pull the transcript/body and produce a summary, concept tags, and suggested outputs.";
		const newItem: InboxItem = {
			id,
			source: payload.source,
			handle: payload.handle,
			title,
			snippet,
			lang: "en",
			captured: now,
			state: "new",
			url: payload.url ?? undefined,
			length: payload.source === "manual" ? payload.raw.split(/\s+/).length : "fetching…",
		};
		setInboxItems((prev) => [newItem, ...prev]);
		setInboxSel(id);
		setInboxFocus(0);
		setProgressIds((prev) => [id, ...prev]);

		window.setTimeout(() => {
			setInboxItems((prev) =>
				prev.map((it) =>
					it.id === id
						? {
								...it,
								state: "analyzing" as const,
								snippet:
									"Running analysis with Claude Sonnet 4.5 — extracting summary, tagging concepts against the 94-concept ontology, proposing social drafts and a website lesson…",
							}
						: it,
				),
			);
		}, 700);
		window.setTimeout(() => {
			setInboxItems((prev) =>
				prev.map((it) =>
					it.id === id
						? {
								...it,
								state: "draft" as const,
								snippet:
									"Analysis complete. 3 suggested outputs: 1 tweet · 1 reel idea · 1 website concept. Review in the Analyses tab.",
							}
						: it,
				),
			);
		}, 2600);
		window.setTimeout(() => setProgressIds((prev) => prev.filter((p) => p !== id)), 4000);

		done();
	};

	const onUpdateDraft = (id: string, patch: Partial<Draft>) => {
		setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
	};

	const chrome = resolveChrome(
		view,
		inboxItems,
		drafts,
		counts,
		inboxFilter,
		setInboxFilter,
		inboxSource,
		setInboxSource,
	);

	return (
		<>
			<div className="app">
				<Sidebar active={view} onNav={navigate} counts={counts} />
				<div className="main">
					<TopChrome
						title={chrome.title}
						subtitle={chrome.subtitle}
						filters={chrome.filters}
						actions={chrome.actions}
						onOpenPalette={() => setPaletteOpen(true)}
					/>
					<div className="view">
						{view === "inbox" && (
							<InboxView
								items={inboxItems}
								onCapture={onCapture}
								progressIds={progressIds}
								selected={inboxSel}
								setSelected={setInboxSel}
								focusIdx={inboxFocus}
								setFocusIdx={setInboxFocus}
								checked={inboxChk}
								setChecked={setInboxChk}
								onAnalyze={onAnalyze}
								filter={inboxFilter}
								sourceFilter={inboxSource}
							/>
						)}
						{view === "analyses" && <AnalysesView selected={analysisSel} setSelected={setAnalysisSel} />}
						{view === "drafts" && (
							<DraftsView
								channel={draftsChannel}
								setChannel={setDraftsChannel}
								drafts={drafts}
								onUpdate={onUpdateDraft}
							/>
						)}
						{view === "reels" && <ReelsView />}
						{view === "newsletter" && <NewsletterView />}
						{view === "website" && <WebsiteView selected={wsSel} setSelected={setWsSel} />}
						{view === "settings" && <SettingsView />}
					</div>
				</div>
				<HintBar hints={HINTS_BY_VIEW[view]} />
			</div>

			<Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNav={navigate} />
		</>
	);
}

function resolveChrome(
	view: ViewKey,
	inboxItems: InboxItem[],
	drafts: Draft[],
	counts: Partial<Record<State, number>>,
	inboxFilter: string,
	setInboxFilter: (v: string) => void,
	inboxSource: string,
	setInboxSource: (v: string) => void,
) {
	if (view === "inbox") {
		return {
			title: "Inbox",
			subtitle: `${inboxItems.length} captured · next cron in 8m`,
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
			actions: (
				<button type="button" className="btn accent sm">
					<Icons.Sparkle size={12} /> Analyze all new
				</button>
			),
		};
	}
	if (view === "analyses") return { title: "Analyses", subtitle: "structured extraction · source ↔ output" };
	if (view === "drafts") return { title: "Drafts", subtitle: `${drafts.length} across 5 channels · review gate` };
	if (view === "reels") return { title: "Reel Ideas", subtitle: "ideation feed · short pitch cards" };
	if (view === "newsletter")
		return { title: "Newsletter", subtitle: `issue #${NEWSLETTER.issue} · resend · sun 09:00 AST` };
	if (view === "website") return { title: "Website Proposals", subtitle: "bilingual · bannaa.co content PRs" };
	return { title: "Settings", subtitle: "providers · connections · cron" };
}
