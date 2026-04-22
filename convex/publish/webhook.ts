// Postiz webhook receiver.
//
// Postiz POSTs to our public URL whenever a scheduled post transitions
// state (publishing, published, failed). We extract the post id + new
// status from the body, look up the matching draft by `postizPostId`, and
// patch the state + permalink.
//
// Lives in the V8 runtime — no heavy deps, just a fetch handler.
//
// Security: Postiz doesn't currently sign webhooks in their public API.
// We gate on a shared secret in the URL path (`POSTIZ_WEBHOOK_SECRET`)
// because a random post-id in the body alone isn't authentication — an
// attacker who guessed a postizPostId could forge a "published" event.
// Rotate the secret via `npx convex env set POSTIZ_WEBHOOK_SECRET <new>`
// and update the webhook URL in the Postiz dashboard to match.

import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const handleWebhook = httpAction(async (ctx, request) => {
	const configured = process.env.POSTIZ_WEBHOOK_SECRET;
	if (!configured) {
		return new Response("webhook secret not configured", { status: 503 });
	}
	const url = new URL(request.url);
	const provided = url.searchParams.get("secret");
	if (!provided || provided !== configured) {
		return new Response("unauthorized", { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response("invalid json", { status: 400 });
	}
	if (typeof body !== "object" || body === null) {
		return new Response("expected object body", { status: 400 });
	}
	const b = body as Record<string, unknown>;

	// Postiz's event payloads vary by version. Accept several common
	// shapes: `{ postId, status, permalink? }` or nested under
	// `data`/`post`. The stable signal is a post id + a status string.
	const postizPostId =
		typeof b.postId === "string"
			? b.postId
			: typeof b.id === "string"
				? b.id
				: extractNested(b, "postId") ?? extractNested(b, "id");
	if (!postizPostId) {
		return new Response("no postId in payload", { status: 400 });
	}
	const status = typeof b.status === "string" ? b.status : extractNested(b, "status");
	const permalink =
		typeof b.permalink === "string"
			? b.permalink
			: typeof b.url === "string"
				? b.url
				: extractNested(b, "permalink") ?? extractNested(b, "url");
	const error = typeof b.error === "string" ? b.error : extractNested(b, "error");

	let patched = false;
	if (status === "published" || status === "success" || status === "posted") {
		patched = await ctx.runMutation(internal.publish.internal.markPublished, {
			postizPostId,
			permalink: permalink ?? undefined,
		});
	} else if (status === "publishing" || status === "sending") {
		patched = await ctx.runMutation(internal.publish.internal.markPublishing, {
			postizPostId,
		});
	} else if (status === "failed" || status === "error") {
		patched = await ctx.runMutation(internal.publish.internal.markFailed, {
			postizPostId,
			error: error ?? "Postiz reported failure with no error field",
		});
	}
	// Unknown / intermediate statuses are acked with 200 but not persisted
	// — we only model the three terminal-ish states today.

	return new Response(patched ? "ok" : "no matching draft", { status: 200 });
});

function extractNested(obj: Record<string, unknown>, key: string): string | null {
	for (const nestKey of ["data", "post", "payload"]) {
		const nested = obj[nestKey];
		if (typeof nested !== "object" || nested === null) continue;
		const v = (nested as Record<string, unknown>)[key];
		if (typeof v === "string") return v;
	}
	return null;
}
