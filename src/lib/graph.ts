import type { Course } from "./curriculum.ts";
import type { Snapshot } from "./java-trace.ts";

const quote = (value: string) => JSON.stringify(value);

export function courseGraph(
	courses: Course[],
	selected: number | null,
	highlighted: number[],
	vertical: boolean,
) {
	const current = new Set(highlighted);
	const rows = courses.map((course) => {
		const active = current.has(course.id) || selected === course.id;
		const words = course.name.match(/.{1,22}(?:\s|$)|\S+?(?=\s|$)/g) ?? [
			course.name,
		];
		const label = [String(course.id), ...words.map((word) => word.trim())].join(
			"\n",
		);
		return `c${course.id} [id="course-${course.id}", label=${quote(label)}, fillcolor="${active ? "#e5f2ff" : "#ffffff"}", color="${active ? "#2365b8" : "#b5cbe4"}", penwidth=${active ? 2 : 1.2}];`;
	});
	const edges = courses.flatMap((course) =>
		course.prerequisites.map((id) => {
			const active =
				course.id === selected || id === selected || current.has(course.id);
			return `c${id} -> c${course.id} [color="${active ? "#2365b8" : "#7897b9"}", penwidth=${active ? 2 : 1.25}];`;
		}),
	);
	return `digraph {
		graph [rankdir=${vertical ? "TB" : "LR"}, bgcolor="transparent", nodesep=0.27, ranksep=0.52, pad=0.22];
		node [shape=box, style="rounded,filled", fontname="Arial", fontsize=12, fontcolor="#183c63", margin="0.19,0.11"];
		edge [arrowsize=0.7];
		${rows.join("\n")}
		${edges.join("\n")}
	}`;
}

export function structureGraph(
	snapshot: Snapshot,
	selected: number | null,
	vertical: boolean,
) {
	const nodes = snapshot.nodes.map(
		({ id, label }) =>
			`c${id} [id="course-${id}", label=${quote(label)}, fillcolor="${selected === id ? "#dceeff" : "#ffffff"}"];`,
	);
	const edges = snapshot.edges.map(([from, to]) => `c${from} -> c${to};`);
	return `digraph {
		graph [rankdir=${vertical ? "TB" : "LR"}, bgcolor="transparent", nodesep=0.32, ranksep=0.6, pad=0.24];
		node [shape=box, style="rounded,filled", fontname="Arial", fontsize=13, color="#8aabd0", fontcolor="#183c63", margin="0.19,0.11"];
		edge [color="#7897b9", arrowsize=0.7];
		${nodes.join("\n")}
		${edges.join("\n")}
	}`;
}
