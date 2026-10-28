use crate::domain::{TaskImageFile, TaskImageInput, TaskImageMimeType};
use anyhow::{bail, Context};
use base64::Engine;
use std::fs;
use std::path::{Path, PathBuf};

pub const MAX_TASK_IMAGES: usize = 12;
pub const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;
pub const MAX_TASK_IMAGE_BYTES: i64 = 30 * 1024 * 1024;

const FILE_NAME_MAX_CHARS: usize = 160;
const BASE64: base64::engine::general_purpose::GeneralPurpose = base64::engine::general_purpose::STANDARD;

/// Recognises the supported formats from their magic bytes; the client value is never trusted alone.
pub fn sniff_mime_type(bytes: &[u8]) -> Option<TaskImageMimeType> {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some(TaskImageMimeType::Png);
    }
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some(TaskImageMimeType::Jpeg);
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some(TaskImageMimeType::Gif);
    }
    if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        return Some(TaskImageMimeType::Webp);
    }
    None
}

/// Keeps a display name only: the final path segment, no control characters, or runaway lengths.
pub fn sanitize_file_name(name: &str) -> String {
    let segment = name.rsplit(['/', '\\']).find(|part| !part.trim().is_empty()).unwrap_or("");
    let cleaned: String =
        segment.chars().map(|character| if character.is_control() { ' ' } else { character }).collect();
    let collapsed = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = collapsed.trim();
    if trimmed.is_empty() {
        return "image".to_owned();
    }
    trimmed.chars().take(FILE_NAME_MAX_CHARS).collect()
}

/// Decodes and validates the base64 payload of a newly added image.
pub fn decode_image_input(input: &TaskImageInput) -> anyhow::Result<Vec<u8>> {
    let data = input.data_base64.as_deref().context("a new task image needs dataBase64")?;
    let bytes = BASE64.decode(data).context("task image data is not valid base64")?;
    if bytes.is_empty() {
        bail!("task image data is empty");
    }
    if bytes.len() > MAX_IMAGE_BYTES {
        bail!("task image exceeds {} MB", MAX_IMAGE_BYTES / (1024 * 1024));
    }
    match sniff_mime_type(&bytes) {
        Some(sniffed) if sniffed == input.mime_type => Ok(bytes),
        Some(sniffed) => bail!("task image type {} does not match {}", input.mime_type.as_str(), sniffed.as_str()),
        None => bail!("task image is not a supported PNG, JPEG, WebP, or GIF file"),
    }
}

/// Reads an image file for the drag-and-drop path, which supplies paths instead of File objects.
pub fn read_image_file(path: &Path) -> anyhow::Result<TaskImageFile> {
    if !path.is_absolute() {
        bail!("image path must be absolute");
    }
    let metadata = fs::metadata(path).with_context(|| format!("reading {}", path.display()))?;
    if !metadata.is_file() {
        bail!("image path is not a file: {}", path.display());
    }
    if metadata.len() > MAX_IMAGE_BYTES as u64 {
        bail!("task image exceeds {} MB", MAX_IMAGE_BYTES / (1024 * 1024));
    }
    let bytes = fs::read(path).with_context(|| format!("reading {}", path.display()))?;
    let mime_type =
        sniff_mime_type(&bytes).with_context(|| format!("not a supported image file: {}", path.display()))?;
    let file_name =
        path.file_name().map(|name| sanitize_file_name(&name.to_string_lossy())).unwrap_or_else(|| "image".to_owned());
    Ok(TaskImageFile { file_name, mime_type, byte_size: bytes.len() as i64, data_base64: BASE64.encode(bytes) })
}

pub fn stored_image_path(image_root: &Path, task_id: i64, image_id: i64) -> PathBuf {
    image_root.join(task_id.to_string()).join(image_id.to_string())
}
