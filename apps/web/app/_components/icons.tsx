import type { CSSProperties, ReactNode } from "react";

type IconProps = {
	d?: string;
	size?: number;
	fill?: string;
	stroke?: string;
	sw?: number;
	children?: ReactNode;
	style?: CSSProperties;
};

const Icon = ({ d, size = 16, fill, stroke = "currentColor", sw = 1.4, children, style }: IconProps) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 22 22"
		fill={fill || "none"}
		stroke={stroke}
		strokeWidth={sw}
		strokeLinecap="round"
		strokeLinejoin="round"
		style={{ flexShrink: 0, ...style }}
		aria-hidden
		role="presentation"
	>
		<title>icon</title>
		{d ? <path d={d} /> : children}
	</svg>
);

type P = Omit<IconProps, "d" | "children">;

export const Icons = {
	Inbox: (p: P) => (
		<Icon {...p}>
			<path d="M3 12l2.5-6A2 2 0 0 1 7.4 5h7.2a2 2 0 0 1 1.9 1L19 12" />
			<path d="M3 12v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
			<path d="M3 12h4l1.5 2h5L15 12h4" />
		</Icon>
	),
	Beaker: (p: P) => (
		<Icon {...p}>
			<path d="M9 3h4" />
			<path d="M10 3v5L5 17a2 2 0 0 0 1.8 3h8.4A2 2 0 0 0 17 17l-5-9V3" />
			<path d="M7.5 13h7" />
		</Icon>
	),
	Edit: (p: P) => (
		<Icon {...p}>
			<path d="M4 18h4l9-9-4-4-9 9v4z" />
			<path d="M13 6l3 3" />
		</Icon>
	),
	Film: (p: P) => (
		<Icon {...p}>
			<rect x="3" y="4" width="16" height="14" rx="1.5" />
			<path d="M7 4v14M15 4v14M3 9h4M3 13h4M15 9h4M15 13h4" />
		</Icon>
	),
	Mail: (p: P) => (
		<Icon {...p}>
			<rect x="3" y="5" width="16" height="13" rx="1.5" />
			<path d="M3 7l8 5 8-5" />
		</Icon>
	),
	Globe: (p: P) => (
		<Icon {...p}>
			<circle cx="11" cy="11" r="8" />
			<path d="M3 11h16M11 3a12 12 0 0 1 0 16M11 3a12 12 0 0 0 0 16" />
		</Icon>
	),
	Gear: (p: P) => (
		<Icon {...p}>
			<circle cx="11" cy="11" r="2.6" />
			<path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.5 4.5l1.4 1.4M16.1 16.1l1.4 1.4M4.5 17.5l1.4-1.4M16.1 5.9l1.4-1.4" />
		</Icon>
	),
	Search: (p: P) => (
		<Icon {...p}>
			<circle cx="9.5" cy="9.5" r="5.5" />
			<path d="M14 14l5 5" />
		</Icon>
	),
	Check: (p: P) => (
		<Icon {...p}>
			<path d="M4 11l4 4 10-10" />
		</Icon>
	),
	X: (p: P) => (
		<Icon {...p}>
			<path d="M5 5l12 12M17 5L5 17" />
		</Icon>
	),
	Chevron: (p: P) => (
		<Icon {...p}>
			<path d="M8 5l6 6-6 6" />
		</Icon>
	),
	ChevronDown: (p: P) => (
		<Icon {...p}>
			<path d="M5 8l6 6 6-6" />
		</Icon>
	),
	Play: (p: P) => (
		<Icon {...p} fill="currentColor">
			<path d="M7 5l10 6-10 6z" />
		</Icon>
	),
	Clock: (p: P) => (
		<Icon {...p}>
			<circle cx="11" cy="11" r="8" />
			<path d="M11 6v5l3 2" />
		</Icon>
	),
	GitPR: (p: P) => (
		<Icon {...p}>
			<circle cx="6" cy="5" r="2" />
			<circle cx="6" cy="17" r="2" />
			<circle cx="16" cy="17" r="2" />
			<path d="M6 7v8M16 6v9M13 4h2a1 1 0 0 1 1 1v2" />
			<path d="M14 3l2 1-2 1" />
		</Icon>
	),
	Plus: (p: P) => (
		<Icon {...p}>
			<path d="M11 4v14M4 11h14" />
		</Icon>
	),
	Arrow: (p: P) => (
		<Icon {...p}>
			<path d="M4 11h14M13 6l5 5-5 5" />
		</Icon>
	),
	Circle: (p: P) => (
		<Icon {...p}>
			<circle cx="11" cy="11" r="7" />
		</Icon>
	),
	CircleDot: (p: P) => (
		<Icon {...p}>
			<circle cx="11" cy="11" r="7" />
			<circle cx="11" cy="11" r="2" fill="currentColor" stroke="none" />
		</Icon>
	),
	Sparkle: (p: P) => (
		<Icon {...p}>
			<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z" />
		</Icon>
	),
	Language: (p: P) => (
		<Icon {...p}>
			<path d="M3 6h9M7 6v9M4 15l3-9 3 9M5 12h4" />
			<path d="M14 10h5M16.5 10v2M14 18s1.5-3 2.5-3 2.5 3 2.5 3" />
		</Icon>
	),
	Keyboard: (p: P) => (
		<Icon {...p}>
			<rect x="2" y="6" width="18" height="11" rx="1.5" />
			<path d="M5.5 10h.01M8 10h.01M10.5 10h.01M13 10h.01M15.5 10h.01M5.5 13h.01M15.5 13h.01M7.5 13h6" />
		</Icon>
	),
	Menu: (p: P) => (
		<Icon {...p}>
			<path d="M3 6h16M3 11h16M3 16h10" />
		</Icon>
	),
};
