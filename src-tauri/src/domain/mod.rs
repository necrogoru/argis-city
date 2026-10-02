//! Pure wire types shared with the UI (`src/domain/types.ts`).
//! Everything here serializes with camelCase keys and `null` for `None`.

mod progress;
mod provider;
mod session;
mod snapshot;
mod status;
mod tokens;

pub use progress::{PlanCounts, Progress, ProgressSource};
pub use provider::ProviderId;
pub use session::{AgentSession, SubAgent};
pub use snapshot::{ProviderSummary, Snapshot};
pub use status::AgentStatus;
pub use tokens::TokenUsage;
