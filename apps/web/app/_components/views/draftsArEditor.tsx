"use client";

import { useRef } from "react";
import { useMountEffect } from "../../../lib/use-mount-effect";
import { Icons } from "../icons";

export const ArEditor = ({
	value,
	onChange,
	onCancel,
	onSave,
	error,
	saving,
	dir = "rtl",
	lang = "ar",
}: {
	value: string;
	onChange: (v: string) => void;
	onCancel: () => void;
	onSave: () => void;
	error: string | null;
	saving: boolean;
	dir?: "ltr" | "rtl";
	lang?: string;
}) => {
	const ref = useRef<HTMLTextAreaElement>(null);
	useMountEffect(() => {
		ref.current?.focus();
	});
	return (
		<div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
			<textarea
				ref={ref}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				dir={dir}
				lang={lang}
				rows={4}
				style={{
					width: "100%",
					padding: "8px 10px",
					fontSize: 14,
					fontFamily: "inherit",
					lineHeight: 1.55,
					border: "1px solid var(--accent)",
					borderRadius: "var(--r-sm)",
					background: "var(--surface)",
					color: "var(--ink)",
					resize: "vertical",
				}}
			/>
			<div className="row gap-2" style={{ justifyContent: "space-between" }}>
				<div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
					{value.length} chars
					{error && (
						<>
							{" · "}
							<span style={{ color: "var(--st-rejected-fg)" }}>{error}</span>
						</>
					)}
				</div>
				<div className="row gap-2">
					<button type="button" className="btn ghost xs" onClick={onCancel} disabled={saving}>
						cancel
					</button>
					<button type="button" className="btn accent xs" onClick={onSave} disabled={saving}>
						{saving ? (
							<>
								<Icons.Clock size={11} /> saving…
							</>
						) : (
							<>
								<Icons.Check size={11} sw={2} /> save
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
};
