import sys

with open("src-tauri/src/main.rs", "r", encoding="utf-8") as f:
    content = f.read()

import re

capture_screen_regex = r'fn capture_screen\(\) -> Result<String, String> \{.*?\n\}'
match = re.search(capture_screen_regex, content, re.DOTALL)
if match:
    new_fn = r'''fn capture_screen() -> Result<String, String> {
    use xcap::Monitor;
    use std::io::Cursor;
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine;

    // Do not panic if no monitors or if xcap fails.
    let monitors = match Monitor::all() {
        Ok(m) => m,
        Err(e) => return Err(format!("Failed to initialize screen capture: {}", e)),
    };
    
    let monitor = match monitors.into_iter().next() {
        Some(m) => m,
        None => return Err("No monitors found. Screen capture unavailable.".to_string()),
    };
    
    let image = match monitor.capture_image() {
        Ok(i) => i,
        Err(e) => return Err(format!("Failed to capture screen: {}", e)),
    };
    
    let dyn_img = image::DynamicImage::ImageRgba8(image);
    let rgb_img = dyn_img.into_rgb8();

    let mut buffer = Vec::new();
    let mut cursor = Cursor::new(&mut buffer);
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, 60);
    if let Err(e) = encoder.encode(rgb_img.as_raw(), rgb_img.width(), rgb_img.height(), image::ColorType::Rgb8.into()) {
        return Err(format!("Failed to encode image: {}", e));
    }
        
    let b64 = STANDARD.encode(&buffer);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}'''
    content = content.replace(match.group(0), new_fn)

with open("src-tauri/src/main.rs", "w", encoding="utf-8") as f:
    f.write(content)
