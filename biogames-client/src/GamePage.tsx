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

    // Redirect if there's no saved username in sessionStorage
    const username = getUsername();
    if (!username) {
        return <Navigate to="/" replace />;
    }

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

    // Attempt to start a game, auto-quitting any existing session on 400
    const startGame = async (): Promise<Game> => {
        const user = getUsername();
        console.debug(`[GamePage] startGame() called: mode=${mode}, user='${user}'`);
        const url = `${API_BASE_URL}/games?mode=${mode}` + (mode === 'pretest' ? '&num_challenges=50' : '');
        let res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user })
        });
        if (res.status === 400) {
            // Log the raw 400 response body for debugging
            let rawError: string;
            try {
                rawError = await res.clone().text();
            } catch (e) {
                rawError = '<failed to read error body>'; }
            console.error(`[GamePage] create_game 400 for mode=${mode}, user='${user}'. Body: ${rawError}`);
            // Try to parse existing game ID
            let body: any;
            try { body = await res.clone().json(); } catch {}
            const openGameId = body?.game_id || body?.id;
            if (openGameId) {
                // Quit the existing game, then retry starting a new one
                await fetch(`${API_BASE_URL}/games/${openGameId}/quit`, { method: 'POST' });
                res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user })
                });
            }
        }
        if (!res.ok) {
            const text = await res.text();
            console.error(`[GamePage] create_game error: ${text}`);
            throw new Error(text || 'Unable to start training: server error');
        }
        return res.json();
    };

    const gameQuery = useQuery<Game, Error>(['game'], startGame, {
        retry: false,
        onError: (err: Error) => {
            console.error('create_game endpoint returned error:', err.message);
        }
    });

    const challengeQuery = useQuery<CurrentChallengeResponse, Error>({
        queryKey: ['challenge', gameQuery.data?.id],
        queryFn: async () => {
            console.log('[GamePage] challengeQuery starting fetch...'); // Log start
            if (!gameQuery.data) throw new Error("Game data not available for challengeQuery");
            const url = `${API_BASE_URL}/games/${gameQuery.data.id}/challenge`; // URL for the *first* challenge (no completed_count)
            console.log('[GamePage] challengeQuery fetching:', url);
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[GamePage] challengeQuery fetch failed:', response.status, errorText);
                throw new Error(`Challenge fetch failed: ${response.status} ${errorText}` || 'Network response was not ok');
            }
            const data = await response.json();
            console.log('[GamePage] challengeQuery fetch success:', data); // Log success
            return data;
        },
        enabled: !!gameQuery.data?.id,
        keepPreviousData: false,
        onError: (err: Error) => {
            console.error('[GamePage] challengeQuery error:', err.message);
        } // Log errors
    });

    // Prefetch the next core image as soon as we know the current challenge ID
    useEffect(() => {
        if (mode !== 'training') return;                // only in training
        const currentGameId = gameQuery.data?.id;
        const currentChallengeData = challengeQuery.data;
        console.log(`[GamePage] Prefetch effect triggered. Mode: ${mode}, GameID: ${currentGameId}, CurrentChallengeData:`, currentChallengeData); // Re-enabled log

        if (!currentGameId || !currentChallengeData || currentChallengeData.id === undefined) {
            console.log('[GamePage] Prefetch skipped: missing gameId or currentChallenge data.'); // Re-enabled log
            return;
        }

        // Determine the index of the *next* uncompleted challenge we want to fetch.
        const nextUncompletedChallengeIndex = 1; 

        // Fetch metadata for the *next* challenge using the new parameter
        console.log(`[GamePage] Prefetching next challenge (index ${nextUncompletedChallengeIndex} of uncompleted) for game ${currentGameId}...`); // Re-enabled log
        queryClient.fetchQuery(
            // Use a distinct key for the prefetch query
            ['challenge', currentGameId, 'prefetch_next', nextUncompletedChallengeIndex], 
            () => {
                console.log(`[GamePage] fetchQuery function running for prefetch: /games/${currentGameId}/challenge?completed_count=${nextUncompletedChallengeIndex}`); // Re-enabled log
                return fetch(`${API_BASE_URL}/games/${currentGameId}/challenge?completed_count=${nextUncompletedChallengeIndex}`)
                        .then(res => {
                            if (!res.ok) throw new Error(`Prefetch fetch failed: ${res.status}`);
                            return res.json();
                        });
            }
        ).then((next: { id?: number }) => { // Expecting { id: number | undefined, ... }
            if (!next || next.id === undefined) {
                console.warn('[GamePage] Prefetch query returned no next challenge ID (likely end of game). Data:', next); // Re-enabled log
                return; // No next challenge ID means we are likely at the end, or API returned unexpected shape
            }
            console.log(`[GamePage] Prefetched next challenge ID: ${next.id}. Current was: ${currentChallengeData.id}`); // Re-enabled log
            
            // If the prefetched ID is the same as the current one, log a warning.
            if (next.id === currentChallengeData.id) {
                console.warn('[GamePage] Prefetched ID is the same as current ID. Check API logic or timing.'); // Re-enabled log
            }

            const url = `${API_BASE_URL}/challenges/${next.id}/core?mode=${mode}`;
            console.log(`[GamePage] Preloading image for next challenge ${next.id}: ${url}`); // Re-enabled log
            
            // Preload with <link rel="preload">
            if (!document.querySelector(`link[rel="preload"][href="${url}"]`)) {
                const link = document.createElement('link');
                link.rel = 'preload'; link.as = 'image'; link.href = url;
                document.head.appendChild(link);
                console.log('[GamePage] Added <link rel="preload"> for:', url); // Re-enabled log
            }
            // Also prime via JS Image
            const img = new Image(); img.src = url;
        }).catch((error) => {
            console.error('[GamePage] Prefetch query failed:', error); // Re-enabled log
        });
        // Dependency array: trigger when game ID or current challenge data changes
    }, [gameQuery.data?.id, challengeQuery.data, mode, queryClient]);

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

    if (gameQuery.isError) {
        const errMsg = gameQuery.error.message || '';
        // If training prerequisites not met, redirect to pretest
        if (mode === 'training' && errMsg.toLowerCase().includes('prerequisites')) {
            setGameMode('pretest');
            return <Navigate to="/pretest/menu" replace />;
        }
        // If training limit reached, redirect to posttest
        if (mode === 'training' && errMsg.toLowerCase().includes('limit reached')) {
            setGameMode('posttest');
            return <Navigate to="/posttest/menu" replace />;
        }
        // Fallback: show error and a back button
        return (
            <div className="p-4 text-center">
                <p className="text-danger-500">{errMsg}</p>
                <button
                    className="mt-2 bg-primary-500 text-white px-4 py-2 rounded"
                    onClick={() => navigate('/menu')}
                >
                    Back to Menu
                </button>
            </div>
        );
    }

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
