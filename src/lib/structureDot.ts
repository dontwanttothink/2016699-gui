import type {
	AvlSnapshot,
	AvlTree,
	HeapSnapshot,
	ListSnapshot,
} from "#lib/verbose.ts";

export function listToDot({ edges }: ListSnapshot): string {
	return edges.map(([from, to]) => `${from} -> ${to};`).join("\n");
}

/** El heap llega como arreglo; sus hijos están en 2i+1 y 2i+2. */
export function heapToDot({ ids }: HeapSnapshot): string {
	const nodes = ids.map((id, i) => `h${i} [label="${id}"];`);
	const edges = ids.flatMap((_, i) =>
		[2 * i + 1, 2 * i + 2]
			.filter((child) => child < ids.length)
			.map((child) => `h${i} -> h${child};`),
	);
	return [...nodes, ...edges].join("\n");
}

/**
 * Cuando un nodo solo tiene un hijo, se agrega un hijo invisible en el otro
 * lado para que Graphviz respete si es izquierdo o derecho.
 */
export function avlToDot({ root }: AvlSnapshot): string {
	if (root === null) return "";

	const lines: string[] = [];
	let counter = 0;

	const walk = (tree: AvlTree): string => {
		const name = `n${counter++}`;
		const { courseId, index } = tree.node;
		lines.push(`${name} [label="ID ${courseId}\\nposición ${index}"];`);

		if (tree.left || tree.right) {
			for (const child of [tree.left, tree.right]) {
				if (child) {
					lines.push(`${name} -> ${walk(child)};`);
				} else {
					const ghost = `g${counter++}`;
					lines.push(
						`${ghost} [style=invis, label="", width=0];`,
						`${name} -> ${ghost} [style=invis];`,
					);
				}
			}
		}
		return name;
	};

	walk(root);
	return lines.join("\n");
}
