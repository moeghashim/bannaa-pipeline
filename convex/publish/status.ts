"use node";

// Live connection check for the Postiz Settings tile. Runs the adapter's
// `selfCheck` ping which hits `GET /me` and reports the connected-channel
// count, so the operator can tell at a glance whether their key is valid
// AND whether they've connected social accounts inside Postiz.
//
// Separate from env/postiz.ts (which is a V8 action that only checks if
// the env var is set) because this one has to import the "use node" adapter.

import { action } from "../_generated/server";
import { requireUser } from "../lib/requireUser";
import { selfCheck, type PostizSelfCheck } from "./postiz";

export const postizStatus = action({
	args: {},
	handler: async (ctx): Promise<PostizSelfCheck> => {
		await requireUser(ctx);
		return selfCheck();
	},
});
