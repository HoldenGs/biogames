import { useState } from "react";
import FullscreenResultDisplay from "./FullscreenResultDisplay";
import GameResult from "./GameResult";
import { API_BASE_URL } from './config';

export interface ResultDisplayProps {
    result: GameResult
}

function ResultDisplay(props: ResultDisplayProps) {
    const [fullscreen, setFullscreen] = useState<boolean>(false);

    // Helper to display score in a meaningful way
    const formatScore = (points: number) => {
        if (points === 5) {
            return "5.0 (Perfect)";
        } else {
            return points.toString();
        }
    };

    return (
        <>
            <div className="border px-2 py-1 flex justify-between items-center cursor-pointer"
                onClick={() => setFullscreen(true)}>
                <img src={`${API_BASE_URL}/challenges/${props.result.challenge_id}/core`} width="64" height="64"/>
                <div className="flex flex-col text-sm">
                    <span>Correct Score: {props.result.correct_score}</span>
                    <span>Your Guess: {props.result.guess}</span>
                    <span>Points Earned: {formatScore(props.result.points)}</span>
                </div>
            </div>
            {fullscreen && (
                <FullscreenResultDisplay
                    result={props.result}
                    onClose={() => setFullscreen(false)}/>
            )}
        </>
    )
}

export default ResultDisplay;
