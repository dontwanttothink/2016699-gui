import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { Plugin } from "vite";

export type LicenseComponent = {
	ecosystem: "npm" | "cargo";
	name: string;
	version: string;
	license: string;
	url: string | null;
	texts: number[];
};

/** Los textos van aparte para no repetir los que comparten varios paquetes. */
export type LicenseData = {
	texts: string[];
	components: LicenseComponent[];
};

type PackageJson = {
	name: string;
	version: string;
	license?: string | { type?: string };
	licenses?: { type?: string }[];
	repository?: string | { url?: string };
	homepage?: string;
	dependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
};

type CargoPackage = {
	id: string;
	name: string;
	version: string;
	license: string | null;
	license_file: string | null;
	repository: string | null;
	manifest_path: string;
};

type CargoMetadata = {
	packages: CargoPackage[];
	resolve: {
		root: string | null;
		nodes: {
			id: string;
			deps: { pkg: string; dep_kinds: { kind: string | null }[] }[];
		}[];
	};
};

const LICENSE_FILE = /^(licen[sc]e|copying|unlicen[sc]e|notice)/i;
const UNSPECIFIED = "Sin especificar";

/**
 * Paquetes en `devDependencies` que Vite incluye en la aplicación final,
 * porque su código de ejecución termina empaquetado.
 */
const BUNDLED_DEV_DEPENDENCIES = ["svelte", "@sveltejs/kit"];

class TextTable {
	readonly texts: string[] = [];
	private readonly indexes = new Map<string, number>();

	add(text: string): number {
		const known = this.indexes.get(text);
		if (known !== undefined) return known;
		this.texts.push(text);
		this.indexes.set(text, this.texts.length - 1);
		return this.texts.length - 1;
	}
}

function readLicenseTexts(
	dir: string,
	extraFile: string | null,
	table: TextTable,
): number[] {
	const names = readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isFile() && LICENSE_FILE.test(entry.name))
		.map((entry) => entry.name);
	if (extraFile !== null && !names.includes(extraFile)) names.push(extraFile);

	const indexes = names.flatMap((name) => {
		const path = join(dir, name);
		return existsSync(path)
			? [table.add(readFileSync(path, "utf8").trim())]
			: [];
	});
	return [...new Set(indexes)];
}

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** Resuelve un paquete como lo haría Node, desde `from` hacia arriba. */
function findPackage(name: string, from: string): string | null {
	let dir = from;
	while (true) {
		if (basename(dir) !== "node_modules") {
			const candidate = join(dir, "node_modules", name);
			if (existsSync(join(candidate, "package.json")))
				return realpathSync(candidate);
		}
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

function npmLicense(pkg: PackageJson): string {
	if (typeof pkg.license === "string") return pkg.license;
	const types = [pkg.license, ...(pkg.licenses ?? [])]
		.map((entry) => entry?.type)
		.filter((type): type is string => type !== undefined);
	return types.length > 0 ? types.join(" OR ") : UNSPECIFIED;
}

function npmUrl(pkg: PackageJson): string | null {
	const repository =
		typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
	return (
		repository?.replace(/^git\+/, "").replace(/\.git$/, "") ??
		pkg.homepage ??
		null
	);
}

function collectNpm(root: string, table: TextTable): LicenseComponent[] {
	const rootPackage = readJson<PackageJson>(join(root, "package.json"));
	const pending = [
		...Object.keys(rootPackage.dependencies ?? {}),
		...BUNDLED_DEV_DEPENDENCIES,
	].map((name) => ({ name, from: root }));

	const visited = new Set<string>();
	const components: LicenseComponent[] = [];
	for (let next = pending.pop(); next; next = pending.pop()) {
		const dir = findPackage(next.name, next.from);
		if (dir === null || visited.has(dir)) continue;
		visited.add(dir);

		const pkg = readJson<PackageJson>(join(dir, "package.json"));
		components.push({
			ecosystem: "npm",
			name: pkg.name,
			version: pkg.version,
			license: npmLicense(pkg),
			url: npmUrl(pkg),
			texts: readLicenseTexts(dir, null, table),
		});
		for (const name of Object.keys({
			...pkg.dependencies,
			...pkg.optionalDependencies,
		}))
			pending.push({ name, from: dir });
	}
	return components;
}

function targetTriple(): string {
	const fromTauri = process.env.TAURI_ENV_TARGET_TRIPLE;
	if (fromTauri) return fromTauri;
	const info = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
	const host = /^host: (.+)$/m.exec(info)?.[1];
	if (!host) throw new Error("No se pudo determinar la plataforma de Rust.");
	return host;
}

function collectCargo(root: string, table: TextTable): LicenseComponent[] {
	const metadata = JSON.parse(
		execFileSync(
			"cargo",
			[
				"metadata",
				"--format-version",
				"1",
				"--manifest-path",
				join(root, "src-tauri", "Cargo.toml"),
				"--filter-platform",
				targetTriple(),
			],
			{
				encoding: "utf8",
				maxBuffer: 512 * 1024 * 1024,
				stdio: ["ignore", "pipe", "inherit"],
			},
		),
	) as CargoMetadata;

	const nodes = new Map(metadata.resolve.nodes.map((node) => [node.id, node]));
	const packages = new Map(metadata.packages.map((pkg) => [pkg.id, pkg]));

	// Solo dependencias normales: las de compilación y de pruebas no se distribuyen.
	const reachable = new Set<string>();
	const pending = metadata.resolve.root ? [metadata.resolve.root] : [];
	for (let id = pending.pop(); id; id = pending.pop()) {
		if (reachable.has(id)) continue;
		reachable.add(id);
		for (const dep of nodes.get(id)?.deps ?? []) {
			if (dep.dep_kinds.some((kind) => kind.kind === null))
				pending.push(dep.pkg);
		}
	}
	if (metadata.resolve.root) reachable.delete(metadata.resolve.root);

	return [...reachable].flatMap((id) => {
		const pkg = packages.get(id);
		if (!pkg) return [];
		const dir = dirname(pkg.manifest_path);
		return [
			{
				ecosystem: "cargo" as const,
				name: pkg.name,
				version: pkg.version,
				license: pkg.license ?? UNSPECIFIED,
				url: pkg.repository,
				texts: readLicenseTexts(dir, pkg.license_file, table),
			},
		];
	});
}

function byName(a: LicenseComponent, b: LicenseComponent): number {
	return a.name.localeCompare(b.name) || a.version.localeCompare(b.version);
}

export function collectLicenses(root: string): LicenseData {
	const table = new TextTable();
	const components = [
		...collectNpm(root, table).sort(byName),
		...collectCargo(root, table).sort(byName),
	];
	return { texts: table.texts, components };
}

/**
 * Expone `virtual:licenses` con los textos de licencia del software incluido,
 * leídos del repositorio cada vez que se compila o se inicia el servidor.
 */
export function licenses(): Plugin {
	const id = "virtual:licenses";
	const resolvedId = `\0${id}`;
	let root = process.cwd();
	let data: LicenseData | undefined;

	return {
		name: "licenses",
		configResolved(config) {
			root = config.root;
		},
		resolveId(source) {
			return source === id ? resolvedId : null;
		},
		load(loaded) {
			if (loaded !== resolvedId) return null;
			data ??= collectLicenses(root);
			return `export default ${JSON.stringify(data)};`;
		},
	};
}
