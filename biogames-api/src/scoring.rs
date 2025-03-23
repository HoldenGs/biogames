/// Confusion matrix for HER2 scoring
/// Rows represent guess values (0-3)
/// Columns represent ground truth values (0-3)
pub const HER2_CONFUSION_MATRIX: [[i32; 4]; 4] = [
    [ 5, -2, -3, -5], // Guess 0
    [-1,  5, -2, -3], // Guess 1
    [-2, -1,  5, -1], // Guess 2
    [-4, -2, -1,  5], // Guess 3
];

/// Get score from confusion matrix for a guess and ground truth value
pub fn get_score(guess: i32, ground_truth: i32) -> i32 {
    if guess < 0 || guess > 3 || ground_truth < 0 || ground_truth > 3 {
        return -5; // Default to highest penalty for out-of-range values
    }
    
    HER2_CONFUSION_MATRIX[guess as usize][ground_truth as usize]
} 