import paper from './assets/paper.png';
import logo from './assets/logo3.webp';
import PlayForm from "./PlayForm";
import PreTestPlayForm from "./PreTestPlayForm";
import { useEffect, useState } from "react";
import Instructions from "./Instructions";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Leaderboard from './Leaderboard';
import { API_BASE_URL } from './config';
import Game from "./Game";
import { isAuthenticated, setGameMode } from './Auth';
import { useNavigate } from 'react-router-dom';

interface MenuProps {
    mode: string;
}

function Menu({ mode }: MenuProps) {
    const [showInstructions, setShowInstructions] = useState(false);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // No automatic redirect; user can choose Introduction via button if needed

    useEffect(() => {
        queryClient.invalidateQueries(['game']);
        queryClient.invalidateQueries(['challenge']);
        queryClient.invalidateQueries(['leaderboard']);
    }, [queryClient]);

    return (
        <>
        <div className="border-2 border-black m-2 mx-auto p-4 w-[1000px] max-w-[95vw]">
            <div className="flex flex-col gap-4 mb-2 md:grid md:grid-cols-[2fr_1fr]">
                <div className="flex flex-col justify-between gap-2">
                    <div className="flex flex-col gap-2">
                        <img src={logo} alt="Logo" className="mb-2"/>
                        {/* Mode toggle buttons */}
                        <div className="flex gap-2 mb-4">
                            <button
                                className="px-3 py-1 rounded bg-gray-200"
                                onClick={() => navigate('/introduction')}
                            >
                                Introduction
                            </button>
                            <button
                                className={`px-3 py-1 rounded ${mode === 'training' ? 'bg-primary-500 text-white' : 'bg-gray-200'}`}
                                onClick={() => { setGameMode('training'); navigate('/menu'); }}
                            >
                                Training
                            </button>
                            <button
                                className={`px-3 py-1 rounded ${mode === 'pretest' ? 'bg-primary-500 text-white' : 'bg-gray-200'}`}
                                onClick={() => { setGameMode('pretest'); navigate('/pretest/menu'); }}
                            >
                                Pretest
                            </button>
                            <button
                                className={`px-3 py-1 rounded ${mode === 'posttest' ? 'bg-primary-500 text-white' : 'bg-gray-200'}`}
                                onClick={() => { setGameMode('posttest'); navigate('/posttest/menu'); }}
                            >
                                Posttest
                            </button>
                        </div>
                        <p className="text-justify">
                            {mode === "pretest" 
                                ? "Welcome to the pre-test! Please enter your User ID and choose a username to begin."
                                : "Enter your User ID below and click \"Play\" to start the game."}
                        </p>
                        <div>
                            <p>If you don't have a User ID, go to the introduction page and input your mednet email address.</p>
                        </div>
                        {mode === "pretest" 
                            ? <PreTestPlayForm mode={mode}/> 
                            : <PlayForm mode={mode}/>}
                    </div>
                    <div className="flex flex-col gap-2">
                        <button className="bg-primary-500 p-2 text-white w-full"
                            onClick={() => setShowInstructions(true)}>
                            Instructions
                        </button>
                        <a href="https://research.seas.ucla.edu/ozcan/"
                            className="block w-full"
                            target="_blank">
                            <button className="bg-primary-500 p-2 text-white w-full">
                                <i className="fa fa-link mr-1"></i>
                                Ozcan Lab
                            </button>
                        </a>
                        <a href="https://pubs.rsc.org/en/content/articlelanding/2012/lc/c2lc40614d"
                            className="block w-full"
                            target="_blank">
                            <button className="bg-primary-500 p-2 text-white w-full">
                                <i className="fa fa-link mr-1"></i>
                                More on BioGames
                            </button>
                        </a>
                    </div>
                </div>
                <a href="https://doi.org/10.5858/2010-0454-RAR.1" target="_blank">
                    <figure className="flex flex-col gap-1">
                        <img src={paper} alt="Paper" className="border border-black"/>
                        <figcaption className="text-xs">HER2: biology, detection, and clinical implications</figcaption>
                    </figure>
                </a>
            </div>
            <Leaderboard game_id={Number(7)}/>
        </div>
        {showInstructions && (<Instructions onClose={() => setShowInstructions(false)}/>)}
        </>
        
    )
}

export default Menu;
