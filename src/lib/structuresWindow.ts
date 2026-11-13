import { invoke } from "@tauri-apps/api/core";
import type { Snapshot } from "#lib/verbose.ts";

/**
 * Cada ventana es un contexto de JavaScript distinto, pero comparten el
 * localStorage del mismo origen, y el evento `storage` avisa a la otra
 * ventana cuando cambia.
 */
const STORAGE_KEY = "plan-snapshots";

export async function openStructuresWindow(snapshots: Snapshot[]) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
	await invoke("open_structures_window");
}

export function readSnapshots(): Snapshot[] {
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === null ? [] : JSON.parse(stored);
}

export function onSnapshotsChange(callback: () => void): () => void {
	const listener = (event: StorageEvent) => {
		if (event.key === STORAGE_KEY) callback();
	};
	window.addEventListener("storage", listener);
	return () => window.removeEventListener("storage", listener);
}
