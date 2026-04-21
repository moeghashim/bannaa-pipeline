"use client";

import { INBOX_ITEMS, REEL_IDEAS } from "../data";
import { Icons } from "../icons";
import { Chip, FilterSeg, SourceBadge } from "../primitives";

export const ReelsView = () => (
	<div className="reels-view">
		<div className="row gap-3" style={{ marginBottom: 16, justifyContent: "space-between" }}>
			<div className="col" style={{ gap: 2 }}>
				<div style={{ fontSize: 13, fontWeight: 600 }}>Ideation feed</div>
				<div style={{ fontSize: 12, color: "var(--muted)" }}>
					Short pitch cards. Promote one to become a TikTok / Shorts / Reels draft.
				</div>
			</div>
			<div className="row gap-2">
				<FilterSeg
					value="all"
					onChange={() => {}}
					options={[
						{ value: "all", label: "All", count: REEL_IDEAS.length },
						{ value: "new", label: "New", count: REEL_IDEAS.filter((r) => r.state === "new").length },
						{ value: "draft", label: "Promoted", count: REEL_IDEAS.filter((r) => r.state === "draft").length },
						{
							value: "approved",
							label: "Approved",
							count: REEL_IDEAS.filter((r) => r.state === "approved").length,
						},
					]}
				/>
			</div>
		</div>

		<div className="reels-grid">
			{REEL_IDEAS.map((r) => {
				const ref = INBOX_ITEMS.find((i) => i.id === r.ref);
				return (
					<div key={r.id} className="reel-card">
						<div className="row gap-2" style={{ justifyContent: "space-between" }}>
							<Chip state={r.state} />
							<span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
								{r.length}
							</span>
						</div>
						<div className="hook" style={{ textWrap: "balance" }}>
							{r.hook}
						</div>
						<div>
							{r.beats.map((b) => {
								const [t, ...rest] = b.split(" ");
								return (
									<div key={b} className="reel-beat">
										<div className="t">{t}</div>
										<div style={{ color: "var(--ink-2)" }}>{rest.join(" ")}</div>
									</div>
								);
							})}
						</div>
						<div
							className="row gap-2"
							style={{
								justifyContent: "space-between",
								paddingTop: 8,
								borderTop: "1px solid var(--border-faint)",
							}}
						>
							<div className="row gap-2" style={{ minWidth: 0 }}>
								{ref && <SourceBadge source={ref.source} compact />}
								<span
									className="mono"
									style={{
										fontSize: 10,
										color: "var(--muted-2)",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									ref: {r.ref}
								</span>
							</div>
							<div className="row gap-1">
								{r.concepts.map((c) => (
									<span key={c} className="concept-tag" style={{ height: 18, fontSize: 10, padding: "0 6px" }}>
										{c}
									</span>
								))}
							</div>
						</div>
						<button type="button" className="btn sm" style={{ alignSelf: "flex-start" }}>
							<Icons.Arrow size={11} /> Promote to draft
						</button>
					</div>
				);
			})}
		</div>
	</div>
);
