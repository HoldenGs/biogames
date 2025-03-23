import GameResult from "./GameResult";

export default interface GameResults {
    severe_mistakes: GameResult[],
    moderate_mistakes: GameResult[],
    mild_mistakes: GameResult[],
    correct: GameResult[]
}
