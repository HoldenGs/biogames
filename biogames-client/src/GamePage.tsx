import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Game from "./Game";
import CurrentChallengeResponse from "./CurrentChallengeResponse";
import logo from './assets/logo3.webp';
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getUsername, getGameMode, setGameMode as AuthSetGameMode, getUserId } from "./Auth";
import React, { useEffect, useState, useRef } from "react";
import { API_BASE_URL } from './config';
import ZoomableImage from './ZoomableImage';

interface GamePageProps {
    mode: 'pretest' | 'posttest' | 'training';
}

function GamePage({ mode }: GamePageProps) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { gameId: gameIdFromUrl, challengeId: challengeIdFromUrl } = useParams<{ gameId?: string, challengeId?: string }>();

    console.log(`[GamePage] TOP RENDER. Mode prop: ${mode}, gameIdFromUrl: ${gameIdFromUrl}, challengeIdFromUrl: ${challengeIdFromUrl}, Auth gameMode: ${getGameMode()}`);

    const [activeGameId, setActiveGameId] = useState<number | null>(null);
    const initialCreationAttemptedRef = useRef(false);
    const authUserId = getUserId();

    const [gameStartTime, _] = useState(new Date());
    const [buttonsCanBeEnabled, setButtonsCanBeEnabled] = useState(false);
    const [overallTimeString, setOverallTimeString] = useState("");
    const [showInstructions, setShowInstructions] = useState(false);

    const displayUsername = getUsername();

    const challengeQuery = useQuery<CurrentChallengeResponse, Error>({
        queryKey: ['challenge', activeGameId],
        queryFn: async () => {
            if (!activeGameId) throw new Error("activeGameId is null, cannot fetch challenge.");
            console.log(`[GamePage] challengeQuery START. Mode prop: ${mode}, Auth gameMode: ${getGameMode()}. Fetching for activeGameId: ${activeGameId}`);
            const url = `${API_BASE_URL}/games/${activeGameId}/challenge`;
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[GamePage] challengeQuery fetch for game ${activeGameId} failed:`, response.status, errorText);
                let specificError = `Challenge fetch failed: ${response.status} ${errorText}`;
                if (response.status === 404) specificError = `No challenge data found for game ${activeGameId} (404).`;
                throw new Error(specificError);
            }
            const data = await response.json();
            console.log(`[GamePage] challengeQuery SUCCESS. Mode: ${mode}, Auth GameMode: ${getGameMode()}. Fetched data:`, JSON.parse(JSON.stringify(data)));
            console.log(`[GamePage] challengeQuery SUCCESS. Challenge ID from API: ${data?.id}`);
            if (data.id && (String(data.id) !== challengeIdFromUrl || !challengeIdFromUrl)) {
                console.log(`[GamePage] challengeQuery - Navigating to update challengeId. Mode: ${mode}. Target: /${mode}/game/${activeGameId}/${data.id}`);
                navigate(`/${mode}/game/${activeGameId}/${data.id}`, { replace: true });
            }
            return data;
        },
        enabled: !!activeGameId && !!authUserId,
        keepPreviousData: false,
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5,
        onError: (err: Error) => {
            console.error(`[GamePage] challengeQuery FAILED. Mode: ${mode}, Auth GameMode: ${getGameMode()}. Error:`, err.message);
        }
    });

    if (!authUserId) {
        console.error("[GamePage] No authUserId found. Navigating to home.");
        return <Navigate to="/" replace />;
    }

    const createGameAsync = async (): Promise<Game> => {
        if (!authUserId) throw new Error("User ID not found, cannot create game.");
        console.debug(`[GamePage] createGameAsync() called: mode=${mode}, user_id='${authUserId}'`);
        const url = `${API_BASE_URL}/games?mode=${mode}` + (mode === 'pretest' ? '&num_challenges=50' : '');
        let res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: authUserId })
        });
        if (res.status === 400) {
            let errorResponseJson: any = {};
            try { errorResponseJson = await res.clone().json(); console.log(`[GamePage] createGameAsync 400 JSON response:`, errorResponseJson); }
            catch (e) { try { const rawErrorText = await res.text(); errorResponseJson.message = rawErrorText || "Failed to create game (400)."; } catch { errorResponseJson.message = "Failed to create game (400) and read body.";}}
            const openGameId = errorResponseJson?.existing_game_id;
            if (openGameId && typeof openGameId === 'number') {
                console.log(`[GamePage] Existing game ${openGameId} found due to 400. Quitting it.`);
                const quitRes = await fetch(`${API_BASE_URL}/games/${openGameId}/quit`, { method: 'POST' });
                console.log(`[GamePage] Quit attempt for game ${openGameId} status: ${quitRes.status}`);
                if (!quitRes.ok) { const quitErrorText = await quitRes.text(); console.error(`[GamePage] Failed to quit existing game ${openGameId}: ${quitRes.status} ${quitErrorText}`); }
                else { console.log(`[GamePage] Successfully quit existing game ${openGameId}.`); }
                console.log("[GamePage] Retrying game creation after attempting to quit existing one.");
                res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: authUserId }) });
            } else { console.warn("[GamePage] 400 during game creation, no existing_game_id found to quit.", errorResponseJson); }
        }
        if (!res.ok) {
            let errorText = "Unknown error."; try { const ed = await res.json(); errorText = ed.message || ed.error || JSON.stringify(ed); } catch { try { errorText = await res.text(); } catch {errorText = `Server ${res.status}`;}}
            console.error(`[GamePage] createGameAsync FAILED: ${errorText}`); throw new Error(errorText);
        }
        return res.json();
    };

    const createGameMutation = useMutation<Game, Error, void>(createGameAsync, {
        onSuccess: (newGameData) => {
            console.log(`[GamePage] createGameMutation SUCCESS. Mode: ${mode}, Auth GameMode: ${getGameMode()}. New game ID: ${newGameData.id}. Navigating to: /${mode}/game/${newGameData.id}`);
            setActiveGameId(newGameData.id);
            navigate(`/${mode}/game/${newGameData.id}`, { replace: true });
        },
        onError: (error) => {
            console.error(`[GamePage] createGameMutation FAILED. Mode: ${mode}, Auth GameMode: ${getGameMode()}. Error:`, error.message);
            initialCreationAttemptedRef.current = false;
        }
    });

    useEffect(() => {
        const parsedGameIdFromUrl = gameIdFromUrl ? parseInt(gameIdFromUrl) : null;
        console.log(`[GamePage] GameID/Creation useEffect. parsedGameIdFromUrl: ${parsedGameIdFromUrl}, current activeGameId state: ${activeGameId}, initialCreationAttemptedRef: ${initialCreationAttemptedRef.current}, mutation isLoading: ${createGameMutation.isLoading}`);

        if (parsedGameIdFromUrl) {
            if (activeGameId !== parsedGameIdFromUrl) {
                console.log(`[GamePage] Setting activeGameId from URL: ${parsedGameIdFromUrl}`);
                setActiveGameId(parsedGameIdFromUrl);
            }
            initialCreationAttemptedRef.current = true;
        } else {
            if (authUserId && !initialCreationAttemptedRef.current && !createGameMutation.isLoading) {
                 console.log("[GamePage] No gameId in URL & creation not yet attempted. Triggering game creation.");
                 initialCreationAttemptedRef.current = true;
                 createGameMutation.mutate();
            } else if (!authUserId) {
                console.log("[GamePage] No gameId in URL, but no authUserId. Cannot create game.");
            } else if (initialCreationAttemptedRef.current && !createGameMutation.isLoading) {
                 console.log("[GamePage] No gameId in URL, creation was already attempted or in progress. Mutation not loading (could be success/error/idle after reset/nav).");
            } else if (createGameMutation.isLoading) {
                 console.log("[GamePage] No gameId in URL, but game creation mutation is already loading.");
            }
        }
    }, [gameIdFromUrl, authUserId, createGameMutation.isLoading, mode]);

    useEffect(() => {
        const interval = setInterval(() => {
            const time = new Date().valueOf() - gameStartTime.valueOf();
            const hours = Math.floor(time / (1000 * 60 * 60));
            const minutes = Math.floor((time / (1000 * 60)) % 60);
            const seconds = Math.floor((time / (1000)) % 60);
            const builder = [];
            if (hours > 0) builder.push(`${hours}h `);
            if (minutes > 0) builder.push(`${minutes}m `);
            builder.push(`${seconds}s`);
            // setOverallTimeString(builder.join("")); // Temporarily comment out to reduce re-renders
        }, 100);
        return () => clearInterval(interval);
    }, [gameStartTime]);

    useEffect(() => {
        if (challengeQuery.data?.id && activeGameId) {
            setButtonsCanBeEnabled(false);
            console.log(`[GamePage] New challenge loaded (ID: ${challengeQuery.data.id}). Starting 5s timer for buttons.`);
            const timerId = setTimeout(() => {
                console.log(`[GamePage] 5s timer elapsed for challenge (ID: ${challengeQuery.data.id}). Enabling buttons.`);
                setButtonsCanBeEnabled(true);
            }, 5000);

            return () => {
                console.log(`[GamePage] Cleanup: Clearing 5s timer for challenge (ID: ${challengeQuery.data.id}).`);
                clearTimeout(timerId);
            };
        } else if (!activeGameId) {
            setButtonsCanBeEnabled(false);
        }
    }, [challengeQuery.data?.id, activeGameId]);

    useEffect(() => {
        const currentChallengeData = challengeQuery.data;
        if (!activeGameId || !currentChallengeData?.id || currentChallengeData.completed_challenges >= currentChallengeData.total_challenges) {
            return;
        }
        const nextChallengeIndex = currentChallengeData.completed_challenges + 1;
        queryClient.fetchQuery<CurrentChallengeResponse>({
            queryKey: ['challenge', activeGameId, 'prefetch_next', nextChallengeIndex],
            queryFn: async () => {
                const url = `${API_BASE_URL}/games/${activeGameId}/challenge?completed_count=1`;
                const response = await fetch(url);
                if (!response.ok) { console.error('[GamePage] Prefetch metadata fetch failed:', response.status, await response.text()); throw new Error('Prefetch metadata failed'); }
                const data = await response.json();
                if (data.id) {
                    const nextImageUrl = `${API_BASE_URL}/challenges/${data.id}/core?mode=${mode}`;
                    if (!document.querySelector(`link[rel="preload"][href="${nextImageUrl}"]`)) {
                        const link = document.createElement('link');
                        link.rel = 'preload'; link.as = 'image'; link.href = nextImageUrl;
                        document.head.appendChild(link);
                    }
                }
                return data;
            },
        }).catch((error) => {
            console.error('[GamePage] Prefetch query for next challenge metadata failed:', error);
        });
    }, [activeGameId, challengeQuery.data, mode, queryClient]);

    const scoreMutation = useMutation<void, Error, number>({
        mutationFn: async (guess: number) => {
            if (!challengeQuery.data?.id) { console.error("scoreMutation: No current challenge ID."); throw new Error("No active challenge.");}
            await fetch(`${API_BASE_URL}/challenges/${challengeQuery.data.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ "guess": guess }) });
        },
        networkMode: "always",
        onSuccess: () => { 
            queryClient.invalidateQueries({ queryKey: ['challenge', activeGameId]}); 
        },
        onError: (error) => { console.error("Score submission failed:", error); }
    });

    const quitMutation = useMutation<void, Error, number | undefined>({
        mutationFn: async (gameIdToQuit) => {
            if (typeof gameIdToQuit !== 'number') { console.error("quitMutation: Invalid gameIdToQuit", gameIdToQuit); throw new Error ("Invalid game ID for quit."); }
            await fetch(`${API_BASE_URL}/games/${gameIdToQuit}/quit`, { method: "POST" });
        },
        networkMode: "always",
        onSuccess: (_data, gameIdQuit) => {
            console.log(`Game ${gameIdQuit} quit successfully.`);
            const currentAuthGameMode = getGameMode();
            if (challengeQuery.data?.completed_challenges === 0) { navigate('/'); }
            else { if (currentAuthGameMode === 'pretest' || currentAuthGameMode === 'posttest') { queryClient.removeQueries({ queryKey: ['challenge', gameIdQuit] }); queryClient.removeQueries({ queryKey: ['game'] }); AuthSetGameMode('training'); navigate('/menu'); } 
            else { navigate(`/games/${gameIdQuit}/results`); } }
        },
        onError: (error, gameIdQuit) => { console.error(`Failed to quit game ${gameIdQuit}:`, error); }
    });

    if (!activeGameId && initialCreationAttemptedRef.current && createGameMutation.isLoading) {
        return <div className="p-4 text-center">Starting new game...</div>;
    }
    if (!activeGameId && initialCreationAttemptedRef.current && createGameMutation.isError) {
        return (
            <div className="p-4 text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Error Starting Game</h1>
                <p className="text-md text-gray-700 mb-4">Details: {createGameMutation.error?.message}</p>
                <button className="mt-2 bg-blue-500 text-white px-4 py-2 rounded" onClick={() => {initialCreationAttemptedRef.current = false; navigate('/menu');}}>Back to Menu & Retry</button>
            </div>
        );
    }
    if (activeGameId && challengeQuery.isLoading) {
        return <div className="p-4 text-center">Loading challenge data for game {activeGameId}...</div>;
    }
    if (activeGameId && challengeQuery.isError) {
        return (
            <div className="p-4 text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Challenge</h1>
                <p className="text-md text-gray-700 mb-4">Details: {challengeQuery.error?.message}</p>
                <button className="mt-2 bg-blue-500 text-white px-4 py-2 rounded" onClick={() => navigate('/menu')}>Back to Menu</button>
            </div>
        );
    }
    if (activeGameId && !challengeQuery.data && !challengeQuery.isLoading && !challengeQuery.isError) {
        return <div className="p-4 text-center">Waiting for first challenge for game {activeGameId}...</div>;
    }
    if (!activeGameId && !initialCreationAttemptedRef.current) {
        console.warn("[GamePage] Invalid state: No activeGameId and creation not attempted. This might indicate an issue with auth or initial URL parsing.");
        return <div className="p-4 text-center">Initializing...</div>;
    }

    if (challengeQuery.data && challengeQuery.data.completed_challenges === challengeQuery.data.total_challenges) {
        const finalAuthGameMode = getGameMode();
        console.log(`[GamePage] Game COMPLETED. Mode prop: ${mode}, Auth gameMode: ${finalAuthGameMode}. Navigating...`);
        if (finalAuthGameMode === 'pretest' || finalAuthGameMode === 'posttest') {
            if (finalAuthGameMode === 'pretest') { AuthSetGameMode('training'); }
            return (<Navigate to={`/menu`}/>);
        } else { 
            return (<Navigate to={`/games/${activeGameId}/results`}/>);
        }
    }
    
    if (!challengeQuery.data?.id) {
        return <div className="p-4 text-center">Loading current challenge details...</div>;
    }

    return (
        <div className="grid md:w-[1000px] md:max-w-[90vw] m-2 md:mx-auto grid-rows-[repeat(4,_min-content)_1fr] grid-cols-1 md:grid-rows-[repeat(3,_min-content)_1fr] md:grid-cols-[1fr_min-content_15rem] gap-2">
            <img src={logo} alt="Logo" className="md:col-span-3 m-auto"/>
            <div className="flex justify-between md:col-span-3">
                <h3 className="text-lg md:text-2xl">
                    Patch {challengeQuery.data.completed_challenges + 1} of {challengeQuery.data.total_challenges}
                </h3>
                <h3 className="text-lg md:text-2xl">User: {displayUsername || 'Player'}</h3>
                <h3 className="text-lg md:text-2xl">Time: {overallTimeString}</h3>
            </div>
            <div>
                <ZoomableImage src={`${API_BASE_URL}/challenges/${challengeQuery.data.id}/core?mode=${getGameMode()}`} className="max-h-[75vh]"/>
            </div>
            <div className="flex md:flex-col justify-between gap-2">
                {[0, 1, 2, 3].map(scoreValue => (
                    <button 
                        key={scoreValue}
                        className="text-white rounded p-2 px-8 grow transition-colors duration-150"
                        style={{
                            backgroundColor: (!buttonsCanBeEnabled || scoreMutation.isLoading) 
                                ? '#9ca3af'
                                : '#3b82f6'
                        }}
                        disabled={!buttonsCanBeEnabled || scoreMutation.isLoading}
                        onClick={() => scoreMutation.mutate(scoreValue)}>
                        {scoreValue}
                    </button>
                ))}
            </div>
            <div className="flex flex-col gap-2 h-full">
                <button className="bg-gray-500 hover:bg-gray-600 text-white rounded p-2 w-full transition-colors duration-150"
                    onClick={() => setShowInstructions(!showInstructions)}>
                    {showInstructions ? 'Hide' : 'Show'} Instructions
                </button>
                {showInstructions && (
                    <p className="mt-2 text-justify text-sm">
                        For each core, indicate its HER2 level using one of the four buttons. There is a minimum wait time of 5 seconds before you can make a selection. When you have identified the last patch, you will have the opportunity to review your mistakes and the correct HER2 level for those patches. You will also see a leaderboard to compare your performance to that of other players.
                    </p>
                )}
                <a href="https://research.seas.ucla.edu/ozcan/" target="_blank" rel="noopener noreferrer" className="mt-auto">
                    <button className="bg-gray-500 hover:bg-gray-600 text-white rounded p-2 w-full whitespace-nowrap transition-colors duration-150">
                        <i className="fa fa-link mr-1"></i>
                        Ozcan Lab
                    </button>
                </a>
                <a href="https://doi.org/10.5858/2010-0454-RAR.1" target="_blank" rel="noopener noreferrer">
                    <button className="bg-gray-500 hover:bg-gray-600 text-white rounded p-2 w-full whitespace-nowrap transition-colors duration-150">
                        <i className="fa fa-link mr-1"></i>
                        More on HER2
                    </button>
                </a>
                <button className="bg-red-500 hover:bg-red-700 text-white rounded p-2 w-full whitespace-nowrap transition-colors duration-150"
                    disabled={quitMutation.isLoading}
                    onClick={() => activeGameId !== null && quitMutation.mutate(activeGameId)}>
                    {quitMutation.isLoading ? 'Quitting...' : 'Quit Game'}
                </button>
            </div>
        </div>
    );
}

export default GamePage;
