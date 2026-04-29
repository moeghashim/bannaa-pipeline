// Per-language sample caption used in the brand-preview baked image prompt.
// Short, neutral phrasing about agentic AI — long enough to test typography,
// short enough to fit the bottom-caption slot without wrapping awkwardly.

import type { OutputLanguage } from "../generate/languages";

const SAMPLE: Record<OutputLanguage, string> = {
	en: "An AI agent needs a clear review loop",
	"ar-msa": "وكيلٌ ذكيٌّ يحتاج إلى حلقةِ مراجعةٍ واضحة",
	"ar-saudi": "وكيل ذكي يحتاج حلقة مراجعة واضحة",
	"ar-egy": "العميل الذكي محتاج حلقة مراجعة واضحة",
	es: "Un agente de IA necesita un ciclo claro de revisión",
	fr: "Un agent IA a besoin d'une boucle de revue claire",
	de: "Ein KI-Agent braucht eine klare Review-Schleife",
	it: "Un agente IA ha bisogno di un ciclo di revisione chiaro",
	"pt-br": "Um agente de IA precisa de um ciclo claro de revisão",
	nl: "Een AI-agent heeft een duidelijke review-lus nodig",
	ru: "ИИ-агенту нужен понятный цикл проверки",
	tr: "Bir yapay zeka ajanı net bir inceleme döngüsüne ihtiyaç duyar",
	fa: "یک عامل هوش مصنوعی به حلقهٔ بازبینی روشنی نیاز دارد",
	ur: "ایک اے آئی ایجنٹ کو واضح جائزہ لُوپ درکار ہے",
	hi: "एक एआई एजेंट को स्पष्ट समीक्षा लूप चाहिए",
	bn: "একটি এআই এজেন্টের একটি স্পষ্ট পর্যালোচনা লুপ দরকার",
	id: "Agen AI butuh siklus tinjauan yang jelas",
	ja: "AIエージェントには明確なレビューループが必要だ",
	ko: "AI 에이전트에는 명확한 리뷰 루프가 필요하다",
	"zh-cn": "AI 智能体需要清晰的审查回路",
	"zh-tw": "AI 智慧代理需要清晰的審查迴圈",
};

export function sampleCaptionFor(lang: OutputLanguage): string {
	return SAMPLE[lang];
}
