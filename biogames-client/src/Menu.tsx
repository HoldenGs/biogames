import paper from './assets/paper.png';
import logo from './assets/logo3.webp';
import PlayForm from "./PlayForm";
import { useEffect, useState } from "react";
import Instructions from "./Instructions";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Leaderboard from './Leaderboard';
import { API_BASE_URL } from './config';
import Game from "./Game";

interface MenuProps {
    mode: string;
}

function Menu({ mode }: MenuProps) {
    const [showInstructions, setShowInstructions] = useState(false);
    const queryClient = useQueryClient();

    // useEffect(() => {
    //     queryClient.removeQueries(['game']);
    //     queryClient.removeQueries(['challenge']);
    //     //queryClient.removeQueries(['leaderboard']);
    // }, []);

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
                        
                        {/* {(mode === "pretest" || mode === "posttest") && <p style={{color:"red"}}><b>You are in {mode} mode.</b></p>}
                        {mode === "training" && <p style={{color:"green"}}><b>You are in training mode.</b></p>} */}
                        <p className="text-justify">
                            Enter a unique username below and click "Play" to start the
                            game.
                        </p>
                        <PlayForm mode={mode}/>
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
