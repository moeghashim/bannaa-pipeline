import { timeAgo } from "../format";

export type DraftMetric = {
	draftId: string;
	capturedAt: number;
	postAgeHours: number;
	views?: number;
	likes: number;
	comments: number;
	shares: number;
	saves?: number;
};

const compactNumber = (value: number | undefined): string => {
	if (value === undefined) return "n/a";
	return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
};

export const DraftMetricsLine = ({ metric }: { metric: DraftMetric }) => (
	<span title={`captured ${timeAgo(metric.capturedAt)}`}>
		{compactNumber(metric.views)} views · {compactNumber(metric.likes)} likes · {compactNumber(metric.comments)}{" "}
		replies
	</span>
);
