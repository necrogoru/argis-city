use std::time::{SystemTime, UNIX_EPOCH};

/// Source of "now" in Unix epoch milliseconds.
pub trait Clock: Send + Sync {
    fn now_ms(&self) -> i64;
}

pub struct SystemClock;

impl Clock for SystemClock {
    fn now_ms(&self) -> i64 {
        system_time_ms(SystemTime::now())
    }
}

/// Converts a `SystemTime` to epoch milliseconds (0 for pre-epoch times).
pub fn system_time_ms(time: SystemTime) -> i64 {
    time.duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}
