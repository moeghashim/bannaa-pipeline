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
