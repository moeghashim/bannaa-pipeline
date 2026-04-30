import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
	"x bookmarks sync",
	{ minutes: 15 },
	internal.x.sync.syncAll,
);

crons.interval(
	"post metrics poll",
	{ hours: 6 },
	internal.metrics.poll.pollAll,
);

crons.interval(
	"postiz integration metrics poll",
	{ hours: 6 },
	internal.metrics.postizPoll.pollAll,
);

export default crons;
