"use client";

import type { Doc } from "@convex/_generated/dataModel";
import { useState } from "react";
import { Icons } from "../icons";
import { parseDesignMd } from "./designMd";

type Brand = Doc<"brands">;
type Design = Brand["design"];

type DesignMdImportProps = {
	brand: Brand;
	onApply: (patch: { name?: string; design: Design }) => void;
};

async function readDesignFile(file: File): Promise<string> {
	return await file.text();
}

export const DesignMdImport = ({ brand, onApply }: DesignMdImportProps) => {
	const [source, setSource] = useState(brand.design.designMd ?? "");
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");

	const apply = () => {
		setError("");
		try {
			const result = parseDesignMd(source, brand.design);
			onApply({
				...(result.name ? { name: result.name } : {}),
				design: result.design,
			});
			setStatus(`Imported ${result.summary.join(", ")}`);
		} catch (err) {
			setStatus("");
			setError(err instanceof Error ? err.message : "Could not import DESIGN.md");
		}
	};

	return (
		<div className="settings-group">
			<h3>DESIGN.md</h3>
			<p className="sub">Import a Stitch design system into the active brand.</p>
			<div className="setting-row">
				<div>
					<div className="lbl">Source</div>
					<div className="hlp">YAML front matter and Markdown sections are supported.</div>
				</div>
				<div className="col gap-2">
					<input
						className="input"
						type="file"
						accept=".md,.markdown,text/markdown,text/plain"
						onChange={(event) => {
							const file = event.currentTarget.files?.[0];
							if (!file) return;
							void readDesignFile(file).then(setSource, () => setError("Could not read selected file"));
						}}
					/>
					<textarea
						className="input"
						value={source}
						rows={10}
						style={{ height: "auto", minHeight: 220, paddingTop: 8, fontFamily: "var(--font-mono)" }}
						placeholder="Paste DESIGN.md"
						onChange={(event) => setSource(event.currentTarget.value)}
					/>
					<div className="row gap-2" style={{ justifyContent: "space-between", alignItems: "center" }}>
						<span
							className="mono"
							style={{ color: error ? "var(--st-rejected-fg)" : "var(--muted)", fontSize: 11 }}
						>
							{error || status || `${source.trim().length} chars`}
						</span>
						<button type="button" className="btn accent" onClick={apply} disabled={!source.trim()}>
							<Icons.Check size={12} /> Import
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
