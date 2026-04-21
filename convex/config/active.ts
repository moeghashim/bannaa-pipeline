"use node";

import { action } from "../_generated/server";
import { requireUser } from "../lib/requireUser";
import { activeModelForProvider, defaultProvider } from "../analyze/providers";

export const active = action({
	args: {},
	handler: async (ctx) => {
		await requireUser(ctx);
		const env = {
			GLM_MODEL: process.env.GLM_MODEL,
			OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
			DEFAULT_ANALYZE_PROVIDER: process.env.DEFAULT_ANALYZE_PROVIDER,
		};
		const provider = defaultProvider(env);
		const model = activeModelForProvider(provider, env);
		const keysPresent = {
			anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
			glm: Boolean(process.env.GLM_API_KEY),
			openrouter: Boolean(process.env.OPENROUTER_API_KEY),
		};
		return { provider, model, keysPresent };
	},
});
