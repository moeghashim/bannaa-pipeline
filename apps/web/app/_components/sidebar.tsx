import type { ReactElement } from "react";
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
		</div>

		<div className="sidebar-footer">
			<div className="row gap-2" style={{ padding: "8px 10px", alignItems: "center" }}>
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
			</div>
		</div>
	</aside>
);
