use std::path::PathBuf;

fn main() {
    let target = std::env::var("TARGET").expect("TARGET no está definido");
    let suffix = if target.contains("windows") {
        ".exe"
    } else {
        ""
    };
    let binary = PathBuf::from(format!("binaries/graduation-{target}{suffix}"));

    println!("cargo:rerun-if-changed={}", binary.display());
    if !binary.exists() {
        panic!(
            "Falta el binario del planificador: {}\n\
             Copia el ejecutable nativo de graduation (./gradlew :app:nativeCompile en el repositorio 2016699) a esa ruta.",
            binary.display()
        );
    }

    if target.contains("windows") {
        // Las imágenes de GraalVM dependen de vcruntime140.dll, que no está
        // incluido en Windows por defecto. En Windows, tenemos que empaquetar
        // eso :(
        let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
        let source = PathBuf::from(system_root)
            .join("System32")
            .join("vcruntime140.dll");

        std::fs::create_dir_all("redist").expect("No se pudo crear redist/");
        std::fs::copy(&source, "redist/vcruntime140.dll")
            .unwrap_or_else(|e| panic!("No se pudo copiar {} ({e}).", source.display()));
        println!("cargo:rerun-if-changed={}", source.display());
    }

    tauri_build::build()
}
