import type { ReactNode } from "react";
import { Icons } from "./icons";

export const TopChrome = ({
	title,
	subtitle,
	filters,
	actions,
	onOpenPalette,
}: {
	title: string;
	subtitle?: string;
	filters?: ReactNode;
	actions?: ReactNode;
	onOpenPalette: () => void;
}) => (
	<div className="topchrome">
		<div className="row gap-3" style={{ flex: 1, minWidth: 0 }}>
			<div className="col" style={{ gap: 0 }}>
				<div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</div>
				{subtitle && (
					<div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
						{subtitle}
					</div>
				)}
			</div>
			{filters && <div className="sep" />}
			{filters}
		</div>
		<div className="row gap-2">
			<button type="button" className="btn ghost" onClick={onOpenPalette} title="Command palette">
				<Icons.Search size={13} />
				<span style={{ color: "var(--muted)", fontSize: 12 }}>Search…</span>
				<kbd className="key" style={{ marginLeft: 4 }}>
					⌘K
				</kbd>
			</button>
			{actions}
		</div>
	</div>
);

type Hint = { keys: string[]; label: string };

export const HintBar = ({ hints }: { hints: Hint[] }) => (
	<div className="hintbar">
		<div className="row gap-4">
			{hints.map((h) => (
				<div key={h.label} className="row gap-2" style={{ fontSize: 10.5, color: "var(--muted)" }}>
					{h.keys.map((k) => (
						<kbd key={k} className="key">
							{k}
						</kbd>
					))}
					<span>{h.label}</span>
				</div>
			))}
		</div>
		<div className="row gap-3" style={{ color: "var(--muted)", fontSize: 10.5 }}>
			<span className="mono">connected · claude-sonnet-4.5 · AST 06:14</span>
			<span className="bullet" />
			<span className="mono">queue: 3 running · 12 queued</span>
		</div>
	</div>
);
