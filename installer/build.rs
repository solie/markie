fn main() {
    let manifest_path = std::path::Path::new("app.manifest").canonicalize().unwrap();
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest_path.display());
}
