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

    tauri_build::build()
}
