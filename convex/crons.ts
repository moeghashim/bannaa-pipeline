import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
	"x bookmarks sync",
	{ minutes: 15 },
	internal.x.sync.syncAll,
);

export default crons;
