export function timeAgo(iso: string): string {
	const d = new Date(iso);
	const diff = (Date.now() - d.getTime()) / 1000;
	if (diff < 60) return `${Math.floor(diff)}s`;
	if (diff < 3600) return `${Math.floor(diff / 60)}m`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
	return `${Math.floor(diff / 86400)}d`;
}

export function fmtDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDateTime(iso: string): string {
	const d = new Date(iso);
	return (
		d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
		" · " +
		d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false })
	);
}
