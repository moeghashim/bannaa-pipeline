"use client";

import { useMemo, useState } from "react";
import { Icons } from "./icons";
import type { ViewKey } from "./types";

type PaletteCommand = {
	key: string;
	label: string;
	group: string;
	kbd?: string;
	nav?: ViewKey;
};

const PALETTE_COMMANDS: PaletteCommand[] = [
	{ key: "go-inbox", label: "Go to Inbox", group: "Navigate", kbd: "G I", nav: "inbox" },
	{ key: "go-analyses", label: "Go to Analyses", group: "Navigate", kbd: "G A", nav: "analyses" },
	{ key: "go-drafts", label: "Go to Drafts", group: "Navigate", kbd: "G D", nav: "drafts" },
	{ key: "go-reels", label: "Go to Reel Ideas", group: "Navigate", kbd: "G R", nav: "reels" },
	{ key: "go-newsletter", label: "Go to Newsletter", group: "Navigate", kbd: "G N", nav: "newsletter" },
	{ key: "go-website", label: "Go to Website Proposals", group: "Navigate", kbd: "G W", nav: "website" },
	{ key: "go-settings", label: "Go to Settings", group: "Navigate", kbd: "G S", nav: "settings" },
	{ key: "go-brand", label: "Go to Brand", group: "Navigate", kbd: "G B", nav: "brand" },
	{ key: "analyze", label: "Analyze selected item", group: "Action" },
	{ key: "approve", label: "Approve selected", group: "Action", kbd: "A" },
	{ key: "reject", label: "Reject selected", group: "Action", kbd: "R" },
	{ key: "edit", label: "Edit selected", group: "Action", kbd: "E" },
	{ key: "send-newsletter", label: "Send this week's newsletter", group: "Action" },
	{ key: "provider-claude", label: "Switch default provider → Claude", group: "Provider" },
	{ key: "provider-codex", label: "Switch default provider → Codex", group: "Provider" },
	{ key: "provider-grok", label: "Switch default provider → Grok", group: "Provider" },
	{ key: "new-manual", label: "New manual inbox item", group: "Create", kbd: "C" },
	{ key: "open-pr", label: "Open PR against bannaa.co", group: "Create" },
];

export const Palette = ({
	open,
	onClose,
	onNav,
}: {
	open: boolean;
	onClose: () => void;
	onNav: (v: ViewKey) => void;
}) => {
	const [q, setQ] = useState("");
	const [sel, setSel] = useState(0);

	const matches = useMemo(() => {
		if (!q.trim()) return PALETTE_COMMANDS;
		const lq = q.toLowerCase();
		return PALETTE_COMMANDS.filter((c) => c.label.toLowerCase().includes(lq) || c.group.toLowerCase().includes(lq));
	}, [q]);

	if (!open) return null;

	const run = (cmd: PaletteCommand) => {
		if (cmd.nav) onNav(cmd.nav);
		onClose();
	};

	const grouped: Record<string, PaletteCommand[]> = {};
	for (const c of matches) {
		const bucket = grouped[c.group] ?? [];
		bucket.push(c);
		grouped[c.group] = bucket;
	}

	const focusOnMount = (el: HTMLInputElement | null) => {
		if (el) el.focus();
	};

	return (
		<div
			className="palette-scrim"
			onClick={onClose}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
			}}
			role="presentation"
		>
			<div
				className="palette"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
				<div className="palette-head">
					<Icons.Search size={14} style={{ color: "var(--muted)" }} />
					<input
						ref={focusOnMount}
						className="palette-input"
						placeholder="Search commands, or type to filter…"
						value={q}
						onChange={(e) => {
							setQ(e.target.value);
							setSel(0);
						}}
						onKeyDown={(e) => {
							if (e.key === "Escape") onClose();
							if (e.key === "ArrowDown") {
								e.preventDefault();
								setSel((s) => Math.min(s + 1, matches.length - 1));
							}
							if (e.key === "ArrowUp") {
								e.preventDefault();
								setSel((s) => Math.max(s - 1, 0));
							}
							if (e.key === "Enter") {
								e.preventDefault();
								const match = matches[sel];
								if (match) run(match);
							}
						}}
					/>
					<kbd className="key">esc</kbd>
				</div>
				<div className="palette-body">
					{Object.entries(grouped).map(([group, items]) => (
						<div key={group}>
							<div className="section-h" style={{ padding: "10px 14px 4px" }}>
								{group}
							</div>
							{items.map((c) => {
								const idx = matches.indexOf(c);
								return (
									<button
										key={c.key}
										type="button"
										className={`palette-item${idx === sel ? " active" : ""}`}
										onMouseEnter={() => setSel(idx)}
										onClick={() => run(c)}
									>
										<span>{c.label}</span>
										{c.kbd && <kbd className="key">{c.kbd}</kbd>}
									</button>
								);
							})}
						</div>
					))}
					{matches.length === 0 && (
						<div style={{ padding: "30px 14px", textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
							No commands match “{q}”.
						</div>
					)}
				</div>
				<div className="palette-foot">
					<span className="mono">{matches.length} commands</span>
					<div className="row gap-3">
						<span className="row gap-1">
							<kbd className="key">↑</kbd>
							<kbd className="key">↓</kbd> navigate
						</span>
						<span className="row gap-1">
							<kbd className="key">↵</kbd> run
						</span>
					</div>
				</div>
			</div>
		</div>
	);
};
