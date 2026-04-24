"use client";

export const BaseOverlayToggle = ({
	value,
	onChange,
}: {
	value: "overlay" | "base";
	onChange: (v: "overlay" | "base") => void;
}) => (
	<div
		role="group"
		aria-label="Toggle base or overlay image"
		className="filter-seg"
		style={{ alignSelf: "center", fontSize: 10 }}
	>
		<button type="button" className={value === "base" ? "active" : ""} onClick={() => onChange("base")}>
			base
		</button>
		<button type="button" className={value === "overlay" ? "active" : ""} onClick={() => onChange("overlay")}>
			overlay
		</button>
	</div>
);
