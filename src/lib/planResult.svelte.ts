import type { VerboseOutput } from "#lib/verbose.ts";

let result = $state<VerboseOutput | null>(null);

export function setPlanResult(output: VerboseOutput) {
	result = output;
}

export function getPlanResult(): VerboseOutput | null {
	return result;
}
