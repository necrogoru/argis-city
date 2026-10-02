//! Subagent transcripts: `<projectDir>/<sessionId>/subagents/agent-<id>.jsonl`
//! with a sibling `agent-<id>.meta.json` (`agentType`, `description`).

use super::transcript::TranscriptSummary;
use crate::domain::{AgentStatus, Progress, SubAgent};
use crate::shared::jsonl::FileMeta;
use crate::shared::text::{clip, TITLE_MAX};
use crate::system::clock::system_time_ms;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentMeta {
    agent_type: Option<String>,
    description: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SubagentFile {
    pub id: String,
    pub path: PathBuf,
    pub kind: Option<String>,
    pub description: Option<String>,
}

/// Subagent files of `session_id` modified at/after `since_ms`.
pub fn discover(transcript: &Path, session_id: &str, since_ms: i64) -> Vec<SubagentFile> {
    let Some(project) = transcript.parent() else { return Vec::new() };
    let dir = project.join(session_id).join("subagents");
    let Ok(read) = fs::read_dir(&dir) else { return Vec::new() };
    read.flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_str()?;
            let id = name.strip_prefix("agent-")?.strip_suffix(".jsonl")?.to_owned();
            let modified = entry.metadata().ok()?.modified().ok().map(system_time_ms)?;
            (modified >= since_ms).then_some((id, path))
        })
        .map(|(id, path)| {
            let meta = read_meta(&path.with_file_name(format!("agent-{id}.meta.json")));
            SubagentFile { id, path, kind: meta.agent_type, description: meta.description }
        })
        .collect()
}

fn read_meta(path: &Path) -> AgentMeta {
    fs::read(path).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

/// Maps a folded subagent transcript to the wire type.
pub fn to_subagent(file: &SubagentFile, s: &TranscriptSummary, meta: FileMeta, status: AgentStatus) -> SubAgent {
    let title = file
        .description
        .as_deref()
        .or(s.first_prompt.as_deref())
        .map(|t| clip(t, TITLE_MAX))
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| format!("agent-{}", file.id));
    SubAgent {
        id: file.id.clone(),
        title,
        kind: file.kind.clone(),
        status,
        tokens: s.tokens,
        progress: Progress::resolve(s.plan, status, &s.tokens),
        started_at: s.first_ts.or(meta.created_ms).unwrap_or(meta.modified_ms),
        updated_at: meta.modified_ms,
    }
}
