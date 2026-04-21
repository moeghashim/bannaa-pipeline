function toDate(value: string | number): Date {
	return typeof value === "number" ? new Date(value) : new Date(value);
}

export function timeAgo(value: string | number): string {
	const d = toDate(value);
	const diff = (Date.now() - d.getTime()) / 1000;
	if (diff < 60) return `${Math.floor(diff)}s`;
	if (diff < 3600) return `${Math.floor(diff / 60)}m`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
	return `${Math.floor(diff / 86400)}d`;
}

export function fmtDate(value: string | number): string {
	return toDate(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDateTime(value: string | number): string {
	const d = toDate(value);
	return (
		d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
		" · " +
		d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false })
	);
}
