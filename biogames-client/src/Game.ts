import GameResults from "./GameResults";

export default interface Game {
    id: number,
    user: string,
    results: GameResults
    total_points: number
}
