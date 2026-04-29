// Image-generation provider dispatch for Phase 2 · B.2.
//
// All adapters are fetch-based and stay in Convex's V8 runtime (no "use node"),
// so this module can be imported from HTTP endpoints / other V8 code without
// pulling in Node.js-only APIs. Every provider returns PNG bytes + dimensions
// plus an estimated cost so the caller can record a providerRun.

export type ImageProvider = "nano-banana" | "gpt-image" | "grok" | "ideogram" | "openrouter";

export type ImageProviderEnv = {
	GOOGLE_API_KEY?: string;
	OPENAI_API_KEY?: string;
	GROK_API_KEY?: string;
	IDEOGRAM_API_KEY?: string;
	OPENROUTER_API_KEY?: string;
	OPENROUTER_IMAGE_MODEL?: string;
};

export type ImageProviderCall = {
	provider: ImageProvider;
	model: string;
	bytes: Uint8Array;
	width: number;
	height: number;
	cost: number;
};

const DEFAULT_SIZE = 1024;

const DEFAULT_MODELS: Record<ImageProvider, string> = {
	"nano-banana": "gemini-2.5-flash-image",
	"gpt-image": "gpt-image-1",
	grok: "grok-2-image",
	ideogram: "ideogram-v3",
	openrouter: "google/gemini-2.5-flash-image",
};

const DEFAULT_COST: Record<ImageProvider, number> = {
	"nano-banana": 0.04,
	"gpt-image": 0.04,
	grok: 0.07,
	ideogram: 0.08,
	openrouter: 0.04,
};

export function defaultImageModel(provider: ImageProvider, env: ImageProviderEnv): string {
	if (provider === "openrouter") return env.OPENROUTER_IMAGE_MODEL ?? DEFAULT_MODELS.openrouter;
	return DEFAULT_MODELS[provider];
}

export async function callImageProvider(args: {
	provider: ImageProvider;
	prompt: string;
	model?: string;
	env: ImageProviderEnv;
}): Promise<ImageProviderCall> {
	const model = args.model ?? defaultImageModel(args.provider, args.env);
	if (args.provider === "nano-banana") return callNanoBanana(args.prompt, model, args.env);
	if (args.provider === "gpt-image") return callGptImage(args.prompt, model, args.env);
	if (args.provider === "grok") return callGrok(args.prompt, model, args.env);
	if (args.provider === "ideogram") return callIdeogram(args.prompt, model, args.env);
	return callOpenRouterImage(args.prompt, model, args.env);
}

// Image-edit dispatch — used by the overlay/baked path so the text+chrome
// pass operates on the *actual* base PNG instead of re-rolling the scene.
// Today only gpt-image is wired (its `/v1/images/edits` endpoint accepts a
// PNG + prompt and preserves the underlying scene while baking text on top).
// Other providers throw with an explicit message so a misconfigured override
// fails loudly at action time rather than silently falling back to scene
// re-generation. When we add ideogram-edit / nano-banana multi-modal-edit
// support, extend this dispatch + the overlay-provider validator together.
export async function callImageProviderEdit(args: {
	provider: ImageProvider;
	prompt: string;
	model?: string;
	env: ImageProviderEnv;
	inputImage: Uint8Array;
}): Promise<ImageProviderCall> {
	const model = args.model ?? defaultImageModel(args.provider, args.env);
	if (args.provider === "gpt-image") return callGptImageEdit(args.prompt, model, args.env, args.inputImage);
	throw new Error(
		`Image-edit (overlay) is not implemented for provider "${args.provider}". ` +
			`Only "gpt-image" is supported today — change the overlay model in Settings to a gpt-image model, ` +
			`or extend providers.ts with an edit endpoint for "${args.provider}".`,
	);
}

function base64ToBytes(b64: string): Uint8Array {
	const clean = b64.replace(/^data:[^;]+;base64,/, "");
	const bin = atob(clean);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
	return out;
}

async function callNanoBanana(prompt: string, model: string, env: ImageProviderEnv): Promise<ImageProviderCall> {
	const apiKey = env.GOOGLE_API_KEY;
	if (!apiKey) throw new Error("GOOGLE_API_KEY is not configured in Convex env");

	const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
	const resp = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`Nano Banana ${resp.status}: ${text.slice(0, 400)}`);
	}
	const json = (await resp.json()) as {
		candidates?: Array<{
			content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
		}>;
	};
	const parts = json.candidates?.[0]?.content?.parts ?? [];
	const imagePart = parts.find((p) => p.inlineData?.data);
	const b64 = imagePart?.inlineData?.data;
	if (!b64) throw new Error("Nano Banana returned no image data");
	return {
		provider: "nano-banana",
		model,
		bytes: base64ToBytes(b64),
		width: DEFAULT_SIZE,
		height: DEFAULT_SIZE,
		cost: DEFAULT_COST["nano-banana"],
	};
}

async function callGptImage(prompt: string, model: string, env: ImageProviderEnv): Promise<ImageProviderCall> {
	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) throw new Error("OPENAI_API_KEY is not configured in Convex env");

	const resp = await fetch("https://api.openai.com/v1/images/generations", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1 }),
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`GPT Image ${resp.status}: ${text.slice(0, 400)}`);
	}
	const json = (await resp.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
	const first = json.data?.[0];
	if (!first) throw new Error("GPT Image returned no data[]");
	const bytes = first.b64_json
		? base64ToBytes(first.b64_json)
		: first.url
			? await fetchUrlBytes(first.url)
			: null;
	if (!bytes) throw new Error("GPT Image returned neither b64_json nor url");
	return {
		provider: "gpt-image",
		model,
		bytes,
		width: DEFAULT_SIZE,
		height: DEFAULT_SIZE,
		cost: DEFAULT_COST["gpt-image"],
	};
}

