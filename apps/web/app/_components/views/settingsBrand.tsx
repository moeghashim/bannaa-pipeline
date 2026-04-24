"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { Icons } from "../icons";
import { Chip } from "../primitives";

export const SettingsBrandSection = ({ onOpenBrand }: { onOpenBrand: () => void }) => {
	const brand = useQuery(api.brand.doc.getActive, {});

	return (
		<div className="settings-group">
			<h3>Brand</h3>
			<p className="sub">Tone and visual defaults used by generation.</p>
			<div className="setting-row">
				<div>
					<div className="lbl">Active brand</div>
					<div className="hlp">Edit voice, palette, typography, and version snapshots.</div>
				</div>
				<div className="row gap-2">
					<Chip state="approved" label={brand ? `${brand.name} v${brand.version}` : "not seeded"} />
					<button type="button" className="btn xs" onClick={onOpenBrand}>
						<Icons.Arrow size={11} /> Edit
					</button>
				</div>
			</div>
		</div>
	);
};
