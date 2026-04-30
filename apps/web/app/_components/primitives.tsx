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

export const InlineErrorAlert = ({
	message,
	onDismiss,
	style,
}: {
	message: string;
	onDismiss: () => void;
	style?: CSSProperties;
}) => (
	<div
		role="alert"
		style={{
			padding: "8px 10px",
			fontSize: 12,
			lineHeight: 1.4,
			color: "var(--st-rejected-fg)",
			background: "var(--st-rejected-bg)",
			border: "1px solid var(--st-rejected-fg)",
			borderRadius: "var(--r-sm)",
			display: "flex",
			justifyContent: "space-between",
			alignItems: "flex-start",
			gap: 10,
			...style,
		}}
	>
		<span>{message}</span>
		<button
			type="button"
			aria-label="Dismiss"
			onClick={(e) => {
				e.stopPropagation();
				onDismiss();
			}}
			style={{
				background: "transparent",
				border: "none",
				padding: 0,
				cursor: "pointer",
				color: "inherit",
				display: "inline-flex",
			}}
		>
			<Icons.X size={12} />
		</button>
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
