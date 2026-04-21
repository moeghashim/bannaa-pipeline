import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { ANALYZE_SYSTEM_PROMPT, ANALYZE_TOOL, type AnalyzeToolOutput } from "./prompts";

export type ProviderId = "claude" | "glm" | "openrouter";

export type ProviderCall = {
	provider: ProviderId;
	model: string;
	output: AnalyzeToolOutput;
	inputTokens: number;
	outputTokens: number;
	cost: number;
};

type ProviderEnv = {
	ANTHROPIC_API_KEY?: string;
	GLM_API_KEY?: string;
	GLM_MODEL?: string;
	OPENROUTER_API_KEY?: string;
	OPENROUTER_MODEL?: string;
	DEFAULT_ANALYZE_PROVIDER?: string;
};

const CLAUDE_MODEL = "claude-sonnet-4-6";
const DEFAULT_GLM_MODEL = "glm-5.1";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4-6";

const PRICING: Record<string, { input: number; output: number }> = {
	"claude-sonnet-4-6": { input: 3.0, output: 15.0 },
	"glm-5.1": { input: 0.6, output: 1.8 },
	"glm-4.6": { input: 0.6, output: 1.8 },
	"glm-4-plus": { input: 0.6, output: 1.8 },
	"anthropic/claude-sonnet-4-6": { input: 3.0, output: 15.0 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

function priceFor(model: string): { input: number; output: number } {
	return PRICING[model] ?? DEFAULT_PRICING;
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
	const p = priceFor(model);
	return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

export function defaultProvider(env: ProviderEnv): ProviderId {
	const raw = (env.DEFAULT_ANALYZE_PROVIDER ?? "glm").toLowerCase();
	if (raw === "claude" || raw === "glm" || raw === "openrouter") return raw;
	return "glm";
}

export function activeModelForProvider(provider: ProviderId, env: ProviderEnv): string {
	if (provider === "claude") return CLAUDE_MODEL;
	if (provider === "glm") return env.GLM_MODEL ?? DEFAULT_GLM_MODEL;
	return env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
}

export async function callProvider(args: {
	provider: ProviderId;
	userPrompt: string;
	env: ProviderEnv;
}): Promise<ProviderCall> {
	if (args.provider === "claude") return callClaude(args.userPrompt, args.env);
	if (args.provider === "glm") return callGLM(args.userPrompt, args.env);
	return callOpenRouter(args.userPrompt, args.env);
}

async function callClaude(userPrompt: string, env: ProviderEnv): Promise<ProviderCall> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured in Convex env");

	const client = new Anthropic({ apiKey });
	const message = await client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: 2048,
		system: ANALYZE_SYSTEM_PROMPT,
		tools: [ANALYZE_TOOL],
		tool_choice: { type: "tool", name: ANALYZE_TOOL.name },
		messages: [{ role: "user", content: userPrompt }],
	});

	const inputTokens = message.usage.input_tokens;
	const outputTokens = message.usage.output_tokens;

	const toolUse = message.content.find((c) => c.type === "tool_use" && c.name === ANALYZE_TOOL.name);
	if (!toolUse || toolUse.type !== "tool_use") {
		throw new Error("Claude did not call record_analysis tool");
	}

	return {
		provider: "claude",
		model: CLAUDE_MODEL,
		output: toolUse.input as AnalyzeToolOutput,
		inputTokens,
		outputTokens,
		cost: estimateCost(CLAUDE_MODEL, inputTokens, outputTokens),
	};
}

async function callGLM(userPrompt: string, env: ProviderEnv): Promise<ProviderCall> {
	const apiKey = env.GLM_API_KEY;
	if (!apiKey) throw new Error("GLM_API_KEY is not configured in Convex env");

	const model = env.GLM_MODEL ?? DEFAULT_GLM_MODEL;
	const client = new OpenAI({
		apiKey,
		baseURL: "https://open.bigmodel.cn/api/paas/v4",
	});

	return callOpenAICompatible({
		client,
		model,
		provider: "glm",
		userPrompt,
	});
}

async function callOpenRouter(userPrompt: string, env: ProviderEnv): Promise<ProviderCall> {
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured in Convex env");

	const model = env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
	const client = new OpenAI({
		apiKey,
		baseURL: "https://openrouter.ai/api/v1",
		defaultHeaders: {
			"HTTP-Referer": "https://github.com/moeghashim/bannaa-pipeline",
			"X-Title": "bannaa-pipeline",
		},
	});

	return callOpenAICompatible({
		client,
		model,
		provider: "openrouter",
		userPrompt,
	});
}

async function callOpenAICompatible(args: {
	client: OpenAI;
	model: string;
	provider: ProviderId;
	userPrompt: string;
}): Promise<ProviderCall> {
	const response = await args.client.chat.completions.create({
		model: args.model,
		max_tokens: 2048,
		messages: [
			{ role: "system", content: ANALYZE_SYSTEM_PROMPT },
			{ role: "user", content: args.userPrompt },
		],
		tools: [
			{
				type: "function",
				function: {
					name: ANALYZE_TOOL.name,
					description: ANALYZE_TOOL.description,
					parameters: ANALYZE_TOOL.input_schema,
				},
			},
		],
		tool_choice: {
			type: "function",
			function: { name: ANALYZE_TOOL.name },
		},
	});

	const choice = response.choices[0];
	if (!choice) throw new Error(`${args.provider} returned no choices`);

	const toolCall = choice.message.tool_calls?.[0];
	if (!toolCall || toolCall.type !== "function" || toolCall.function.name !== ANALYZE_TOOL.name) {
		throw new Error(`${args.provider} did not call record_analysis tool`);
	}

	let parsed: AnalyzeToolOutput;
	try {
		parsed = JSON.parse(toolCall.function.arguments) as AnalyzeToolOutput;
	} catch (err) {
		throw new Error(`${args.provider} returned invalid JSON tool arguments: ${err instanceof Error ? err.message : String(err)}`);
	}

	const usage = response.usage;
	const inputTokens = usage?.prompt_tokens ?? 0;
	const outputTokens = usage?.completion_tokens ?? 0;

	return {
		provider: args.provider,
		model: args.model,
		output: parsed,
		inputTokens,
		outputTokens,
		cost: estimateCost(args.model, inputTokens, outputTokens),
	};
}
