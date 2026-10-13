use crate::domain::Project;
use crate::task_store::TaskStore;
use anyhow::{anyhow, bail, Context};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

/// Registers an existing directory, or creates its final path component when
/// the caller has explicitly requested directory creation.
pub fn register_project(store: &TaskStore, path: &Path, create_if_missing: bool) -> anyhow::Result<Project> {
    if !path.is_absolute() {
        bail!("project path must be absolute: {}", path.display());
    }

    let canonical_path = match fs::canonicalize(path) {
        Ok(canonical_path) if canonical_path.is_dir() => canonical_path,
        Ok(_) => bail!("project path is not a directory: {}", path.display()),
        Err(error) if error.kind() == ErrorKind::NotFound && create_if_missing => create_project_directory(path)?,
        Err(error) => return Err(error).with_context(|| format!("resolving project path {}", path.display())),
    };

    let stored_path = canonical_path
        .to_str()
        .ok_or_else(|| anyhow!("project path is not valid UTF-8: {}", canonical_path.display()))?;
    store.create_project(stored_path).context("registering project")
}

fn create_project_directory(path: &Path) -> anyhow::Result<PathBuf> {
    let parent = path.parent().ok_or_else(|| anyhow!("project path has no parent directory"))?;
    let canonical_parent =
        fs::canonicalize(parent).with_context(|| format!("resolving parent {}", parent.display()))?;
    if !canonical_parent.is_dir() {
        bail!("project parent is not a directory: {}", canonical_parent.display());
    }

    let name = path.file_name().ok_or_else(|| anyhow!("project path must name a directory"))?;
    let created_path = canonical_parent.join(name);
    match fs::create_dir(&created_path) {
        Ok(()) => fs::canonicalize(&created_path).with_context(|| format!("resolving {}", created_path.display())),
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {
            let existing_path = fs::canonicalize(&created_path)?;
            if existing_path.is_dir() {
                Ok(existing_path)
            } else {
                bail!("project path is not a directory: {}", existing_path.display());
            }
        }
        Err(error) => Err(error).with_context(|| format!("creating project directory {}", created_path.display())),
    }
}
