use crate::domain::{TaskImageInput, TaskImageMimeType};
use crate::task_images::{decode_image_input, read_image_file, sanitize_file_name, sniff_mime_type, MAX_IMAGE_BYTES};
use base64::Engine;
use std::fs;
use std::path::Path;

const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
const BASE64: base64::engine::general_purpose::GeneralPurpose = base64::engine::general_purpose::STANDARD;

fn png_input() -> TaskImageInput {
    TaskImageInput {
        image_id: None,
        file_name: "shot.png".into(),
        mime_type: TaskImageMimeType::Png,
        data_base64: Some(BASE64.encode(PNG)),
    }
}

#[test]
fn sniffs_supported_image_formats() {
    assert_eq!(sniff_mime_type(PNG), Some(TaskImageMimeType::Png));
    assert_eq!(sniff_mime_type(&[0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0]), Some(TaskImageMimeType::Jpeg));
    assert_eq!(sniff_mime_type(b"GIF89a\x01\x00\x01\x00"), Some(TaskImageMimeType::Gif));
    assert_eq!(sniff_mime_type(b"RIFF\x24\x00\x00\x00WEBPVP8 "), Some(TaskImageMimeType::Webp));
    assert_eq!(sniff_mime_type(b"%PDF-1.7"), None);
    assert_eq!(sniff_mime_type(&[]), None);
}

#[test]
fn sanitizes_display_file_names() {
    assert_eq!(sanitize_file_name("../screens/a\nb.png"), "a b.png");
    assert_eq!(sanitize_file_name("   "), "image");
    assert_eq!(sanitize_file_name(&"x".repeat(400)).len(), 160);
}

#[test]
fn decodes_input_and_rejects_bad_payloads() {
    assert_eq!(decode_image_input(&png_input()).unwrap(), PNG);

    let mut mismatch = png_input();
    mismatch.mime_type = TaskImageMimeType::Jpeg;
    assert!(decode_image_input(&mismatch).unwrap_err().to_string().contains("does not match"));

    let mut empty = png_input();
    empty.data_base64 = Some(String::new());
    assert!(decode_image_input(&empty).is_err());

    let mut missing = png_input();
    missing.data_base64 = None;
    assert!(decode_image_input(&missing).is_err());

    let mut oversized = png_input();
    let mut bytes = PNG.to_vec();
    bytes.resize(MAX_IMAGE_BYTES + 1, 0);
    oversized.data_base64 = Some(BASE64.encode(bytes));
    assert!(decode_image_input(&oversized).unwrap_err().to_string().contains("10 MB"));
}

#[test]
fn reads_image_files_and_rejects_directories_and_non_images() {
    let dir = tempfile::tempdir().unwrap();
    let image = dir.path().join("shot.png");
    fs::write(&image, PNG).unwrap();

    let file = read_image_file(&image).unwrap();
    assert_eq!(file.mime_type, TaskImageMimeType::Png);
    assert_eq!(file.file_name, "shot.png");
    assert_eq!(file.byte_size, PNG.len() as i64);
    assert_eq!(BASE64.decode(file.data_base64).unwrap(), PNG);

    assert!(read_image_file(dir.path()).unwrap_err().to_string().contains("not a file"));
    let text = dir.path().join("notes.txt");
    fs::write(&text, b"hello").unwrap();
    assert!(read_image_file(&text).unwrap_err().to_string().contains("not a supported image"));
    assert!(read_image_file(Path::new("relative.png")).is_err());
    let zero = dir.path().join("empty.png");
    fs::write(&zero, b"").unwrap();
    assert!(read_image_file(&zero).is_err());
}

#[test]
fn tauri_decodes_the_png_bytes_the_clipboard_will_receive() {
    // 1x1 transparent PNG: proves the `image-png` feature is on, which
    // `clipboard-manager`'s writeImage needs to accept encoded bytes.
    const ONE_PIXEL_PNG: &[u8] = &[
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0b, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60, 0x00, 0x02, 0x00, 0x00, 0x05, 0x00, 0x01, 0x7a, 0x5e,
        0xab, 0x3f, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ];

    let image = tauri::image::Image::from_bytes(ONE_PIXEL_PNG).expect("image-png must decode PNG bytes");
    assert_eq!((image.width(), image.height()), (1, 1));
}
