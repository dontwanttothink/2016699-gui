export type PrerequisiteRow = { uid: string; value: string };

export type CourseDraft = {
	uid: string;
	id: string;
	name: string;
	prerequisites: PrerequisiteRow[];
};

export function createPrerequisiteRow(): PrerequisiteRow {
	return { uid: crypto.randomUUID(), value: "" };
}

export function createCourseDraft(): CourseDraft {
	return { uid: crypto.randomUUID(), id: "", name: "", prerequisites: [] };
}

export function parseId(text: string): number | null {
	const trimmed = text.trim();
	return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}
