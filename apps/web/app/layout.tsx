import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono, Newsreader, Noto_Naskh_Arabic } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const fontSans = Inter_Tight({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-sans-raw",
});

const fontMono = JetBrains_Mono({
	subsets: ["latin"],
	weight: ["400", "500", "600"],
	variable: "--font-mono-raw",
});

const fontSerif = Newsreader({
	subsets: ["latin"],
	weight: ["400", "500", "600"],
	style: ["normal", "italic"],
	variable: "--font-serif-raw",
});

const fontAr = Noto_Naskh_Arabic({
	subsets: ["arabic"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-ar-raw",
});

export const metadata: Metadata = {
	title: "bannaa-pipeline",
	description: "Content pipeline dashboard for bannaa.co.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en" className={`${fontSans.variable} ${fontMono.variable} ${fontSerif.variable} ${fontAr.variable}`}>
			<body>{children}</body>
		</html>
	);
}
