import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Game from "./Game";
import CurrentChallengeResponse from "./CurrentChallengeResponse";
import logo from './assets/logo3.webp';
import { Navigate, useNavigate } from "react-router-dom";
import { getUsername, getGameMode, setGameMode } from "./Auth";
import { useEffect, useState } from "react";
import { API_BASE_URL } from './config';
import ZoomableImage from './ZoomableImage';


interface GamePageProps {
    mode: 'pretest' | 'posttest' | 'training';
}

function GamePage({ mode }: GamePageProps) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [gameStart, _] = useState(new Date());
    const [challengeTime, setChallengeTime] = useState(0);
    const [timeString, setTimeString] = useState("");
    const [showInstructions, setShowInstructions] = useState(false);

    useEffect(() => {
        // this timer should be self-adjusting eventually to preserve accuracy
        const interval = setInterval(() => {
            const time = new Date().valueOf() - gameStart.valueOf();
            const hours = Math.floor(time / (1000 * 60 * 60));
            const minutes = Math.floor((time / (1000 * 60)) % 60);
            const seconds = Math.floor((time / (1000)) % 60);
            const builder = [];
            if (hours > 0) {
                builder.push(`${hours}h `)
            }
            if (minutes > 0) {
                builder.push(`${minutes}m `)
            }
            builder.push(`${seconds}s`)
            setTimeString(builder.join(""));
        }, 100);
        return () => clearInterval(interval);
    }, [gameStart]);

    useEffect(() => {
        // this one doesn't necessarily need to be self-adjusting, as it gets
        // reset on every challenge submission
        const interval = setInterval(() => {
            setChallengeTime(challengeTime + 100);
        }, 100);
        return () => clearInterval(interval);
    }, [challengeTime, setChallengeTime]);

    const gameQuery = useQuery<Game, Error>({
        queryKey: ['game'],
        queryFn: async () =>
             await fetch(`${API_BASE_URL}/games?mode=${getGameMode()}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username: getUsername() })
             }).then((res) => res.json())
    });

    const challengeQuery = useQuery<CurrentChallengeResponse, Error>({
        queryKey: ['challenge', gameQuery.data?.id],
        queryFn: async () => {
            if (!gameQuery.data) throw new Error("Game data not available");
            const response = await fetch(`${API_BASE_URL}/games/${gameQuery.data.id}/challenge`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        },
        enabled: !!gameQuery.data?.id,
        keepPreviousData: false
    });

    const scoreMutation = useMutation({
        mutationFn: async (guess: number) => {
            if (!challengeQuery.data) return;
            await fetch(`${API_BASE_URL}/challenges/${challengeQuery.data.id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ "guess": guess })
            });
        },
        networkMode: "always",
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['challenge']});
            setChallengeTime(0);
        }
    });

    const quitMutation = useMutation({
        mutationFn: async (game_id: number) => {
            await fetch(`${API_BASE_URL}/games/${game_id}/quit`, {
                method: "POST",
            });
        },
        networkMode: "always",
        onSuccess: () => {
            console.log(challengeQuery.data?.completed_challenges);
            if (challengeQuery.data?.completed_challenges === 0) {
                // No progress: go home
                navigate('/');
            } else {
                // If in a test mode, switch to training and go to the training menu
                if (getGameMode() === 'pretest' || getGameMode() === 'posttest') {
                    // Clear any cached game/challenge data so new training game starts fresh
                    queryClient.removeQueries({ queryKey: ['game'] });
                    queryClient.removeQueries({ queryKey: ['challenge'] });
                    setGameMode('training');
                    navigate('/menu');
                } else {
                    // Non-test mode quit: go to results
                    navigate(`/games/${gameQuery.data?.id}/results`);
                }
            }
        }
    });

    if (gameQuery.isLoading || challengeQuery.isLoading) return 'Loading...';
    if (challengeQuery.data === undefined) return 'Loading...';

    if (challengeQuery.data.completed_challenges === challengeQuery.data.total_challenges) {
        if (getGameMode() === 'pretest' || getGameMode() === 'posttest') {
            return (<Navigate to={`/menu`}/>);
        } else {
            return (<Navigate to={`/games/${gameQuery.data?.id}/results`}/>);
        }
    }

    return (
        <div className="grid md:w-[1000px] md:max-w-[90vw] m-2 md:mx-auto grid-rows-[repeat(4,_min-content)_1fr] grid-cols-1 md:grid-rows-[repeat(3,_min-content)_1fr] md:grid-cols-[1fr_min-content_15rem] gap-2">
            <img src={logo} alt="Logo" className="md:col-span-3 m-auto"/>
            <div className="flex justify-between md:col-span-3">
                <h3 className="text-lg md:text-2xl">
                    Patch {challengeQuery.data.completed_challenges + 1} of {challengeQuery.data.total_challenges}
                </h3>
                <h3 className="text-lg md:text-2xl">Game Mode: {getGameMode()}</h3>
                <h3 className="text-lg md:text-2xl">Time: {timeString}</h3>
            </div>
            <div>
                <ZoomableImage src={`${API_BASE_URL}/challenges/${challengeQuery.data.id}/core?mode=${getGameMode()}`} className="max-h-[75vh]"/>
            </div>
            <div className="flex md:flex-col justify-between gap-2">
                <button className="bg-primary-500 disabled:bg-primary-300 text-white rounded p-2 px-8 grow"
                    disabled={challengeTime < 5000}
                    onClick={() => scoreMutation.mutate(0)}>0</button>
                <button className="bg-primary-500 disabled:bg-primary-300 text-white rounded p-2 px-8 grow"
                    disabled={challengeTime < 5000}
                    onClick={() => scoreMutation.mutate(1)}>1</button>
                <button className="bg-primary-500 disabled:bg-primary-300 text-white rounded p-2 px-8 grow"
                    disabled={challengeTime < 5000}
                    onClick={() => scoreMutation.mutate(2)}>2</button>
                <button className="bg-primary-500 disabled:bg-primary-300 text-white rounded p-2 px-8 grow"
                    disabled={challengeTime < 5000}
                    onClick={() => scoreMutation.mutate(3)}>3</button>
            </div>
            <div className="flex flex-col gap-2 h-full">
                <button className="bg-gray-500 text-white rounded p-2 w-full"
                    onClick={() => setShowInstructions(!showInstructions)}>
                    {showInstructions ? 'Hide' : 'Show'} Instructions
                </button>
                {showInstructions && (
                    <p className="mt-2 text-justify">
                        For each core, indicate its HER2 level using one of the four
                        buttons. There is a minimum wait time of 5 seconds before
                        you can make a selection. When you have identified the last
                        patch, you will have the opportunity to review your mistakes
                        and the correct HER2 level for those patches. You will also
                        see a leaderboard to compare your performance to that of
                        other players.
                    </p>
                )}
                <a href="https://research.seas.ucla.edu/ozcan/" target="_blank" className="mt-auto">
                    <button className="bg-gray-500 text-white rounded p-2 w-full whitespace-nowrap">
                        <i className="fa fa-link mr-1"></i>
                        Ozcan Lab
                    </button>
                </a>
                <a href="https://doi.org/10.5858/2010-0454-RAR.1" target="_blank">
                    <button className="bg-gray-500 text-white rounded p-2 w-full whitespace-nowrap">
                        <i className="fa fa-link mr-1"></i>
                        More on HER2
                    </button>
                </a>
                <button className="bg-gray-500 text-white rounded p-2 w-full whitespace-nowrap"
                    onClick={() => gameQuery.data?.id && quitMutation.mutate(gameQuery.data.id)}>
                    Quit
                </button>
            </div>
        </div>
    );
}

export default GamePage;
