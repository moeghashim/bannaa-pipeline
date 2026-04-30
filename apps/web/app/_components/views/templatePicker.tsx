"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import type { Channel } from "../types";

export const TemplatePicker = ({
	channel,
	value,
	onChange,
	disabled,
}: {
	channel: Channel;
	value: Id<"postTemplates"> | null;
	onChange: (id: Id<"postTemplates"> | null) => void;
	disabled?: boolean;
}) => {
	const templates = useQuery(api.postTemplates.list.list, { channel });
	if (!templates || templates.length === 0) return null;
	return (
		<select
			className="mono"
			value={value ?? ""}
			disabled={disabled}
			title="Reference post template"
			onChange={(event) => onChange(event.target.value ? (event.target.value as Id<"postTemplates">) : null)}
			style={{
				height: 26,
				maxWidth: 180,
				border: "1px solid var(--border)",
				borderRadius: "var(--r-md)",
				background: "var(--surface-2)",
				color: "var(--ink-2)",
				fontSize: 10.5,
				padding: "0 6px",
			}}
		>
			<option value="">No template</option>
			{templates.map((template) => (
				<option key={template._id} value={template._id}>
					{template.name}
				</option>
			))}
		</select>
	);
};
