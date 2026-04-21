import { Email } from "@convex-dev/auth/providers/Email";
import { convexAuth } from "@convex-dev/auth/server";
import { Resend as ResendSDK } from "resend";

const OPERATOR_EMAILS = new Set(
	(process.env.OPERATOR_EMAILS ?? "moe@bannaa.co")
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean),
);

function magicLinkHtml(url: string): string {
	return `
<!doctype html>
<html>
	<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1b1b1f; padding: 24px;">
		<p>Sign in to <strong>bannaa-pipeline</strong>.</p>
		<p><a href="${url}" style="display: inline-block; padding: 10px 16px; background: #000; color: #fff; border-radius: 6px; text-decoration: none;">Open dashboard</a></p>
		<p style="font-size: 12px; color: #6b6b73;">This link expires in 15 minutes. If you did not request it, ignore this email.</p>
	</body>
</html>`;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
	providers: [
		Email({
			id: "magic-link",
			maxAge: 60 * 15,
			authorize: undefined,
			async sendVerificationRequest({ identifier: email, url }) {
				const normalized = email.trim().toLowerCase();
				if (!OPERATOR_EMAILS.has(normalized)) {
					throw new Error("Not authorized");
				}

				const apiKey = process.env.RESEND_API_KEY;
				if (!apiKey) {
					throw new Error("RESEND_API_KEY is not configured");
				}
				const from = process.env.AUTH_EMAIL_FROM ?? "bannaa-pipeline <noreply@bannaa.co>";

				const resend = new ResendSDK(apiKey);
				const result = await resend.emails.send({
					from,
					to: normalized,
					subject: "Sign in to bannaa-pipeline",
					html: magicLinkHtml(url),
					text: `Sign in to bannaa-pipeline: ${url}`,
				});
				if (result.error) {
					throw new Error(`Resend failed: ${result.error.message}`);
				}
			},
		}),
	],
	callbacks: {
		async createOrUpdateUser(ctx, args) {
			const email = args.profile.email?.trim().toLowerCase();
			if (!email || !OPERATOR_EMAILS.has(email)) {
				throw new Error("Not authorized");
			}
			if (args.existingUserId) {
				return args.existingUserId;
			}
			return await ctx.db.insert("users", {
				email,
				name: args.profile.name ?? email.split("@")[0],
			});
		},
	},
});
