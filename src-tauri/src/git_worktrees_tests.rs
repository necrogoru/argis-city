use crate::git_worktrees::{create_task_worktree, inspect_task_git, task_branch_name};
use crate::task_store::TaskStore;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use tempfile::TempDir;

fn git(repo: &Path, args: &[&str]) -> Output {
    Command::new("git").arg("-C").arg(repo).args(args).output().unwrap()
}

fn init_repository(parent: &TempDir) -> PathBuf {
    let repo = parent.path().join("repo");
    fs::create_dir(&repo).unwrap();
    assert!(git(&repo, &["init", "--quiet"]).status.success());
    assert!(git(&repo, &["config", "user.name", "Argis test"]).status.success());
    assert!(git(&repo, &["config", "user.email", "argis-test@example.invalid"]).status.success());
    fs::write(repo.join("README.md"), "fixture\n").unwrap();
    fs::write(repo.join(".gitignore"), "build/\n").unwrap();
    assert!(git(&repo, &["add", "README.md", ".gitignore"]).status.success());
    assert!(git(&repo, &["commit", "--quiet", "-m", "initial"]).status.success());
    repo
}

fn task_store_for(parent: &TempDir, project_path: &Path, title: &str) -> (TaskStore, i64) {
    let store = TaskStore::open(&parent.path().join("argis.sqlite")).unwrap();
    let project = store.create_project(&project_path.to_string_lossy()).unwrap();
    let task = store.create_task(project.id, title, "description").unwrap();
    (store, task.id)
}

#[test]
fn task_branch_names_use_stable_ids_and_safe_title_slugs() {
    assert_eq!(task_branch_name(27, "Ship cleanup (safe)!"), "argis/27-ship-cleanup-safe");
    assert_eq!(task_branch_name(28, "🎨"), "argis/28-task");
}

#[test]
fn creates_a_task_worktree_and_records_the_local_exclude_rule() {
    let parent = tempfile::tempdir().unwrap();
    let repo = init_repository(&parent);
    let exclude = repo.join(".git/info/exclude");
    fs::write(&exclude, "# keep existing entries\n.DS_Store\n").unwrap();
    let (store, task_id) = task_store_for(&parent, &repo, "Add task board");

    let worktree = create_task_worktree(&store, task_id).unwrap();

    assert_eq!(worktree.branch_name, "argis/1-add-task-board");
    assert_eq!(
        worktree.worktree_path,
        fs::canonicalize(&repo).unwrap().join(".argis/worktrees/1-add-task-board").to_string_lossy()
    );
    assert!(Path::new(&worktree.worktree_path).is_dir());
    let branches = git(&repo, &["branch", "--list", &worktree.branch_name]);
    assert!(branches.status.success());
    assert!(String::from_utf8_lossy(&branches.stdout).contains(&worktree.branch_name));

    let project_id = store.get_task(task_id).unwrap().project_id;
    let second_task = store.create_task(project_id, "Second worktree", "description").unwrap();
    let second_worktree = create_task_worktree(&store, second_task.id).unwrap();
    assert!(Path::new(&second_worktree.worktree_path).is_dir());

    let saved_task = store.list_tasks(None).unwrap().remove(0);
    assert_eq!(saved_task.branch_name.as_deref(), Some(worktree.branch_name.as_str()));
    assert_eq!(saved_task.worktree_path.as_deref(), Some(worktree.worktree_path.as_str()));

    let exclude_text = fs::read_to_string(exclude).unwrap();
    assert!(exclude_text.contains("# keep existing entries"));
    assert!(exclude_text.contains(".DS_Store"));
    assert_eq!(exclude_text.matches(".argis/worktrees/").count(), 1);
    assert_eq!(fs::read_to_string(repo.join(".gitignore")).unwrap(), "build/\n");
    assert!(git(&repo, &["status", "--porcelain", "--untracked-files=all"]).stdout.is_empty());
}

#[test]
fn reports_non_git_projects_as_unavailable() {
    let parent = tempfile::tempdir().unwrap();
    let project = parent.path().join("plain-project");
    fs::create_dir(&project).unwrap();
    let (store, task_id) = task_store_for(&parent, &project, "Plain task");

    let status = inspect_task_git(&store, task_id).unwrap();

    assert!(!status.is_git_repository);
    assert!(!status.can_create_branch);
    assert!(status.reason.unwrap().contains("not a Git working tree"));
}

#[test]
fn reports_an_existing_branch_and_refuses_to_create_a_worktree() {
    let parent = tempfile::tempdir().unwrap();
    let repo = init_repository(&parent);
    let (store, task_id) = task_store_for(&parent, &repo, "Collide branch");
    let branch = task_branch_name(task_id, "Collide branch");
    assert!(git(&repo, &["branch", &branch]).status.success());

    let status = inspect_task_git(&store, task_id).unwrap();

    assert!(status.is_git_repository);
    assert!(!status.can_create_branch);
    assert!(status.branch_exists);
    assert!(status.reason.unwrap().contains("already exists"));
    assert!(create_task_worktree(&store, task_id).is_err());
}

#[test]
fn unusual_task_titles_are_never_interpreted_as_shell_commands() {
    let parent = tempfile::tempdir().unwrap();
    let repo = init_repository(&parent);
    let title = "Create $(touch pwned)";
    let (store, task_id) = task_store_for(&parent, &repo, title);

    let worktree = create_task_worktree(&store, task_id).unwrap();

    assert_eq!(worktree.branch_name, "argis/1-create-touch-pwned");
    assert!(!repo.join("pwned").exists());
}
