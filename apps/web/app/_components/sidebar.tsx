"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { type ReactElement, useRef, useState } from "react";
import { useMountEffect } from "../../lib/use-mount-effect";
import { Icons } from "./icons";
import type { State, ViewKey } from "./types";

type NavItem = {
	key: ViewKey;
	label: string;
	icon: (p: { size?: number }) => ReactElement;
	countKey: State | null;
};

const NAV: NavItem[] = [
	{ key: "inbox", label: "Inbox", icon: Icons.Inbox, countKey: "new" },
	{ key: "analyses", label: "Analyses", icon: Icons.Beaker, countKey: "analyzing" },
	{ key: "drafts", label: "Drafts", icon: Icons.Edit, countKey: "draft" },
	{ key: "reels", label: "Reel Ideas", icon: Icons.Film, countKey: null },
	{ key: "newsletter", label: "Newsletter", icon: Icons.Mail, countKey: null },
	{ key: "website", label: "Website Proposals", icon: Icons.Globe, countKey: null },
	{ key: "brand", label: "Brand", icon: Icons.Language, countKey: null },
	{ key: "settings", label: "Settings", icon: Icons.Gear, countKey: null },
];

export const Sidebar = ({
	active,
	onNav,
	counts,
	identity,
}: {
	active: ViewKey;
	onNav: (v: ViewKey) => void;
	counts: Partial<Record<State, number>>;
	identity: { initial: string; name: string };
}) => (
	<aside className="sidebar">
		<div className="sidebar-brand">
			<div className="brandmark">
				<svg viewBox="0 0 24 24" width="22" height="22" role="img" aria-label="Bannaa">
					<title>Bannaa</title>
					<rect x="2" y="2" width="20" height="20" rx="4" fill="var(--ink)" />
					<path
						d="M7 16V8h4a2.5 2.5 0 0 1 0 5H7M7 13h5a2.5 2.5 0 0 1 0 5H7"
						stroke="var(--bg)"
						strokeWidth="1.5"
						fill="none"
					/>
				</svg>
			</div>
			<div className="col" style={{ gap: 0 }}>
				<div style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>Bannaa</div>
				<div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
					content pipeline
				</div>
			</div>
		</div>

		<div className="sidebar-sec">
			<div className="section-h" style={{ padding: "6px 10px 6px" }}>
				Pipeline
			</div>
			{NAV.slice(0, 6).map((n) => {
				const I = n.icon;
				const count = n.countKey ? counts[n.countKey] : undefined;
				return (
					<button
						key={n.key}
						type="button"
						className={`sidebar-item${active === n.key ? " active" : ""}`}
						onClick={() => onNav(n.key)}
					>
						<I size={15} />
						<span>{n.label}</span>
						{count && count > 0 ? <span className="side-count">{count}</span> : null}
					</button>
				);
			})}
		</div>

		<div className="sidebar-sec">
			<div className="section-h" style={{ padding: "6px 10px 6px" }}>
				Workspace
			</div>
			<button
				type="button"
				className={`sidebar-item${active === "settings" ? " active" : ""}`}
				onClick={() => onNav("settings")}
			>
				<Icons.Gear size={15} />
				<span>Settings</span>
			</button>
			<button
				type="button"
				className={`sidebar-item${active === "brand" ? " active" : ""}`}
				onClick={() => onNav("brand")}
			>
				<Icons.Language size={15} />
				<span>Brand</span>
			</button>
		</div>

		<SidebarFooter identity={identity} />
	</aside>
);

const SidebarFooter = ({ identity }: { identity: { initial: string; name: string } }) => {
	const { signOut } = useAuthActions();
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	useMountEffect(() => {
		const onClickOutside = (e: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		window.addEventListener("mousedown", onClickOutside);
		return () => window.removeEventListener("mousedown", onClickOutside);
	});

	return (
		<div className="sidebar-footer" ref={rootRef} style={{ position: "relative" }}>
			<button
				type="button"
				className="row gap-2"
				onClick={() => setOpen((o) => !o)}
				aria-haspopup="menu"
				aria-expanded={open}
				style={{
					width: "100%",
					padding: "8px 10px",
					alignItems: "center",
					background: "transparent",
					border: "none",
					cursor: "pointer",
					textAlign: "left",
				}}
			>
				<div
					style={{
						width: 22,
						height: 22,
						borderRadius: "50%",
						background: "var(--accent)",
						color: "white",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: 10,
						fontWeight: 600,
					}}
				>
					{identity.initial}
				</div>
				<div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
					<div
						style={{
							fontSize: 11.5,
							fontWeight: 500,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{identity.name}
					</div>
					<div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
						operator · AST
					</div>
				</div>
				<Icons.ChevronDown size={12} style={{ color: "var(--muted)" }} />
			</button>
			{open && (
				<div
					role="menu"
					aria-label="Account actions"
					style={{
						position: "absolute",
						bottom: "calc(100% - 4px)",
						left: 10,
						right: 10,
						background: "var(--surface)",
						border: "1px solid var(--border)",
						borderRadius: "var(--r-md)",
						padding: 4,
						boxShadow: "var(--shadow-md)",
						zIndex: 10,
					}}
				>
					<button
						type="button"
						onClick={() => {
							setOpen(false);
							void signOut();
						}}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							width: "100%",
							padding: "6px 8px",
							fontSize: 12,
							background: "transparent",
							border: "none",
							borderRadius: "var(--r-sm)",
							cursor: "pointer",
							textAlign: "left",
							color: "var(--ink)",
						}}
					>
						<Icons.X size={11} />
						Sign out
					</button>
				</div>
			)}
		</div>
	);
};
