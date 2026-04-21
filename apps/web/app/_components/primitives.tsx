import type { CSSProperties } from "react";
import { Icons } from "./icons";
import type { Source, State } from "./types";

export const Chip = ({ state = "new", label, style }: { state?: State; label?: string; style?: CSSProperties }) => (
	<span className="chip" data-state={state} style={style}>
		<span className="dot" />
		{label || state}
	</span>
);

const SOURCE_LABEL: Record<Source, string> = {
	x: "x.com",
	youtube: "youtube",
	article: "article",
	manual: "manual",
	newsletter: "newsletter",
};

export const SourceBadge = ({ source, handle, compact }: { source: Source; handle?: string; compact?: boolean }) => (
	<span className="source">
		<span className={`sq ${source}`} />
		{compact ? SOURCE_LABEL[source] : handle || SOURCE_LABEL[source]}
	</span>
);

export const HyperFrame = ({
	variant = "square",
	ar,
	en,
	channel,
	small,
}: {
	variant?: "square" | "vertical";
	ar: string;
	en?: string;
	channel: string;
	small?: boolean;
}) => {
	const ratio = variant === "vertical" ? 9 / 16 : 1;
	const w = small ? 140 : 200;
	const h = w / ratio;
	const gradId = `hf-g-${variant}`;

	return (
		<div
			className="hyperframe"
			style={{
				width: w,
				height: h,
				position: "relative",
				borderRadius: "var(--r-md)",
				overflow: "hidden",
				background: "oklch(0.22 0.01 270)",
				flexShrink: 0,
			}}
		>
			<svg
				viewBox="0 0 200 200"
				preserveAspectRatio="xMidYMid slice"
				style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5 }}
				aria-hidden
				role="presentation"
			>
				<title>HyperFrame backdrop</title>
				<defs>
					<linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stopColor="oklch(0.35 0.08 38)" />
						<stop offset="1" stopColor="oklch(0.18 0.02 270)" />
					</linearGradient>
				</defs>
				<rect width="200" height="200" fill={`url(#${gradId})`} />
				<circle cx="160" cy="-10" r="90" fill="oklch(0.55 0.14 38 / 0.25)" />
				<circle cx="-20" cy="200" r="120" fill="oklch(0.95 0.003 95 / 0.05)" />
				<g stroke="oklch(0.95 0.003 95 / 0.15)" strokeWidth="0.5" fill="none">
					{Array.from({ length: 8 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static grid lines
						<line key={i} x1="0" y1={25 * i} x2="200" y2={25 * i} />
					))}
				</g>
			</svg>

			<div
				style={{
					position: "absolute",
					top: 8,
					left: 10,
					right: 10,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					fontFamily: "var(--font-mono)",
					fontSize: 9,
					color: "oklch(0.95 0.003 95 / 0.6)",
					letterSpacing: "0.08em",
					textTransform: "uppercase",
				}}
			>
				<span>bannaa · {channel}</span>
				<span>AR</span>
			</div>

			<div
				style={{
					position: "absolute",
					inset: 0,
					padding: small ? "0 12px" : "0 16px",
					display: "flex",
					flexDirection: "column",
					justifyContent: "flex-end",
					paddingBottom: small ? 14 : 20,
				}}
			>
				<div
					dir="rtl"
					style={{
						fontFamily: "var(--font-ar)",
						color: "oklch(0.98 0.005 95)",
						fontSize: small ? 13 : variant === "vertical" ? 18 : 16,
						lineHeight: 1.4,
						fontWeight: 500,
						textWrap: "balance",
					}}
				>
					{ar}
				</div>
				{!small && en && (
					<div
						style={{
							marginTop: 8,
							fontFamily: "var(--font-sans)",
							color: "oklch(0.95 0.003 95 / 0.55)",
							fontSize: 10,
							lineHeight: 1.3,
							fontStyle: "italic",
						}}
					>
						{en}
					</div>
				)}
			</div>

			<div
				style={{
					position: "absolute",
					bottom: 8,
					left: 10,
					fontFamily: "var(--font-mono)",
					fontSize: 9,
					color: "oklch(0.95 0.003 95 / 0.6)",
					letterSpacing: "0.12em",
				}}
			>
				⎯ bannaa.co
			</div>

			{variant === "vertical" && (
				<div
					style={{
						position: "absolute",
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)",
						width: 36,
						height: 36,
						borderRadius: "50%",
						background: "oklch(0.95 0.003 95 / 0.15)",
						backdropFilter: "blur(6px)",
						border: "1px solid oklch(0.95 0.003 95 / 0.3)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "white",
					}}
				>
					<Icons.Play size={14} />
				</div>
			)}
		</div>
	);
};

type SelectOption = { value: string; label: string };

export const Select = ({
	value,
	onChange,
	options,
	label,
	compact,
}: {
	value: string;
	onChange: (v: string) => void;
	options: SelectOption[];
	label?: string;
	compact?: boolean;
}) => (
	<div className={`sel${compact ? " sel-compact" : ""}`}>
		{label && <span className="sel-label">{label}</span>}
		<select value={value} onChange={(e) => onChange(e.target.value)}>
			{options.map((o) => (
				<option key={o.value} value={o.value}>
					{o.label}
				</option>
			))}
		</select>
		<Icons.ChevronDown size={10} />
	</div>
);

type FilterOption = { value: string; label: string; count?: number };

export const FilterSeg = ({
	value,
	onChange,
	options,
}: {
	value: string;
	onChange: (v: string) => void;
	options: FilterOption[];
}) => (
	<div className="filter-seg">
		{options.map((o) => (
			<button
				key={o.value}
				type="button"
				className={value === o.value ? "active" : ""}
				onClick={() => onChange(o.value)}
			>
				{o.label}
				{o.count != null && <span className="count">{o.count}</span>}
			</button>
		))}
	</div>
);
