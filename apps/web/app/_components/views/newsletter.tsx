"use client";

import { useState } from "react";
import { useMountEffect } from "../../../lib/use-mount-effect";
import { ANALYSES, INBOX_ITEMS, NEWSLETTER, WEBSITE_PROPOSALS } from "../data";
import { fmtDate } from "../format";
import { Icons } from "../icons";
import { Chip } from "../primitives";

const sendsIn = () => {
	const send = new Date(NEWSLETTER.sendAt).getTime();
	const now = Date.now();
	const diff = Math.max(0, send - now);
	const days = Math.floor(diff / 86400000);
	const hrs = Math.floor((diff % 86400000) / 3600000);
	const mins = Math.floor((diff % 3600000) / 60000);
	return `${days}d ${hrs}h ${mins}m`;
};

export const NewsletterView = () => {
	const [countdown, setCountdown] = useState(sendsIn());
	useMountEffect(() => {
		const t = setInterval(() => setCountdown(sendsIn()), 60000);
		return () => clearInterval(t);
	});

	return (
		<div className="newsletter-view">
			<div className="news-compose">
				<div className="row gap-2" style={{ justifyContent: "space-between", marginBottom: 10 }}>
					<div className="col" style={{ gap: 0 }}>
						<div style={{ fontSize: 15, fontWeight: 600 }}>Issue #{NEWSLETTER.issue}</div>
						<div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
							sends · sun {fmtDate(NEWSLETTER.sendAt)} · 09:00 AST
						</div>
					</div>
					<Chip state="draft" label={NEWSLETTER.status} />
				</div>

				<div className="countdown" style={{ marginBottom: 18 }}>
					<Icons.Clock size={14} />
					<div className="col" style={{ gap: 0 }}>
						<div style={{ fontWeight: 600 }}>{countdown}</div>
						<div className="mono" style={{ fontSize: 10, opacity: 0.8 }}>
							until send slot · resend template
						</div>
					</div>
					<button type="button" className="btn xs accent" style={{ marginLeft: "auto" }}>
						Send now
					</button>
				</div>

				<div className="section-h" style={{ marginBottom: 8 }}>
					Sections · drag to reorder
				</div>
				<div className="col gap-2">
					{NEWSLETTER.sections.map((s) => (
						<div key={s.kind + s.title} className="news-section">
							<Icons.Menu size={12} />
							<span className="kind">{s.kind}</span>
							<span className="ttl">{s.title}</span>
							{s.approvedFrom && (
								<span className="mono" style={{ fontSize: 10, color: "var(--accent-ink)" }}>
									← {s.approvedFrom}
								</span>
							)}
							<button type="button" className="btn ghost xs">
								<Icons.Edit size={11} />
							</button>
						</div>
					))}
					<button type="button" className="btn ghost sm" style={{ marginTop: 4, alignSelf: "flex-start" }}>
						<Icons.Plus size={11} /> Add section
					</button>
				</div>

				<div className="section-h" style={{ marginTop: 24, marginBottom: 8 }}>
					Pull from
				</div>
				<div className="col gap-2">
					<div style={{ fontSize: 11.5, color: "var(--muted)" }}>
						{ANALYSES.length} approved analyses · {WEBSITE_PROPOSALS.filter((w) => w.state === "approved").length}{" "}
						approved proposals · {INBOX_ITEMS.filter((i) => i.state === "approved").length} approved inbox items
					</div>
				</div>
			</div>

			<div className="news-preview">
				<div className="news-letter">
					<div className="mono masthead-sub" style={{ margin: 0 }}>
						bannaa · issue {NEWSLETTER.issue}
					</div>
					<h1>The orchestrator fallacy, in three templates.</h1>
					<div className="masthead-sub">Sunday · {fmtDate(NEWSLETTER.sendAt)}</div>

					<p>
						Most teams reach for multi-agent orchestration a full step earlier than they need to. This week, three
						lessons from our Agents track arguing the opposite — and a small, copy-pasteable scaffold for teams
						that haven't set up evals yet.
					</p>

					<h2>Concept of the week — Attention</h2>
					<p>
						Attention isn't magic. It's a soft database query: a dot product between a query and a set of keys,
						softmaxed into a weight distribution, and used to mix a set of values. Once you see it geometrically,
						the rest of the transformer falls into place.
					</p>

					<div className="rule" />

					<h2>Three things worth your time</h2>
					<p>
						<strong>
							1. <em>Building effective agents</em>
						</strong>{" "}
						— Anthropic's pattern language for when to chain, when to route, and when to orchestrate. The most
						careful treatment of agent patterns we've seen.
					</p>
					<p>
						<strong>
							2. <em>Attention, visualized</em>
						</strong>{" "}
						— 3Blue1Brown's geometric intuition, with a beautiful rotation-matrix moment around minute 18.
					</p>
					<p>
						<strong>
							3. <em>Textbooks Are All You Need, revisited</em>
						</strong>{" "}
						— Kilcher's two-year retrospective on the Phi line of reasoning.
					</p>

					<div className="rule" />

					<h2>New template</h2>
					<p>
						<strong>Minimal eval loop</strong> — three files (fixtures, runner, scorecard) to get from zero to "we
						can see what's broken" inside a working afternoon. In the Foundations track under Evaluation.
					</p>

					<div className="rule" />

					<div className="arabic-block">
						<h2>من المسرد العربي</h2>
						<p>
							هذا الأسبوع أعدنا ترجمة مصطلح «latent space» إلى «الفضاء الكامن» بدلاً من «الفضاء الخفي» — فالكامن
							يصف شيئاً موجوداً ولكنه غير ظاهر، وهو أقرب إلى المعنى الرياضي.
						</p>
					</div>

					<div className="rule" />
					<p style={{ color: "var(--muted)", fontSize: 13 }}>
						Until next Sunday — <em>m.</em>
					</p>
				</div>
			</div>
		</div>
	);
};
