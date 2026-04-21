"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export default function SignInPage() {
	const { signIn } = useAuthActions();
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
	const [message, setMessage] = useState<string | null>(null);

	const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!email.trim()) return;
		setStatus("sending");
		setMessage(null);
		try {
			await signIn("magic-link", { email: email.trim().toLowerCase() });
			setStatus("sent");
			setMessage("Check your email for the sign-in link. It expires in 15 minutes.");
		} catch (err) {
			setStatus("error");
			setMessage(err instanceof Error ? err.message : "Something went wrong");
		}
	};

	return (
		<main
			style={{
				minHeight: "100vh",
				display: "grid",
				placeItems: "center",
				background: "var(--bg)",
				padding: 20,
			}}
		>
			<div
				style={{
					width: 360,
					maxWidth: "100%",
					background: "var(--surface)",
					border: "1px solid var(--border)",
					borderRadius: "var(--r-lg)",
					padding: 28,
					boxShadow: "var(--shadow-md)",
				}}
			>
				<div style={{ marginBottom: 22 }}>
					<div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Bannaa Pipeline</div>
					<div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
						operator sign in
					</div>
				</div>

				<form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
					<label className="col" style={{ gap: 6 }}>
						<span
							className="mono"
							style={{
								fontSize: 10,
								color: "var(--muted)",
								textTransform: "uppercase",
								letterSpacing: "0.08em",
							}}
						>
							email
						</span>
						<input
							className="input"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@bannaa.co"
							disabled={status === "sending" || status === "sent"}
						/>
					</label>
					<button
						type="submit"
						className="btn primary"
						disabled={status === "sending" || status === "sent" || !email.trim()}
						style={{ justifyContent: "center", height: 34 }}
					>
						{status === "sending" ? "Sending…" : status === "sent" ? "Sent" : "Send magic link"}
					</button>
				</form>

				{message && (
					<div
						style={{
							marginTop: 14,
							padding: "10px 12px",
							borderRadius: "var(--r-md)",
							border: "1px solid var(--border)",
							background: status === "error" ? "var(--st-rejected-bg)" : "var(--st-approved-bg)",
							color: status === "error" ? "var(--st-rejected-fg)" : "var(--st-approved-fg)",
							fontSize: 12,
							lineHeight: 1.45,
						}}
					>
						{message}
					</div>
				)}
			</div>
		</main>
	);
}
