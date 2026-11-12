import type { Curriculum } from "./curriculum.ts";
import { calculatePlan } from "./planner.ts";

self.addEventListener("message", ({ data }: MessageEvent<Curriculum>) => {
	try {
		self.postMessage({ result: calculatePlan(data.courses, data.limits) });
	} catch (error) {
		self.postMessage({
			error: error instanceof Error ? error.message : String(error),
		});
	}
});
