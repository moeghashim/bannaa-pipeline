import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { ANALYZE_SYSTEM_PROMPT, ANALYZE_TOOL, type AnalyzeToolOutput } from "./prompts";

export type ProviderId = "claude" | "glm" | "openrouter" | "deepseek";

export type ToolSpec = {
	name: string;
	description: string;
	input_schema: Record<string, unknown>;
};

export type ProviderCall<T = AnalyzeToolOutput> = {
	provider: ProviderId;
	model: string;
	output: T;
	inputTokens: number;
	outputTokens: number;
	cost: number;
};

export type ProviderEnv = {
	ANTHROPIC_API_KEY?: string;
	GLM_API_KEY?: string;
	GLM_MODEL?: string;
	OPENROUTER_API_KEY?: string;
	OPENROUTER_MODEL?: string;
	DEEPSEEK_API_KEY?: string;
	DEFAULT_ANALYZE_PROVIDER?: string;
};

const CLAUDE_MODEL = "claude-sonnet-4-6";
const DEFAULT_GLM_MODEL = "glm-5.1";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4-6";
const DEEPSEEK_MODEL = "deepseek-v4-pro";

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
	if (raw === "claude" || raw === "glm" || raw === "openrouter" || raw === "deepseek") return raw;
	return "glm";
}

export function activeModelForProvider(provider: ProviderId, env: ProviderEnv): string {
	if (provider === "claude") return CLAUDE_MODEL;
	if (provider === "glm") return env.GLM_MODEL ?? DEFAULT_GLM_MODEL;
	if (provider === "deepseek") return DEEPSEEK_MODEL;
	return env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
}

export async function callProvider<T = AnalyzeToolOutput>(args: {
	provider: ProviderId;
	systemPrompt?: string;
	tool?: ToolSpec;
	userPrompt: string;
	env: ProviderEnv;
}): Promise<ProviderCall<T>> {
	const systemPrompt = args.systemPrompt ?? ANALYZE_SYSTEM_PROMPT;
	const tool = (args.tool ?? ANALYZE_TOOL) as ToolSpec;
	if (args.provider === "claude") return callClaude<T>(systemPrompt, tool, args.userPrompt, args.env);
	if (args.provider === "glm") return callGLM<T>(systemPrompt, tool, args.userPrompt, args.env);
	if (args.provider === "deepseek") return callDeepSeek<T>(systemPrompt, tool, args.userPrompt, args.env);
	return callOpenRouter<T>(systemPrompt, tool, args.userPrompt, args.env);
}

async function callClaude<T>(
	systemPrompt: string,
	tool: ToolSpec,
	userPrompt: string,
	env: ProviderEnv,
): Promise<ProviderCall<T>> {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured in Convex env");

	const client = new Anthropic({ apiKey });
	const message = await client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: 2048,
		system: systemPrompt,
		tools: [
			{
				name: tool.name,
				description: tool.description,
				input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
			},
		],
		tool_choice: { type: "tool", name: tool.name },
		messages: [{ role: "user", content: userPrompt }],
	});

	const inputTokens = message.usage.input_tokens;
	const outputTokens = message.usage.output_tokens;

	const toolUse = message.content.find((c) => c.type === "tool_use" && c.name === tool.name);
	if (!toolUse || toolUse.type !== "tool_use") {
		throw new Error(`Claude did not call ${tool.name} tool`);
	}

	return {
		provider: "claude",
		model: CLAUDE_MODEL,
		output: toolUse.input as T,
		inputTokens,
		outputTokens,
		cost: estimateCost(CLAUDE_MODEL, inputTokens, outputTokens),
	};
}

async function callGLM<T>(
	systemPrompt: string,
	tool: ToolSpec,
	userPrompt: string,
	env: ProviderEnv,
): Promise<ProviderCall<T>> {
	const apiKey = env.GLM_API_KEY;
	if (!apiKey) throw new Error("GLM_API_KEY is not configured in Convex env");

	const model = env.GLM_MODEL ?? DEFAULT_GLM_MODEL;
	const client = new OpenAI({
		apiKey,
		baseURL: "https://open.bigmodel.cn/api/paas/v4",
	});

	return callOpenAICompatible<T>({
		client,
		model,
		provider: "glm",
		systemPrompt,
		tool,
		userPrompt,
	});
}

async function callDeepSeek<T>(
	systemPrompt: string,
	tool: ToolSpec,
	userPrompt: string,
	env: ProviderEnv,
): Promise<ProviderCall<T>> {
	const apiKey = env.DEEPSEEK_API_KEY;
	if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured in Convex env");

	const client = new OpenAI({
		apiKey,
		baseURL: "https://api.deepseek.com",
	});

	return callOpenAICompatible<T>({
		client,
		model: DEEPSEEK_MODEL,
		provider: "deepseek",
		systemPrompt,
		tool,
		userPrompt,
		// DeepSeek's reasoning models reject forced `tool_choice` while thinking
		// is enabled. Our analyze/draft/translate flows force a single tool
		// call, so we turn thinking off for these one-shot structured outputs.
		extraBody: { thinking: { type: "disabled" } },
	});
}

async function callOpenRouter<T>(
	systemPrompt: string,
	tool: ToolSpec,
	userPrompt: string,
	env: ProviderEnv,
): Promise<ProviderCall<T>> {
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

	return callOpenAICompatible<T>({
		client,
		model,
		provider: "openrouter",
		systemPrompt,
		tool,
		userPrompt,
	});
}

async function callOpenAICompatible<T>(args: {
	client: OpenAI;
	model: string;
	provider: ProviderId;
	systemPrompt: string;
	tool: ToolSpec;
	userPrompt: string;
	extraBody?: Record<string, unknown>;
}): Promise<ProviderCall<T>> {
	const response = await args.client.chat.completions.create({
		model: args.model,
		max_tokens: 2048,
		messages: [
			{ role: "system", content: args.systemPrompt },
			{ role: "user", content: args.userPrompt },
		],
		tools: [
			{
				type: "function",
				function: {
					name: args.tool.name,
					description: args.tool.description,
					parameters: args.tool.input_schema,
				},
			},
		],
		tool_choice: {
			type: "function",
			function: { name: args.tool.name },
		},
		// Provider-specific fields (e.g. DeepSeek `thinking: { type: "disabled" }`).
		// The SDK's typed params don't include arbitrary fields, so spread via cast.
		...(args.extraBody as Record<string, never> | undefined),
	});

	const choice = response.choices[0];
	if (!choice) throw new Error(`${args.provider} returned no choices`);

	const toolCall = choice.message.tool_calls?.[0];
	if (!toolCall || toolCall.type !== "function" || toolCall.function.name !== args.tool.name) {
		throw new Error(`${args.provider} did not call ${args.tool.name} tool`);
	}

	let parsed: T;
	try {
		parsed = JSON.parse(toolCall.function.arguments) as T;
	} catch (err) {
		throw new Error(
			`${args.provider} returned invalid JSON tool arguments: ${err instanceof Error ? err.message : String(err)}`,
		);
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
