use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: i64,
    pub project_id: i64,
    pub title: String,
    pub description: String,
    pub status: TaskStatus,
    pub branch_name: Option<String>,
    pub worktree_path: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TaskStatus {
    Pending,
    InProgress,
    Stopped,
    Canceled,
    Completed,
}

impl TaskStatus {
    pub(crate) const fn as_db_value(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::InProgress => "inProgress",
            Self::Stopped => "stopped",
            Self::Canceled => "canceled",
            Self::Completed => "completed",
        }
    }

    pub(crate) fn from_db_value(value: &str) -> Option<Self> {
        match value {
            "pending" => Some(Self::Pending),
            "inProgress" => Some(Self::InProgress),
            "stopped" => Some(Self::Stopped),
            "canceled" => Some(Self::Canceled),
            "completed" => Some(Self::Completed),
            _ => None,
        }
    }
}
