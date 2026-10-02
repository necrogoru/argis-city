//! Prints one snapshot of this machine as pretty JSON:
//! `cargo run --example dump_snapshot`

use argis_lib::build_registry;
use argis_lib::system::HomePaths;
use std::time::Instant;

fn main() -> anyhow::Result<()> {
    let registry = build_registry(&HomePaths::detect()?);
    let started = Instant::now();
    let snapshot = registry.collect();
    let cold = started.elapsed();
    let started = Instant::now();
    let _ = registry.collect();
    let warm = started.elapsed();
    println!("{}", serde_json::to_string_pretty(&snapshot)?);
    eprintln!("collect: cold {cold:?}, warm {warm:?}");
    Ok(())
}
