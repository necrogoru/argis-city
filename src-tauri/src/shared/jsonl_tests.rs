use super::*;
use std::io::Write;

#[derive(Default)]
struct Collect {
    values: Vec<i64>,
}

impl LineFold for Collect {
    fn apply(&mut self, line: &Value) {
        if let Some(n) = line["n"].as_i64() {
            self.values.push(n);
        }
    }
}

fn append(path: &Path, text: &str) {
    let mut f = fs::OpenOptions::new().create(true).append(true).open(path).unwrap();
    f.write_all(text.as_bytes()).unwrap();
}

fn values(cache: &mut JsonlTailCache<Collect>, path: &Path) -> Vec<i64> {
    cache.read_with(path, |s, _| s.values.clone()).unwrap()
}

#[test]
fn reads_only_appended_lines() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("t.jsonl");
    append(&path, "{\"n\":1}\n{\"n\":2}\n");
    let mut cache = JsonlTailCache::new();
    assert_eq!(values(&mut cache, &path), vec![1, 2]);
    append(&path, "{\"n\":3}\n");
    assert_eq!(values(&mut cache, &path), vec![1, 2, 3]);
    assert_eq!(values(&mut cache, &path), vec![1, 2, 3]);
}

#[test]
fn waits_for_partial_lines_and_skips_garbage() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("t.jsonl");
    append(&path, "{\"n\":1}\nnot json\n{\"n\":");
    let mut cache = JsonlTailCache::new();
    assert_eq!(values(&mut cache, &path), vec![1]);
    append(&path, "2}\n");
    assert_eq!(values(&mut cache, &path), vec![1, 2]);
}

#[test]
fn accepts_complete_object_without_trailing_newline_once() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("t.jsonl");
    append(&path, "{\"n\":1}");
    let mut cache = JsonlTailCache::new();
    assert_eq!(values(&mut cache, &path), vec![1]);
    append(&path, "\n{\"n\":2}\n");
    assert_eq!(values(&mut cache, &path), vec![1, 2]);
}

#[test]
fn rereads_from_start_when_file_shrinks() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("t.jsonl");
    append(&path, "{\"n\":1}\n{\"n\":2}\n");
    let mut cache = JsonlTailCache::new();
    assert_eq!(values(&mut cache, &path), vec![1, 2]);
    fs::write(&path, "{\"n\":9}\n").unwrap();
    assert_eq!(values(&mut cache, &path), vec![9]);
}

#[test]
fn sweep_evicts_untouched_entries() {
    let dir = tempfile::tempdir().unwrap();
    let a = dir.path().join("a.jsonl");
    let b = dir.path().join("b.jsonl");
    append(&a, "{\"n\":1}\n");
    append(&b, "{\"n\":2}\n");
    let mut cache = JsonlTailCache::new();
    values(&mut cache, &a);
    values(&mut cache, &b);
    cache.sweep();
    values(&mut cache, &a);
    cache.sweep();
    assert_eq!(cache.len(), 1);
}

#[test]
fn missing_file_is_an_error() {
    let mut cache: JsonlTailCache<Collect> = JsonlTailCache::new();
    assert!(cache.read_with(Path::new("/nonexistent/x.jsonl"), |_, _| ()).is_err());
}
