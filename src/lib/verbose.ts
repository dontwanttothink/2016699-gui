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

export type Structures = {
	[K in Snapshot["kind"]]?: Extract<Snapshot, { kind: K }>;
};

/**
 * Descarta los snapshots que no cambian su estructura respecto al anterior del
 * mismo tipo. Solo se comparan contra el mismo tipo porque el heap y el AVL se
 * intercalan, y una estructura que vuelve a un estado anterior sí es un paso.
 */
export function withoutRepeats(snapshots: Snapshot[]): Snapshot[] {
	const latest = new Map<Snapshot["kind"], string>();
	return snapshots.filter((snapshot) => {
		const serialized = JSON.stringify(snapshot);
		if (latest.get(snapshot.kind) === serialized) return false;
		latest.set(snapshot.kind, serialized);
		return true;
	});
}

/** El estado más reciente de cada estructura hasta el paso dado, inclusive. */
export function structuresAt(snapshots: Snapshot[], step: number): Structures {
	const structures: Structures = {};
	for (const snapshot of snapshots.slice(0, step + 1)) {
		Object.assign(structures, { [snapshot.kind]: snapshot });
	}
	return structures;
}

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
