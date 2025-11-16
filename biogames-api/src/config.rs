use std::env;
use std::path::{Path, PathBuf};
use once_cell::sync::Lazy;

// Get the image base path from environment variable or use the default USB path
pub static IMAGE_BASE_PATH: Lazy<PathBuf> = Lazy::new(|| {
    env::var("IMAGE_BASE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/home/biogames/biogames-repo/Data_WebP"))
});

// Function to get the full path of an image
pub fn get_image_path(file_name: &str) -> PathBuf {
    let mut full_path = IMAGE_BASE_PATH.clone();
    
    // Extract just the filename without the path
    let base_name = Path::new(file_name).file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| file_name.to_string());
    
    // Try to find the file in the root directory of the USB drive
    full_path.push(&base_name);
    
    // If we can't find it there, check subdirectories based on score (0, 1, 2, 3)
    if !full_path.exists() {
        for subdir in &["0", "1", "2", "3"] {
            let mut subdir_path = IMAGE_BASE_PATH.clone();
            subdir_path.push(subdir);
            subdir_path.push(&base_name);
            
            if subdir_path.exists() {
                return subdir_path;
            }
        }
    }
    
    full_path
} 
