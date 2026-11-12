import type { Course } from "./curriculum.ts";

export type Structure = "Lista" | "Heap" | "AVL";
export type Snapshot = {
	structure: Structure;
	nodes: { id: number; label: string }[];
	edges: [number, number][];
};
export type JavaTrace = { frames: Snapshot[]; semesters: number[][] };

const headings: Record<string, Structure> = {
	"Estado del plan (lista):": "Lista",
	"Estado del Heap:": "Heap",
	"Estado del AVL:": "AVL",
};

export function parseJavaTrace(output: string, courses: Course[]): JavaTrace {
	const lines = output.trimEnd().split(/\r?\n/);
	const schedule = lines.pop()?.trim() ?? "";
	if (!/^\d+(?: \d+)*(?:\|\d+(?: \d+)*)*$/.test(schedule)) {
		throw new Error("Java devolvió un resultado con formato inesperado.");
	}
	const semesters = schedule
		.split("|")
		.map((row) => row.split(" ").map(Number));
	const known = new Map(courses.map((course) => [course.id, course]));
	const done = new Set<number>();
	for (const semester of semesters) {
		const selected = new Set<number>();
		let credits = 0;
		for (const id of semester) {
			const course = known.get(id);
			if (
				!course ||
				done.has(id) ||
				selected.has(id) ||
				!course.prerequisites.every((p) => done.has(p))
			) {
				throw new Error(
					"El resultado Java no coincide con los prerrequisitos del plan.",
				);
			}
			selected.add(id);
			credits += course.credits;
		}
		if (credits > 20)
			throw new Error("El resultado Java supera su cupo de 20 créditos.");
		for (const id of selected) done.add(id);
	}
	if (done.size !== known.size)
		throw new Error("El resultado Java no contiene todas las asignaturas.");

	const frames: Snapshot[] = [];
	for (let index = 0; index < lines.length; index++) {
		const structure = headings[lines[index].trim()];
		if (!structure) continue;
		const line = lines[++index]?.trim() ?? "";
		const tokens = line ? line.split(/\s+/) : [];
		const nodes = new Map<number, string>();
		const ids = tokens.map((token) => {
			const [raw, slot] = token.split(",");
			const id = Number(raw);
			if (!known.has(id))
				throw new Error(
					"La traza Java hace referencia a una asignatura desconocida.",
				);
			nodes.set(id, slot === undefined ? raw : `${raw} · índice ${slot}`);
			return id;
		});
		const edges: [number, number][] = [];
		if (structure === "Heap") {
			for (let child = 1; child < ids.length; child++)
				edges.push([ids[Math.floor((child - 1) / 2)], ids[child]]);
		} else {
			if (ids.length % 2 !== 0)
				throw new Error("Java devolvió una relación incompleta.");
			for (let edge = 0; edge < ids.length; edge += 2)
				edges.push([ids[edge], ids[edge + 1]]);
		}
		frames.push({
			structure,
			nodes: [...nodes].map(([id, label]) => ({ id, label })),
			edges,
		});
	}
	if (!frames.length)
		throw new Error("Java no generó una traza de sus estructuras.");
	return { frames, semesters };
}
