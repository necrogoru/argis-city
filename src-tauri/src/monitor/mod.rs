//! Collects all providers into snapshots and keeps the latest one.

mod poller;
mod registry;

pub use poller::Poller;
pub use registry::ProviderRegistry;

use crate::domain::Snapshot;
use parking_lot::{Mutex, RwLock};

/// Thread-safe holder of the registry and its latest snapshot.
pub struct Monitor {
    registry: ProviderRegistry,
    latest: RwLock<Option<Snapshot>>,
    collecting: Mutex<()>,
}

impl Monitor {
    pub fn new(registry: ProviderRegistry) -> Self {
        Self { registry, latest: RwLock::new(None), collecting: Mutex::new(()) }
    }

    /// Collects now and caches the result. Concurrent callers are serialized
    /// so the poller and a manual refresh never duplicate work.
    pub fn refresh(&self) -> Snapshot {
        let _guard = self.collecting.lock();
        let snapshot = self.registry.collect();
        *self.latest.write() = Some(snapshot.clone());
        snapshot
    }

    /// The cached snapshot, collecting one first if none exists yet.
    pub fn latest(&self) -> Snapshot {
        if let Some(snapshot) = self.latest.read().clone() {
            return snapshot;
        }
        self.refresh()
    }
}
