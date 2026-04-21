import { query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

// AST (Arabia Standard Time) = UTC+3, no DST.
const AST_OFFSET_MS = 3 * 60 * 60 * 1000;

function startOfTodayAST(now: number): number {
	const astNow = now + AST_OFFSET_MS;
	const astMidnight = Math.floor(astNow / 86_400_000) * 86_400_000;
	return astMidnight - AST_OFFSET_MS;
}

export const todaySpend = query({
	args: {},
	handler: async (ctx) => {
		await requireUser(ctx);
		const since = startOfTodayAST(Date.now());
		const rows = await ctx.db
			.query("providerRuns")
			.withIndex("by_runAt", (q) => q.gte("runAt", since))
			.collect();
		const total = rows.reduce((acc, r) => acc + r.cost, 0);
		const inputTokens = rows.reduce((acc, r) => acc + r.inputTokens, 0);
		const outputTokens = rows.reduce((acc, r) => acc + r.outputTokens, 0);
		return {
			total,
			runs: rows.length,
			inputTokens,
			outputTokens,
			cap: 6,
		};
	},
});
