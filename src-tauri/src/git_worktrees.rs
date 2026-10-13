use crate::task_store::TaskStore;
use anyhow::{anyhow, bail, Context};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const MAX_TITLE_SLUG_LENGTH: usize = 48;
const WORKTREE_ROOT: &str = ".argis/worktrees";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskGitStatus {
    pub is_git_repository: bool,
    pub can_create_branch: bool,
    pub branch_exists: bool,
    pub branch_name: String,
    pub worktree_path: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TaskWorktree {
    pub branch_name: String,
    pub worktree_path: String,
}

pub fn task_branch_name(task_id: i64, title: &str) -> String {
    format!("argis/{task_id}-{}", title_slug(title))
}

pub fn inspect_task_git(store: &TaskStore, task_id: i64) -> anyhow::Result<TaskGitStatus> {
    let task = store.get_task(task_id)?;
    let project = store.get_project(task.project_id)?;
    let project_path =
        fs::canonicalize(&project.path).with_context(|| format!("resolving project {}", project.path))?;
    if !project_path.is_dir() {
        bail!("project path is not a directory: {}", project_path.display());
    }

    let branch_name = task.branch_name.clone().unwrap_or_else(|| task_branch_name(task.id, &task.title));
    let worktree_path = task
        .worktree_path
        .clone()
        .map(PathBuf::from)
        .unwrap_or_else(|| task_worktree_path(&project_path, task.id, &task.title));
    let worktree_path = worktree_path.to_string_lossy().into_owned();
    let Some(_repository_root) = git_root(&project_path)? else {
        return Ok(TaskGitStatus {
            is_git_repository: false,
            can_create_branch: false,
            branch_exists: false,
            branch_name,
            worktree_path,
            reason: Some("Project is not a Git working tree".to_owned()),
        });
    };

    let branch_exists = branch_exists(&project_path, &branch_name)?;
    let task_already_linked = task.branch_name.is_some() || task.worktree_path.is_some();
    let target_exists = Path::new(&worktree_path).exists();
    let reason = if task_already_linked {
        Some("Task already has a branch or worktree".to_owned())
    } else if branch_exists {
        Some(format!("Branch already exists: {branch_name}"))
    } else if target_exists {
        Some(format!("Worktree path already exists: {worktree_path}"))
    } else {
        None
    };

    Ok(TaskGitStatus {
        is_git_repository: true,
        can_create_branch: reason.is_none(),
        branch_exists,
        branch_name,
        worktree_path,
        reason,
    })
}

pub fn create_task_worktree(store: &TaskStore, task_id: i64) -> anyhow::Result<TaskWorktree> {
    let status = inspect_task_git(store, task_id)?;
    if !status.can_create_branch {
        bail!("{}", status.reason.unwrap_or_else(|| "Git worktree is unavailable".to_owned()));
    }

    let task = store.get_task(task_id)?;
    let project = store.get_project(task.project_id)?;
    let project_path = fs::canonicalize(&project.path)?;
    let repository_root = git_root(&project_path)?.ok_or_else(|| anyhow!("project is not a Git working tree"))?;
    let target = PathBuf::from(&status.worktree_path);
    let target_parent = target.parent().ok_or_else(|| anyhow!("worktree path has no parent"))?;

    ensure_local_exclude(&project_path, &repository_root)?;
    fs::create_dir_all(target_parent).with_context(|| format!("creating {}", target_parent.display()))?;
    let canonical_parent = fs::canonicalize(target_parent)?;
    if !canonical_parent.starts_with(&project_path) {
        bail!("worktree parent resolves outside project: {}", canonical_parent.display());
    }
    let target = canonical_parent.join(target.file_name().ok_or_else(|| anyhow!("worktree path has no name"))?);
    let target_string = target.to_str().ok_or_else(|| anyhow!("worktree path is not valid UTF-8"))?;
    let output = run_git(&project_path, &["worktree", "add", "-b", &status.branch_name, target_string])?;
    ensure_success(&output, "creating task worktree")?;

    let canonical_target = fs::canonicalize(&target)?;
    let canonical_path = canonical_target.to_string_lossy().into_owned();
    if let Err(error) = store.set_task_worktree(task_id, &status.branch_name, &canonical_path) {
        bail!(
            "created worktree at {} but could not associate it with task {task_id}: {error}",
            canonical_target.display()
        );
    }

    Ok(TaskWorktree { branch_name: status.branch_name, worktree_path: canonical_path })
}

fn title_slug(title: &str) -> String {
    let mut slug = String::new();
    let mut separator = false;
    for character in title.chars().flat_map(char::to_lowercase) {
        if character.is_ascii_alphanumeric() {
            if separator && !slug.is_empty() {
                slug.push('-');
            }
            separator = false;
            slug.push(character);
        } else {
            separator = true;
        }
    }
    slug.truncate(MAX_TITLE_SLUG_LENGTH);
    let slug = slug.trim_end_matches('-');
    if slug.is_empty() {
        "task".to_owned()
    } else {
        slug.to_owned()
    }
}

fn task_worktree_path(project_path: &Path, task_id: i64, title: &str) -> PathBuf {
    project_path.join(WORKTREE_ROOT).join(format!("{task_id}-{}", title_slug(title)))
}

fn git_root(path: &Path) -> anyhow::Result<Option<PathBuf>> {
    let output = run_git(path, &["rev-parse", "--show-toplevel"])?;
    if !output.status.success() {
        return Ok(None);
    }
    let output_path = String::from_utf8(output.stdout).context("Git returned a non-UTF-8 repository path")?;
    Ok(Some(fs::canonicalize(output_path.trim())?))
}

fn branch_exists(project_path: &Path, branch_name: &str) -> anyhow::Result<bool> {
    let reference = format!("refs/heads/{branch_name}");
    let output = run_git(project_path, &["show-ref", "--verify", "--quiet", &reference])?;
    match output.status.code() {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        _ => bail!("checking branch {branch_name}: {}", stderr(&output)),
    }
}

fn ensure_local_exclude(project_path: &Path, repository_root: &Path) -> anyhow::Result<()> {
    let common_dir_output = run_git(project_path, &["rev-parse", "--git-common-dir"])?;
    ensure_success(&common_dir_output, "resolving Git common directory")?;
    let common_dir =
        String::from_utf8(common_dir_output.stdout).context("Git returned a non-UTF-8 common directory")?;
    let common_dir = PathBuf::from(common_dir.trim());
    let common_dir = if common_dir.is_absolute() { common_dir } else { project_path.join(common_dir) };
    let common_dir = fs::canonicalize(common_dir)?;
    let relative_project = project_path.strip_prefix(repository_root).context("project is outside Git repository")?;
    let project_prefix = relative_project.to_string_lossy().replace('\\', "/");
    let rule = if project_prefix.is_empty() {
        format!("{WORKTREE_ROOT}/")
    } else {
        format!("{project_prefix}/{WORKTREE_ROOT}/")
    };
    let info_dir = common_dir.join("info");
    fs::create_dir_all(&info_dir)?;
    let exclude_path = info_dir.join("exclude");
    let existing = match fs::read_to_string(&exclude_path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == ErrorKind::NotFound => String::new(),
        Err(error) => return Err(error).with_context(|| format!("reading {}", exclude_path.display())),
    };
    if existing.lines().any(|line| line.trim() == rule) {
        return Ok(());
    }

    let mut exclude = OpenOptions::new().create(true).append(true).open(&exclude_path)?;
    if !existing.is_empty() && !existing.ends_with('\n') {
        writeln!(exclude)?;
    }
    writeln!(exclude, "{rule}").with_context(|| format!("updating {}", exclude_path.display()))
}

fn run_git(path: &Path, args: &[&str]) -> anyhow::Result<Output> {
    Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .with_context(|| format!("running git {} in {}", args.join(" "), path.display()))
}

fn ensure_success(output: &Output, context: &str) -> anyhow::Result<()> {
    if output.status.success() {
        Ok(())
    } else {
        bail!("{context}: {}", stderr(output));
    }
}

fn stderr(output: &Output) -> String {
    String::from_utf8_lossy(&output.stderr).trim().to_owned()
}
