"use client";

import { WEBSITE_PROPOSALS } from "../data";
import { Icons } from "../icons";
import { Chip } from "../primitives";
import type { WebsiteProposal } from "../types";

export const WebsiteView = ({ selected, setSelected }: { selected: string; setSelected: (id: string) => void }) => {
	const sel = WEBSITE_PROPOSALS.find((p) => p.id === selected) || WEBSITE_PROPOSALS[0];
	return (
		<div className="website-view">
			<div className="ws-list">
				<div className="inbox-list-head">
					<span className="mono">{WEBSITE_PROPOSALS.length} proposals</span>
					<button type="button" className="btn ghost xs">
						<Icons.Plus size={11} /> New
					</button>
				</div>
				{WEBSITE_PROPOSALS.map((p) => (
					<div
						key={p.id}
						className={`ws-item${sel && sel.id === p.id ? " selected" : ""}`}
						onClick={() => setSelected(p.id)}
						onKeyDown={(e) => {
							if (e.key === "Enter") setSelected(p.id);
						}}
						role="button"
						tabIndex={0}
					>
						<div className="row gap-2" style={{ marginBottom: 6, justifyContent: "space-between" }}>
							<span
								className="mono"
								style={{
									fontSize: 10,
									color: "var(--muted)",
									textTransform: "uppercase",
									letterSpacing: "0.08em",
								}}
							>
								{p.kind} · {p.track}
							</span>
							<Chip state={p.state} />
						</div>
						<div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, letterSpacing: "-0.005em" }}>
							{p.en.title}
						</div>
						<div
							className="mono"
							style={{
								fontSize: 10.5,
								color: "var(--muted-2)",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{p.path}
						</div>
						{p.pr && (
							<div className="row gap-2" style={{ marginTop: 6, fontSize: 10.5 }}>
								<Icons.GitPR size={11} style={{ color: "var(--accent-ink)" }} />
								<span className="mono" style={{ color: "var(--accent-ink)" }}>
									#{p.pr.number}
								</span>
								<span className="mono" style={{ color: "var(--muted-2)" }}>
									open
								</span>
							</div>
						)}
					</div>
				))}
			</div>

			{sel && <WebsiteEditor proposal={sel} />}
		</div>
	);
};

const WebsiteEditor = ({ proposal }: { proposal: WebsiteProposal }) => (
	<div className="ws-editor">
		<div className="ws-edit-head">
			<div className="row gap-3" style={{ minWidth: 0 }}>
				<span
					className="mono"
					style={{
						fontSize: 11,
						color: "var(--muted)",
						padding: "3px 8px",
						background: "var(--surface-sunk)",
						borderRadius: 4,
					}}
				>
					bannaa.co › {proposal.path}
				</span>
				<Chip state={proposal.state} />
				<span className="concept-tag">{proposal.track}</span>
			</div>
			<div className="row gap-2">
				<button type="button" className="btn ghost sm">
					<Icons.Globe size={12} /> Preview on site
				</button>
				<button type="button" className="btn sm">
					<Icons.X size={12} /> Discard
				</button>
				{proposal.pr ? (
					<button type="button" className="btn accent sm">
						<Icons.GitPR size={12} /> View PR #{proposal.pr.number}
					</button>
				) : (
					<button type="button" className="btn accent sm">
						<Icons.GitPR size={12} /> Open PR
					</button>
				)}
			</div>
		</div>

		<div className="ws-split">
			<div className="ws-pane en">
				<div className="lang-h">
					<span>EN · primary</span>
					<span className="row gap-2">
						<kbd className="key">⌘1</kbd>
						<span className="mono" style={{ fontSize: 10 }}>
							lib/content.ts
						</span>
					</span>
				</div>
				<input
					key={`${proposal.id}-en-title`}
					className="ttl-edit"
					defaultValue={proposal.en.title}
					spellCheck="false"
				/>
				<textarea key={`${proposal.id}-en-body`} className="body-edit" defaultValue={proposal.en.body} rows={10} />
			</div>

			<div className="ws-pane ar">
				<div className="lang-h" style={{ flexDirection: "row-reverse" }}>
					<span>AR · ترجمة</span>
					<span className="row gap-2">
						<kbd className="key">⌘2</kbd>
						<span className="mono" style={{ fontSize: 10 }}>
							lib/content.ar.ts
						</span>
					</span>
				</div>
				<input
					key={`${proposal.id}-ar-title`}
					className="ttl-edit"
					defaultValue={proposal.ar.title}
					spellCheck="false"
				/>
				<textarea key={`${proposal.id}-ar-body`} className="body-edit" defaultValue={proposal.ar.body} rows={10} />
			</div>
		</div>

		<div className="ws-edit-foot">
			<div className="row gap-3" style={{ fontSize: 11, color: "var(--muted)" }}>
				<span className="row gap-1">
					<Icons.Language size={12} /> bilingual · mirrored layout
				</span>
				<span className="bullet" />
				<span className="mono">saved 32s ago</span>
			</div>
			<div className="row gap-2">
				<button type="button" className="btn ghost sm">
					<Icons.Sparkle size={12} /> Re-translate AR
				</button>
				{proposal.state !== "approved" && (
					<button type="button" className="btn sm">
						<Icons.Check size={12} sw={2} /> Approve
					</button>
				)}
			</div>
		</div>
	</div>
);
