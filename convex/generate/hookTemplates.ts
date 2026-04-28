import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

const channelValidator = v.union(
	v.literal("x"),
	v.literal("ig"),
	v.literal("ig-reel"),
	v.literal("tiktok"),
	v.literal("yt-shorts"),
	v.literal("fb-page"),
	v.literal("linkedin-page"),
);

/**
 * Picks the least-used non-blocked hook template for a channel. Starred
 * patterns get priority within the same usedCount tier — the operator's
 * vote outweighs raw rotation.
 */
export const pickForChannel = internalQuery({
	args: { channel: channelValidator },
	handler: async (ctx, { channel }): Promise<Doc<"hookTemplates"> | null> => {
		const rows = await ctx.db
			.query("hookTemplates")
			.withIndex("by_channel_used", (q) => q.eq("channel", channel))
			.order("asc")
			.take(20);
		const active = rows.filter((r) => !r.blocked);
		if (active.length === 0) return null;
		const minUsed = active[0].usedCount;
		const tier = active.filter((r) => r.usedCount === minUsed);
		const starred = tier.find((r) => r.starred);
		return starred ?? tier[0];
	},
});

export const incrementUsage = internalMutation({
	args: { id: v.id("hookTemplates") },
	handler: async (ctx, { id }): Promise<void> => {
		const row = await ctx.db.get(id);
		if (!row) return;
		await ctx.db.patch(id, { usedCount: row.usedCount + 1 });
	},
});

const STARTER_PATTERNS: Array<{ channel: Doc<"hookTemplates">["channel"]; pattern: string }> = [
	{ channel: "x", pattern: "Here's the part most people miss about {topic}:" },
	{ channel: "x", pattern: "{topic} just changed. The interesting bit:" },
	{ channel: "x", pattern: "If you only learn one thing about {topic} this week — make it this:" },
	{ channel: "ig", pattern: "Most explanations of {topic} skip the mechanism. Let me fix that." },
	{ channel: "ig", pattern: "I used to think {topic} was magic. Then I traced the steps." },
	{ channel: "ig-reel", pattern: "60 seconds on why {topic} is actually about {core_idea}." },
	{ channel: "tiktok", pattern: "POV: you finally understand {topic} after this clip." },
	{ channel: "yt-shorts", pattern: "{topic}, but in plain English." },
	{ channel: "fb-page", pattern: "A short note on what's actually happening with {topic}." },
	{
		channel: "linkedin-page",
		pattern: "Three sentences on {topic} that I wish more people in this space understood:",
	},
];

/**
 * One-shot seeder. Idempotent: if a pattern with the same (channel, pattern)
 * already exists, it is left alone. Run via:
 *   npx convex run generate/hookTemplates:seedStarters
 */
export const seedStarters = internalMutation({
	args: {},
	handler: async (ctx): Promise<{ inserted: number; skipped: number }> => {
		let inserted = 0;
		let skipped = 0;
		for (const t of STARTER_PATTERNS) {
			const existing = await ctx.db
				.query("hookTemplates")
				.withIndex("by_channel", (q) => q.eq("channel", t.channel))
				.collect();
			if (existing.some((r) => r.pattern === t.pattern)) {
				skipped += 1;
				continue;
			}
			await ctx.db.insert("hookTemplates", {
				channel: t.channel,
				pattern: t.pattern,
				usedCount: 0,
				createdAt: Date.now(),
			});
			inserted += 1;
		}
		return { inserted, skipped };
	},
});
