import type { CourseDraft } from "#lib/courseDraft.ts";

export type Algorithm = "list" | "heap";

export const editor = $state({
	courses: [] as CourseDraft[],
	maxCredits: "20",
	algorithm: "list" as Algorithm,
});
