"use client";

import { Icons } from "../icons";
import type { ImageProvider } from "../types";

const IMAGE_PROVIDERS: { k: ImageProvider; name: string }[] = [
	{ k: "nano-banana", name: "Nano Banana" },
	{ k: "gpt-image", name: "GPT Image" },
	{ k: "grok", name: "Grok" },
	{ k: "ideogram", name: "Ideogram" },
	{ k: "openrouter", name: "OpenRouter" },
];

export const ImageProviderPicker = ({
	active,
	onPick,
	onClose,
}: {
	active: ImageProvider;
	onPick: (provider: ImageProvider) => void;
	onClose: () => void;
}) => {
	return (
		<div
			role="menu"
			aria-label="Choose image provider"
			style={{
				position: "absolute",
				bottom: "calc(100% + 4px)",
				right: 0,
				zIndex: 5,
				background: "var(--surface)",
				border: "1px solid var(--border)",
				borderRadius: "var(--r-md)",
				padding: 6,
				minWidth: 180,
				boxShadow: "var(--shadow-md)",
			}}
		>
			<div
				className="mono"
				style={{
					fontSize: 10,
					color: "var(--muted)",
					padding: "4px 6px",
					textTransform: "uppercase",
					letterSpacing: "0.08em",
				}}
			>
				choose provider
			</div>
			{IMAGE_PROVIDERS.map((p) => (
				<button
					key={p.k}
					type="button"
					className="btn ghost xs"
					onClick={() => onPick(p.k)}
					style={{
						display: "flex",
						justifyContent: "space-between",
						width: "100%",
						padding: "6px 8px",
						fontSize: 12,
					}}
				>
					<span>{p.name}</span>
					{active === p.k && <Icons.Check size={11} sw={2} style={{ color: "var(--accent-ink)" }} />}
				</button>
			))}
			<button
				type="button"
				className="btn ghost xs"
				onClick={onClose}
				style={{ width: "100%", marginTop: 4, fontSize: 11 }}
			>
				cancel
			</button>
		</div>
	);
};
