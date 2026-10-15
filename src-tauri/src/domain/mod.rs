//! Pure wire types shared with the UI (`src/domain/types.ts`).
//! Everything here serializes with camelCase keys and `null` for `None`.

mod progress;
mod project;
mod provider;
mod session;
mod snapshot;
mod status;
mod task;
mod terminal;
mod tokens;

pub use progress::{PlanCounts, Progress, ProgressSource};
pub use project::Project;
pub use provider::ProviderId;
pub use session::{AgentSession, SubAgent};
pub use snapshot::{ProviderSummary, Snapshot};
pub use status::AgentStatus;
pub use task::{Task, TaskAgentResume, TaskStatus};
pub use terminal::{
    TerminalAgent, TerminalAttachment, TerminalEvent, TerminalInventoryEntry, TerminalInventoryState,
    TerminalSessionInfo, TerminalSessionKey, TerminalSize, TerminalTab,
};
pub use tokens::TokenUsage;
