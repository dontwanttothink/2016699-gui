/**
 * Funciones y tipos para lidiar con la serialización de estructuras en las salidas
 * del CLI
 */

export type ListSnapshot = { kind: "list"; edges: [number, number][] };
export type HeapSnapshot = { kind: "heap"; ids: number[] };

export type AvlNode = { courseId: number; index: number };
export type AvlTree = {
	node: AvlNode;
	left: AvlTree | null;
	right: AvlTree | null;
};
export type AvlSnapshot = { kind: "avl"; root: AvlTree | null };

export type Snapshot = ListSnapshot | HeapSnapshot | AvlSnapshot;

export type VerboseOutput = { snapshots: Snapshot[]; semesters: number[][] };

export function parseVerbose(text: string): VerboseOutput {
	const lines = text.split("\n");
	const snapshots: Snapshot[] = [];
	let semesters: number[][] = [];

	for (let i = 0; i < lines.length; i++) {
		switch (lines[i]) {
			case "Estado del plan (lista):":
				snapshots.push(parseList(lines[++i]));
				break;
			case "Estado del Heap:":
				snapshots.push(parseHeap(lines[++i]));
				break;
			case "Estado del AVL:":
				snapshots.push(parseAvl(lines[++i]));
				break;
			case "":
				break;
			default:
				semesters = lines[i]
					.split("|")
					.map((semester) => tokens(semester).map(Number));
		}
	}

	return { snapshots, semesters };
}

function tokens(payload: string): string[] {
	return payload.split(" ").filter((token) => token !== "");
}

function parseList(payload: string): ListSnapshot {
	const ids = tokens(payload).map(Number);
	const edges: [number, number][] = [];
	for (let i = 0; i < ids.length; i += 2) {
		edges.push([ids[i], ids[i + 1]]);
	}
	return { kind: "list", edges };
}

function parseHeap(payload: string): HeapSnapshot {
	return { kind: "heap", ids: tokens(payload).map(Number) };
}

function parseAvl(payload: string): AvlSnapshot {
	const parts = tokens(payload);
	let pos = 0;

	const build = (): AvlTree | null => {
		const part = parts[pos++];
		if (part === "-") return null;
		const [courseId, index] = part.split(",").map(Number);
		return { node: { courseId, index }, left: build(), right: build() };
	};

	return { kind: "avl", root: build() };
}
