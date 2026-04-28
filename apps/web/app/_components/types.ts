export type Source = "x" | "youtube" | "article" | "manual" | "newsletter";
export type State = "new" | "analyzing" | "draft" | "approved" | "rejected" | "published";
export type Lang = "en" | "ar";
export type ProviderId = "claude" | "glm" | "openrouter" | "deepseek";
// External image generators (what the user can pick to generate a base image).
export type ImageProvider = "nano-banana" | "gpt-image" | "grok" | "ideogram" | "openrouter";
// Provider union that may appear on a mediaAsset row. Since the satori
// "hyperframes" compositor was deleted and its legacy rows purged, this is
// now identical to `ImageProvider`.
export type MediaAssetProvider = ImageProvider;
export type MediaKind = "text" | "single-image" | "carousel" | "video";
export type Channel = "x" | "ig" | "ig-reel" | "tiktok" | "yt-shorts" | "fb-page" | "linkedin-page";
export type Track = "Foundations" | "Agents" | "Media";

export type InboxItem = {
	id: string;
	source: Source;
	handle: string;
	title: string;
	snippet: string;
	lang: Lang;
	captured: string;
	state: State;
	url?: string;
	length: number | string;
};

export type Analysis = {
	id: string;
	itemId: string;
	provider: ProviderId;
	runAt: string;
	cost: string;
	tokens: string;
	summary: string;
	concepts: string[];
	track: Track;
	tier: "light" | "medium" | "heavy";
	outputs: { kind: string; hook: string }[];
	keyPoints: string[];
};

export type Draft = {
	id: string;
	channel: Channel;
	ar: string;
	en: string;
	state: State;
	frame: "hyper-square" | "hyper-vertical";
	sourceAnalysis: string;
	concepts: string[];
	scheduled: string | null;
	chars: number;
};

export type ReelIdea = {
	id: string;
	hook: string;
	beats: string[];
	ref: string;
	length: string;
	concepts: string[];
	state: State;
};

export type WebsiteProposal = {
	id: string;
	path: string;
	kind: "concept" | "template" | "blog";
	track: Track;
	en: { title: string; body: string };
	ar: { title: string; body: string };
	state: State;
	pr: { number: number; title: string; branch: string } | null;
};

export type NewsletterSection = {
	kind: string;
	title: string;
	approvedFrom: string | null;
	items?: string[];
};

export type NewsletterData = {
	issue: number;
	date: string;
	sendAt: string;
	status: "assembling" | "ready" | "sent";
	sections: NewsletterSection[];
};

export type ViewKey = "inbox" | "analyses" | "drafts" | "reels" | "newsletter" | "website" | "settings" | "brand";

export type Aesthetic = "quiet" | "terminal" | "softer";
export type Accent = "terracotta" | "indigo" | "forest" | "slate";
export type Density = "default" | "cozy";

export type Tweaks = {
	aesthetic: Aesthetic;
	accent: Accent;
	density: Density;
};

export type CapturePayload = {
	raw: string;
	source: Source;
	url: string | null;
	handle: string;
	title: string | null;
};
