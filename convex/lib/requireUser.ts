import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

export async function requireUser(ctx: AnyCtx): Promise<Id<"users">> {
	const userId = await getAuthUserId(ctx);
	if (!userId) {
		throw new Error("Not signed in");
	}
	return userId;
}