async function callGrok(prompt: string, model: string, env: ImageProviderEnv): Promise<ImageProviderCall> {
	const apiKey = env.GROK_API_KEY;
	if (!apiKey) throw new Error("GROK_API_KEY is not configured in Convex env");

	const resp = await fetch("https://api.x.ai/v1/images/generations", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ model, prompt, n: 1, response_format: "b64_json" }),
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`Grok image ${resp.status}: ${text.slice(0, 400)}`);
	}
	const json = (await resp.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
	const first = json.data?.[0];
	if (!first) throw new Error("Grok image returned no data[]");
	const bytes = first.b64_json
		? base64ToBytes(first.b64_json)
		: first.url
			? await fetchUrlBytes(first.url)
			: null;
	if (!bytes) throw new Error("Grok image returned neither b64_json nor url");
	return {
		provider: "grok",
		model,
		bytes,
		width: DEFAULT_SIZE,
		height: DEFAULT_SIZE,
		cost: DEFAULT_COST.grok,
	};
}

async function callIdeogram(prompt: string, model: string, env: ImageProviderEnv): Promise<ImageProviderCall> {
	const apiKey = env.IDEOGRAM_API_KEY;
	if (!apiKey) throw new Error("IDEOGRAM_API_KEY is not configured in Convex env");

	// Ideogram v3 expects multipart/form-data with an Api-Key header (not Bearer).
	const form = new FormData();
	form.set("prompt", prompt);
	form.set("aspect_ratio", "1x1");
	form.set("rendering_speed", "DEFAULT");
	form.set("num_images", "1");

	const resp = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
		method: "POST",
		headers: { "Api-Key": apiKey },
		body: form,
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`Ideogram ${resp.status}: ${text.slice(0, 400)}`);
	}
	const json = (await resp.json()) as { data?: Array<{ url?: string }> };
	const signed = json.data?.[0]?.url;
	if (!signed) throw new Error("Ideogram returned no signed url");
	const bytes = await fetchUrlBytes(signed);
	return {
		provider: "ideogram",
		model,
		bytes,
		width: DEFAULT_SIZE,
		height: DEFAULT_SIZE,
		cost: DEFAULT_COST.ideogram,
	};
}

async function callOpenRouterImage(
	prompt: string,
	model: string,
	env: ImageProviderEnv,
): Promise<ImageProviderCall> {
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured in Convex env");

	const resp = await fetch("https://openrouter.ai/api/v1/images/generations", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			"HTTP-Referer": "https://github.com/moeghashim/bannaa-pipeline",
			"X-Title": "bannaa-pipeline",
		},
		body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1 }),
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`OpenRouter image ${resp.status}: ${text.slice(0, 400)}`);
	}
	const json = (await resp.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
	const first = json.data?.[0];
	if (!first) throw new Error("OpenRouter image returned no data[]");
	const bytes = first.b64_json
		? base64ToBytes(first.b64_json)
		: first.url
			? await fetchUrlBytes(first.url)
			: null;
	if (!bytes) throw new Error("OpenRouter image returned neither b64_json nor url");
	return {
		provider: "openrouter",
		model,
		bytes,
		width: DEFAULT_SIZE,
		height: DEFAULT_SIZE,
		cost: DEFAULT_COST.openrouter,
	};
}

// OpenAI image-edit: send the base PNG via multipart/form-data along with
// the edit prompt. The model preserves the underlying image and applies the
// instructed changes (in our case: render caption + brand chrome on top).
// gpt-image-2 supports the same /v1/images/edits route as gpt-image-1, so
// the operator can swap models in Settings without code changes.
async function callGptImageEdit(
	prompt: string,
	model: string,
	env: ImageProviderEnv,
	inputImage: Uint8Array,
): Promise<ImageProviderCall> {
	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) throw new Error("OPENAI_API_KEY is not configured in Convex env");

	const form = new FormData();
	const blob = new Blob([inputImage as BlobPart], { type: "image/png" });
	form.set("image", blob, "base.png");
	form.set("model", model);
	form.set("prompt", prompt);
	form.set("size", "1024x1024");
	form.set("n", "1");

	const resp = await fetch("https://api.openai.com/v1/images/edits", {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}` },
		body: form,
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`GPT Image edit ${resp.status}: ${text.slice(0, 400)}`);
	}
	const json = (await resp.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
	const first = json.data?.[0];
	if (!first) throw new Error("GPT Image edit returned no data[]");
	const bytes = first.b64_json
		? base64ToBytes(first.b64_json)
		: first.url
			? await fetchUrlBytes(first.url)
			: null;
	if (!bytes) throw new Error("GPT Image edit returned neither b64_json nor url");
	return {
		provider: "gpt-image",
		model,
		bytes,
		width: DEFAULT_SIZE,
		height: DEFAULT_SIZE,
		cost: DEFAULT_COST["gpt-image"],
	};
}

async function fetchUrlBytes(url: string): Promise<Uint8Array> {
	const resp = await fetch(url);
	if (!resp.ok) throw new Error(`Failed to fetch image bytes: ${resp.status}`);
	const buf = await resp.arrayBuffer();
	return new Uint8Array(buf);
}
