// Auth-gated action that reports whether the Postiz hosted-plan API key is
// set in the Convex environment. Mirrors env/imageKeys.ts — we use an action
// (not a query) so the `process.env` read happens at runtime inside the V8
// action, which matches the pattern established in convex/config/active.ts.
//
// The Settings tile renders a green/red pill off this.

import { action } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export type PostizKeyPresent = {
	apiKey: boolean;
};

export const postizKeyPresent = action({
	args: {},
	handler: async (ctx): Promise<PostizKeyPresent> => {
		await requireUser(ctx);
		return {
			apiKey: Boolean(process.env.POSTIZ_API_KEY),
		};
	},
});
