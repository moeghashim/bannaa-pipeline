"use node";

// Auth-gated action that returns the Postiz integrations list for the
// scheduler UI's account picker. Thin wrapper over the adapter's
// `listIntegrations` — separate from the self-check in status.ts because
// the Settings tile only needs the count + names, while the scheduler
// needs the full shape (IDs + provider slugs + pictures) to render the
// picker.

import { action } from "../_generated/server";
import { requireUser } from "../lib/requireUser";
import { listIntegrations, type PostizIntegration } from "./postiz";

export type PostizIntegrationsResult =
	| { ok: true; integrations: PostizIntegration[] }
	| { ok: false; error: string };

export const listPostizIntegrations = action({
	args: {},
	handler: async (ctx): Promise<PostizIntegrationsResult> => {
		await requireUser(ctx);
		return listIntegrations();
	},
});
