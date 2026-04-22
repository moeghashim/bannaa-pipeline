// Auth-gated action that reports whether each image-provider API key is set
// in the Convex environment. We use an action (not a query) because
// `process.env` reads happen at runtime inside the V8 action, which matches
// the pattern already established in convex/config/active.ts.

import { action } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export type ImageKeysPresent = {
	google: boolean;
	openai: boolean;
	grok: boolean;
	ideogram: boolean;
	openrouter: boolean;
};

export const imageKeysPresent = action({
	args: {},
	handler: async (ctx): Promise<ImageKeysPresent> => {
		await requireUser(ctx);
		return {
			google: Boolean(process.env.GOOGLE_API_KEY),
			openai: Boolean(process.env.OPENAI_API_KEY),
			grok: Boolean(process.env.GROK_API_KEY),
			ideogram: Boolean(process.env.IDEOGRAM_API_KEY),
			openrouter: Boolean(process.env.OPENROUTER_API_KEY),
		};
	},
});
