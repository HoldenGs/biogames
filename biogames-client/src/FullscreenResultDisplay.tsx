import React from 'react';
import GameResult from "./GameResult";
import { API_BASE_URL } from './config';
import ZoomableImage from "./ZoomableImage";

export interface FullscreenResultDisplayProps {
    result: GameResult
    onClose: React.MouseEventHandler<HTMLButtonElement>
}

function FullscreenResultDisplay(props: FullscreenResultDisplayProps) {
    return (
        <div className="fixed top-0 left-0 w-screen h-screen bg-black/50 z-1">
            <div className="p-4 mx-auto my-4 w-max bg-white border-2 border-black text-black">
                <div className="flex justify-end mb-2">
                    <button onClick={props.onClose}>
                        <i className="fa fa-x"></i>
                    </button>
                </div>
                <ZoomableImage src={`${API_BASE_URL}/challenges/${props.result.challenge_id}/core`}
                    className="max-w-[80vw] h-[80vh]"/>
            </div>
        </div>
    )
}

export default FullscreenResultDisplay;
