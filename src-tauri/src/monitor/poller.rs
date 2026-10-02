//! Background thread: collect every interval and publish the snapshot.

use super::Monitor;
use crate::domain::Snapshot;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

pub struct Poller {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl Poller {
    /// Starts polling immediately, then every `interval`.
    pub fn spawn<F>(monitor: Arc<Monitor>, interval: Duration, publish: F) -> std::io::Result<Self>
    where
        F: Fn(&Snapshot) + Send + 'static,
    {
        let stop = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&stop);
        let handle = thread::Builder::new().name("argis-poller".into()).spawn(move || {
            while !flag.load(Ordering::Relaxed) {
                publish(&monitor.refresh());
                sleep_unless_stopped(&flag, interval);
            }
        })?;
        Ok(Self { stop, handle: Some(handle) })
    }

    /// Signals the thread and waits for it to finish its current tick.
    pub fn stop(mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

/// Sleeps in short slices so `stop` is honoured promptly.
fn sleep_unless_stopped(flag: &AtomicBool, interval: Duration) {
    let slice = Duration::from_millis(50);
    let mut waited = Duration::ZERO;
    while waited < interval && !flag.load(Ordering::Relaxed) {
        thread::sleep(slice.min(interval - waited));
        waited += slice;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::monitor::ProviderRegistry;
    use crate::system::{Clock, ProcessInfo, ProcessSource};
    use std::sync::mpsc;

    struct Tick;
    impl Clock for Tick {
        fn now_ms(&self) -> i64 {
            7
        }
    }
    struct Empty;
    impl ProcessSource for Empty {
        fn snapshot(&self) -> Vec<ProcessInfo> {
            Vec::new()
        }
    }

    #[test]
    fn publishes_snapshots_until_stopped() {
        let registry = ProviderRegistry::new(Vec::new(), Box::new(Empty), Box::new(Tick));
        let monitor = Arc::new(Monitor::new(registry));
        let (tx, rx) = mpsc::channel();
        let poller = Poller::spawn(Arc::clone(&monitor), Duration::from_millis(10), move |s| {
            let _ = tx.send(s.generated_at);
        })
        .unwrap();
        assert_eq!(rx.recv_timeout(Duration::from_secs(2)).unwrap(), 7);
        assert_eq!(rx.recv_timeout(Duration::from_secs(2)).unwrap(), 7);
        poller.stop();
        assert_eq!(monitor.latest().generated_at, 7);
    }
}
