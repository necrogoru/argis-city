//! OS-facing abstractions (processes, time, tool data dirs), injectable for tests.

pub mod clock;
pub mod paths;
pub mod process;
mod sysinfo_source;

pub use clock::{Clock, SystemClock};
pub use paths::HomePaths;
pub use process::{ProcessInfo, ProcessSource};
pub use sysinfo_source::SysinfoProcessSource;
