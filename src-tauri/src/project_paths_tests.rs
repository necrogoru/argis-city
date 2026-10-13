use crate::project_paths::register_project;
use crate::task_store::TaskStore;
use std::fs;
use std::path::Path;

#[test]
fn registers_an_existing_directory_using_its_canonical_path() {
    let dir = tempfile::tempdir().unwrap();
    let project_dir = dir.path().join("project");
    fs::create_dir(&project_dir).unwrap();
    let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();

    let project = register_project(&store, &project_dir, false).unwrap();

    assert_eq!(project.path, fs::canonicalize(project_dir).unwrap().to_string_lossy());
    assert_eq!(store.list_projects().unwrap(), vec![project]);
}

#[test]
fn creates_a_missing_directory_only_when_requested() {
    let dir = tempfile::tempdir().unwrap();
    let project_dir = dir.path().join("new-project");
    let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();

    let project = register_project(&store, &project_dir, true).unwrap();

    assert!(project_dir.is_dir());
    assert_eq!(project.path, fs::canonicalize(project_dir).unwrap().to_string_lossy());
    assert_eq!(store.list_projects().unwrap(), vec![project]);
}

#[test]
fn rejects_relative_project_paths_without_registering_them() {
    let dir = tempfile::tempdir().unwrap();
    let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();

    let result = register_project(&store, Path::new("relative/project"), true);

    assert!(result.unwrap_err().to_string().contains("absolute"));
    assert!(store.list_projects().unwrap().is_empty());
}

#[test]
fn rejects_a_file_as_a_project_directory() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("not-a-directory");
    fs::write(&file, "content").unwrap();
    let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();

    let result = register_project(&store, &file, true);

    assert!(result.unwrap_err().to_string().contains("not a directory"));
    assert!(store.list_projects().unwrap().is_empty());
}

#[test]
fn does_not_create_a_missing_directory_without_explicit_confirmation() {
    let dir = tempfile::tempdir().unwrap();
    let project_dir = dir.path().join("new-project");
    let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();

    assert!(register_project(&store, &project_dir, false).is_err());

    assert!(!project_dir.exists());
    assert!(store.list_projects().unwrap().is_empty());
}

#[test]
fn does_not_create_a_project_when_its_parent_is_a_file() {
    let dir = tempfile::tempdir().unwrap();
    let parent_file = dir.path().join("parent-file");
    fs::write(&parent_file, "content").unwrap();
    let project_dir = parent_file.join("project");
    let store = TaskStore::open(&dir.path().join("argis.sqlite")).unwrap();

    assert!(register_project(&store, &project_dir, true).is_err());

    assert!(store.list_projects().unwrap().is_empty());
}
