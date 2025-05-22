import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Game from "./Game";
// Ensure this interface matches the backend and is used by useQuery
interface CurrentChallengeResponse {
    id?: number;         // Challenge ID from challenges table
    core_id?: number;    // core_id from her2_cores table, linked to the challenge
    completed_challenges: number;
    total_challenges: number;
}
// Remove the old import if it's defined elsewhere and causing conflicts
// import CurrentChallengeResponse from "./CurrentChallengeResponse"; // Might be this line if it's a separate file import
import logo from './assets/logo3.webp';
import { Navigate, useNavigate, useParams, useLocation } from "react-router-dom";
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
    const location = useLocation();
    const { gameId: gameIdFromUrl, challengeId: challengeIdFromUrl } = useParams<{ gameId?: string, challengeId?: string }>();

    const initialHer2CoreIdFromState = location.state?.initialHer2CoreId as number | undefined;
    const currentGameMode = getGameMode(); // Get game mode once per render

    console.log(`[GamePage] TOP RENDER. Mode prop: ${mode}, gameIdFromUrl: ${gameIdFromUrl}, challengeIdFromUrl: ${challengeIdFromUrl}, Auth gameMode: ${currentGameMode}, initialHer2CoreIdFromState: ${initialHer2CoreIdFromState}`);

    const [activeGameId, setActiveGameId] = useState<number | null>(null);
    const initialCreationAttemptedRef = useRef(false);
    const authUserId = getUserId();

    const [_unusedForceRender, forceRender] = useState(0); // Keep for now, or remove if setGameCreationError is sufficient
    const [gameCreationError, setGameCreationError] = useState<Error | null>(null);

    const [gameStartTime, __] = useState(new Date());
    const [buttonsCanBeEnabled, setButtonsCanBeEnabled] = useState(false);
    const [overallTimeString, setOverallTimeString] = useState("");
    const [showInstructions, setShowInstructions] = useState(false);

    const displayUsername = getUsername();

    const challengeQuery = useQuery<CurrentChallengeResponse, Error>({
        queryKey: ['challenge', activeGameId],
        queryFn: async () => {
            if (!activeGameId) throw new Error("activeGameId is null, cannot fetch challenge.");
            console.log(`[GamePage] challengeQuery START. Mode prop: ${mode}, Auth gameMode: ${currentGameMode}. Fetching for activeGameId: ${activeGameId}`);
            const url = `${API_BASE_URL}/games/${activeGameId}/challenge`;
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[GamePage] challengeQuery fetch for game ${activeGameId} failed:`, response.status, errorText);
                let specificError = `Challenge fetch failed: ${response.status} ${errorText}`;
                if (response.status === 404) specificError = `No challenge data found for game ${activeGameId} (404).`;
                throw new Error(specificError);
            }
            const data: CurrentChallengeResponse = await response.json(); // Ensure data is typed here
            console.log(`[GamePage] challengeQuery SUCCESS. Mode: ${mode}, Auth GameMode: ${currentGameMode}. Fetched data:`, JSON.parse(JSON.stringify(data)));
            console.log(`[GamePage] challengeQuery SUCCESS. Challenge ID from API: ${data?.id}, Core ID from API: ${data?.core_id}`);
            if (data.id && (String(data.id) !== challengeIdFromUrl || !challengeIdFromUrl)) {
                const challengePath = mode === 'training' ? `/game/${activeGameId}/${data.id}` : `/${mode}/game/${activeGameId}/${data.id}`;
                console.log(`[GamePage] challengeQuery - Navigating to update challengeId. Mode: ${mode}. Target: ${challengePath}. Will pass initialHer2CoreIdFromState: ${initialHer2CoreIdFromState}`);
                navigate(challengePath, { replace: true, state: { initialHer2CoreId: initialHer2CoreIdFromState } });
            }
            return data;
        },
        enabled: !!activeGameId && !!authUserId,
        keepPreviousData: false,
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5,
        onError: (err: Error) => {
            console.error(`[GamePage] challengeQuery FAILED. Mode: ${mode}, Auth GameMode: ${currentGameMode}. Error:`, err.message);
        }
    });

    // Moved useEffect for handling the ping to set 'started_at' here, before any conditional returns.
    useEffect(() => {
        const currentChallengeObjectEffect = challengeQuery.data; // Use data from query within effect
        const currentChallengeIdEffect = currentChallengeObjectEffect?.id;
        const currentChallengeCoreIdEffect = currentChallengeObjectEffect?.core_id;

        const shouldPing = initialHer2CoreIdFromState &&
                           currentChallengeIdEffect &&
                           currentChallengeCoreIdEffect &&
                           currentChallengeCoreIdEffect === initialHer2CoreIdFromState &&
                           currentChallengeObjectEffect?.completed_challenges === 0;

        if (shouldPing) {
            const standardChallengeUrl = `${API_BASE_URL}/challenges/${currentChallengeIdEffect}/core?mode=${currentGameMode}`;
            console.log(`[GamePage] Ping UseEffect: Pinging standard challenge URL ${standardChallengeUrl} to ensure 'started_at' is set.`);
            fetch(standardChallengeUrl)
                .then(response => {
                    if (!response.ok) {
                        console.error(`[GamePage] Ping UseEffect: Ping to ${standardChallengeUrl} FAILED: ${response.status}, ${response.statusText}`);
                    } else {
                        console.log(`[GamePage] Ping UseEffect: Ping to ${standardChallengeUrl} was successful.`);
                    }
                })
                .catch(error => {
                    console.error(`[GamePage] Ping UseEffect: Ping to ${standardChallengeUrl} encountered a network error:`, error);
                });
        }
    }, [challengeQuery.data, initialHer2CoreIdFromState, currentGameMode, API_BASE_URL]);

    if (!authUserId) {
        console.error("[GamePage] No authUserId found. Navigating to home.");
        return <Navigate to="/" replace />;
    }

    const createGameAsync = async (): Promise<Game> => {
        if (!authUserId) throw new Error("User ID not found, cannot create game.");
        
        const requestBody: { user_id: string; initial_her2_core_id?: number } = {
            user_id: authUserId
        };

        if (initialHer2CoreIdFromState) {
            requestBody.initial_her2_core_id = initialHer2CoreIdFromState;
        }

        console.debug(`[GamePage] createGameAsync() called: mode=${mode}, body:`, JSON.stringify(requestBody));
        const url = `${API_BASE_URL}/games?mode=${mode}` + (mode === 'pretest' ? '&num_challenges=50' : '');
        let res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        if (res.status === 400) {
            let errorResponseJson: any = {};
            try { errorResponseJson = await res.clone().json(); console.log(`[GamePage] createGameAsync 400 JSON response:`, errorResponseJson); }
            catch (e) { try { const rawErrorText = await res.text(); errorResponseJson.message = rawErrorText || "Failed to create game (400)."; } catch { errorResponseJson.message = "Failed to create game (400) and read body.";}}
            const openGameId = errorResponseJson?.existing_game_id;
            if (openGameId && typeof openGameId === 'number') {
                console.log(`[GamePage] Existing game ${openGameId} found due to 400. Attempting to quit it.`);
                const quitRes = await fetch(`${API_BASE_URL}/games/${openGameId}/quit`, { method: 'POST' });
                console.log(`[GamePage] Quit attempt for game ${openGameId} status: ${quitRes.status}`);
                if (!quitRes.ok) {
                    const quitErrorText = await quitRes.text(); 
                    const quitFailErrorMsg = `Failed to quit existing game ${openGameId}: ${quitRes.status} ${quitErrorText}. You may have reused an existing User ID`;
                    console.error(`[GamePage] ${quitFailErrorMsg}`);
                    throw new Error(quitFailErrorMsg);
                } else {
                    console.log(`[GamePage] Successfully quit existing game ${openGameId}.`);
                    console.log("[GamePage] Retrying game creation after successfully quitting existing one.");
                    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
                }
            } else { 
                console.warn("[GamePage] 400 during game creation, no existing_game_id found to quit, or it was not a number.", errorResponseJson);
                const originalErrorMsg = errorResponseJson.message || `Failed to create game (${res.status}). No existing game ID found to attempt quit.`;
                throw new Error(originalErrorMsg);
            }
        }
        if (!res.ok) {
            let errorText = "Unknown error."; try { const ed = await res.json(); errorText = ed.message || ed.error || JSON.stringify(ed); } catch { try { errorText = await res.text(); } catch {errorText = `Server ${res.status}`;}}
            console.error(`[GamePage] createGameAsync FAILED: ${errorText}`); throw new Error(errorText);
        }
        return res.json();
    };

    const createGameMutation = useMutation<Game, Error, void>(createGameAsync, {
        onSuccess: (newGameData) => {
            console.log(`[GamePage] createGameMutation SUCCESS. Mode: ${mode}, Auth GameMode: ${currentGameMode}. New game ID: ${newGameData.id}.`);
            setGameCreationError(null); // Clear our specific error state
            const gamePath = mode === 'training' ? `/game/${newGameData.id}` : `/${mode}/game/${newGameData.id}`;
            console.log(`[GamePage] Navigating to: ${gamePath}. Will pass initialHer2CoreIdFromState: ${initialHer2CoreIdFromState}`);
            setActiveGameId(newGameData.id);
            navigate(gamePath, { replace: true, state: { initialHer2CoreId: initialHer2CoreIdFromState } });
        },
        onError: (error) => {
            console.error(`[GamePage] createGameMutation FAILED. Mode: ${mode}, Auth GameMode: ${currentGameMode}. Error:`, error.message);
            setGameCreationError(error); // Use React state to signal the error
            // forceRender(r => r + 1); // This might no longer be needed if setGameCreationError reliably re-renders
        }
    });

    // Diagnostic useEffect to monitor mutation state changes directly
    useEffect(() => {
        console.log("[GamePage] Diagnostic: createGameMutation state changed. isLoading:", createGameMutation.isLoading, "isError:", createGameMutation.isError, "error:", createGameMutation.error?.message);
    }, [createGameMutation.isLoading, createGameMutation.isError, createGameMutation.error]);

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
            if (authUserId && !initialCreationAttemptedRef.current) { 
                 console.log("[GamePage] No gameId in URL & creation not yet attempted. Triggering game creation.");
                 initialCreationAttemptedRef.current = true;
                 createGameMutation.mutate();
            } else if (!authUserId) {
                console.log("[GamePage] No gameId in URL, but no authUserId. Cannot create game.");
            } else if (initialCreationAttemptedRef.current && !createGameMutation.isLoading) {
                 console.log("[GamePage] No gameId in URL, creation was already attempted or in progress. Mutation not loading (could be success/error/idle after reset/nav). Relevant for subsequent renders after initial attempt.");
            } else if (createGameMutation.isLoading) {
                 console.log("[GamePage] No gameId in URL, but game creation mutation is already loading. Relevant for subsequent renders after initial attempt.");
            }
        }
    }, [gameIdFromUrl, authUserId, mode]);

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
            // setOverallTimeString(builder.join("")); // <<<< TEMPORARILY COMMENT THIS OUT FOR TESTING
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
            const clientSubmitTime = new Date().toISOString();
            console.log(`[GamePage] scoreMutation: Submitting guess for challenge ${challengeQuery.data.id} at client time: ${clientSubmitTime}`);
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

    // Handle initial game creation lifecycle if no activeGameId yet
    if (!activeGameId) {
        if (initialCreationAttemptedRef.current) {
            // An attempt to create a game was made
            console.log("[GamePage] Render check for !activeGameId & initialCreationAttemptedRef: isLoading=", createGameMutation.isLoading, "isError=", createGameMutation.isError, "gameCreationError=", gameCreationError?.message);
            
            // PRIORITIZE OUR LOCAL REACT STATE FOR ERROR DISPLAY
            if (gameCreationError) { // Check our local React error state first
                const fullErrorMessage = gameCreationError.message;
                let mainMessage = fullErrorMessage;
                let detailMessage = "";

                const splitMarker = "You may have reused an existing User ID";
                const suggestionMarker = "You may have completed the pre-test."; // Added for another common case

                if (fullErrorMessage.includes(splitMarker)) {
                    const parts = fullErrorMessage.split(splitMarker);
                    detailMessage = parts[0].trim(); // Technical details before the marker
                    mainMessage = splitMarker; // The marker itself as the main message
                    if (parts.length > 1 && parts[1].trim() !== "") {
                        // If there's text after the marker, append it to details or handle as needed
                        detailMessage += ` ${parts[1].trim()}`;
                    }
                } else if (fullErrorMessage.includes(suggestionMarker)) {
                    const parts = fullErrorMessage.split(suggestionMarker);
                    detailMessage = parts[0].trim();
                    mainMessage = suggestionMarker;
                    if (parts.length > 1 && parts[1].trim() !== "") {
                        detailMessage += ` ${parts[1].trim()}`;
                    }
                }

                return (
                    <div className="p-4 text-center">
                        <h1 className="text-2xl font-bold text-red-600 mb-2">Error Starting Game</h1>
                        <p className="text-lg text-red-700 mb-1">{mainMessage}</p>
                        {detailMessage && (
                            <p className="text-sm text-gray-600 mb-4">(Details: {detailMessage})</p>
                        )}
                        <button 
                            className="mt-2 bg-blue-500 text-white px-4 py-2 rounded opacity-100"
                            onClick={() => {
                                initialCreationAttemptedRef.current = false;
                                setGameCreationError(null); // Clear our local error state
                                // createGameMutation.reset(); // Consider if React Query's reset is needed
                                navigate('/menu');
                            }}
                        >
                            Back to Menu & Retry
                        </button>
                    </div>
                );
            }
            // If no local error state, then check React Query's isLoading state
            if (createGameMutation.isLoading) { 
                return <div className="p-4 text-center">Starting new game...</div>;
            }
            
            // If an attempt was made, not erroring (local), not loading (RQ), but no activeGameId yet.
            // This implies the mutation might still be in RQ's isError state if gameCreationError was somehow cleared prematurely,
            // or it's a true anomaly if both RQ isError is false and gameCreationError is null.
            if (createGameMutation.isError) {
                 console.warn("[GamePage] Anomaly/Fallback: RQ isError is true, but local gameCreationError was not set. Displaying RQ error.");
                 return (
                    <div className="p-4 text-center">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">Error Starting Game (RQ)</h1>
                        <p className="text-md text-gray-700 mb-4">Details: {createGameMutation.error?.message}</p>
                        <button className="mt-2 bg-blue-500 text-white px-4 py-2 rounded" onClick={() => { initialCreationAttemptedRef.current = false; navigate('/menu'); }}>Back to Menu & Retry</button>
                    </div>
                );
            }

            console.warn("[GamePage] Anomaly: Game creation attempt made, not in local error, not RQ loading, not RQ error, but no activeGameId. Review mutation onSuccess/onError logic.");
            return <div className="p-4 text-center">Processing game setup... Please wait a moment.</div>;
        } else {
            // No attempt made yet by the useEffect, show initializing. useEffect will trigger the mutation.
            return <div className="p-4 text-center">Initializing Game Page...</div>;
        }
    }

    // At this point, activeGameId is guaranteed to be truthy.
    // Handle challenge loading states for the active game.
    if (challengeQuery.isLoading) {
        return <div className="p-4 text-center">Loading challenge data for game {activeGameId}...</div>;
    }

    if (challengeQuery.isError) {
        return (
            <div className="p-4 text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Challenge</h1>
                <p className="text-md text-gray-700 mb-4">Details: {challengeQuery.error?.message}</p>
                <button className="mt-2 bg-blue-500 text-white px-4 py-2 rounded" onClick={() => navigate('/menu')}>Back to Menu</button>
            </div>
        );
    }

    // If challenge query is not loading, not error, but no data yet (e.g., 404 or empty response treated as non-error)
    if (!challengeQuery.data) {
        return <div className="p-4 text-center">Waiting for challenge data for game {activeGameId}... This may take a moment.</div>;
    }

    // Challenge data IS available. Check for game completion.
    if (challengeQuery.data.completed_challenges === challengeQuery.data.total_challenges) {
        const finalAuthGameMode = getGameMode();
        console.log(`[GamePage] Game COMPLETED. Mode prop: ${mode}, Auth gameMode: ${finalAuthGameMode}. Navigating...`);
        if (finalAuthGameMode === 'pretest' || finalAuthGameMode === 'posttest') {
            if (finalAuthGameMode === 'pretest') { AuthSetGameMode('training'); }
            return (<Navigate to={`/menu`}/>);
        }
        return (<Navigate to={`/games/${activeGameId}/results`}/>);
    }

    // Game is not completed, challenge data is available. Check for critical challenge ID for image display.
    if (!challengeQuery.data.id) {
        // This implies data is present but missing the essential 'id' field for the challenge.
        console.error("[GamePage] Anomaly: Challenge data is present but missing 'id'.", challengeQuery.data);
        return <div className="p-4 text-center">Error: Current challenge details are incomplete.</div>;
    }

    // All checks passed, proceed to render the main game UI.
    console.log("[GamePage] challengeQuery.data for URL decision:", JSON.parse(JSON.stringify(challengeQuery.data)));

    // Conditionally construct imageUrlToDisplay
    let imageUrlToDisplay: string = ''; // Default to empty or a placeholder
    const currentChallengeObject = challengeQuery.data;
    const currentChallengeId = currentChallengeObject?.id;
    const currentChallengeCoreId = currentChallengeObject?.core_id;

    // Log the critical values before the decision
    console.log(`[GamePage] Values for image URL decision: initialHer2CoreIdFromState = ${initialHer2CoreIdFromState}, currentChallengeId = ${currentChallengeId}, currentChallengeCoreId = ${currentChallengeCoreId}, completed_challenges = ${currentChallengeObject?.completed_challenges}`);

    if (currentChallengeId) {
        // Default to standard URL that sets started_at
        imageUrlToDisplay = `${API_BASE_URL}/challenges/${currentChallengeId}/core?mode=${currentGameMode}`;
        console.log(`[GamePage] Defaulting imageUrlToDisplay to STANDARD: ${imageUrlToDisplay} (Challenge ID: ${currentChallengeId})`);

        // If it's the very first challenge and we have a matching initialHer2CoreIdFromState,
        // we can use the potentially cached preview URL for display.
        // The ping to set 'started_at' is now handled by the useEffect below.
        if (initialHer2CoreIdFromState &&
            currentChallengeCoreId &&
            currentChallengeCoreId === initialHer2CoreIdFromState &&
            currentChallengeObject.completed_challenges === 0 // Make sure it's the first challenge
        ) {
            imageUrlToDisplay = `${API_BASE_URL}/api/her2_core_images/${initialHer2CoreIdFromState}`;
            console.log(`[GamePage] Using PREVIEWED image URL for display (Core ID: ${initialHer2CoreIdFromState}): ${imageUrlToDisplay}`);
        }
    } else {
        console.log("[GamePage] No current challenge ID or core ID available to determine image URL.");
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
                {imageUrlToDisplay ? (
                    <ZoomableImage src={imageUrlToDisplay} className="max-h-[75vh]"/>
                ) : (
                    <div className="max-h-[75vh] flex items-center justify-center bg-gray-200">
                        <p>Loading image...</p>
                    </div>
                )}
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
                <a href="https://research.seas.ucla.edu/ozcan/" target="_blank" rel="noopener noreferrer" className="">
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
