import { Formik, Form, Field, ErrorMessage, FormikHelpers } from "formik";
import { setUsername, getUsername, setGameMode, getGameMode, setUserId, getUserId } from "./Auth";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./config";
import { useState, useEffect, useRef } from "react";


interface PlayFormValues {
    user_id: string
}

interface PlayFormProps {
    mode: string;
    disabled?: boolean;
    initialHer2CoreId?: number;
    isInitialChallengeImageReady?: boolean;
}

type Progress = { pretest: number; training: number; posttest: number };

function resolveLocalMode(pageMode: string, p: Progress, isAdmin: boolean) {
    if (isAdmin) return "training";
    if (p.pretest === 0) return "pretest";

    const hasAtLeastOneTraining = p.training >= 1;

    if (pageMode === "posttest") {
        if (!hasAtLeastOneTraining) return "training";
        if (p.posttest === 0) return "posttest";
        return "finished";
    }    

    if (pageMode === "training") {
        return "training";
    }

    if (!hasAtLeastOneTraining) return "training";
    if (p.posttest === 0) return "posttest";
    return "finished";
}

function PlayForm({ mode, disabled = false, initialHer2CoreId, isInitialChallengeImageReady }: PlayFormProps) {
    const navigate = useNavigate();
    const storedUserId = getUserId(); // may exist but we won't auto-fill

    const initialValues: PlayFormValues = { user_id: '' }; // always start blank
    const [localGameMode, setLocalGameMode] = useState<string>(mode);
    const [error, setError] = useState<string>("");
    const [hasValidUser, setHasValidUser] = useState(false);

    const resolvedModeRef = useRef<string>(mode);
    const canPlay = !disabled && isInitialChallengeImageReady && localGameMode !== "finished" &&
    (
        (mode === "pretest" && localGameMode === "pretest") ||
        (mode === "training" && localGameMode === "training") ||
        (mode === "posttest" && localGameMode === "posttest")
    );


    useEffect(() => {
        if (!storedUserId) {
            resolvedModeRef.current = "inactive";
            setLocalGameMode("inactive");
            setHasValidUser(false);
            setGameMode("inactive");
        }
    }, [storedUserId]);

    useEffect(() => {
        // Only verify and override mode for pretest/posttest; keep training as-is
        //if (mode === 'training') return;
        // Handle persistence when page is refreshed
        if (storedUserId) {
            const verifyUserAndDetermineMode = async () => {
                try {
                    // First check if this is a valid user_id
                    const validationResponse = await fetch(`${API_BASE_URL}/validate-username/${storedUserId}`, {
                        method: 'GET',
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache',
                        },
                    });

                    if (validationResponse.status !== 200) {
                        // Invalid user ID, clear session storage
                        console.log("Invalid user ID on refresh");
                        setHasValidUser(false);
                        resolvedModeRef.current = "inactive";
                        setLocalGameMode("inactive");
                        setGameMode("inactive");
                        return;
                    }

                    // Else, valid
                    setHasValidUser(true);

                    // Determine game type based on progress
                    const gameTypeResponse = await fetch(`${API_BASE_URL}/check-game-type/${storedUserId}`, {
                        method: 'GET',
                        headers: {
                            'Cache-Control': 'no-cache',
                            Pragma: 'no-cache',
                        },
                    });

                    if (gameTypeResponse.status === 200) {
                        const json = await gameTypeResponse.json();
                        if (json) {
                            const isAdmin = storedUserId.endsWith("admin");
                            const resolved = resolveLocalMode(mode, json, isAdmin);
                            resolvedModeRef.current = resolved;
                            setLocalGameMode(resolved);
                        }
                    }
                } catch (error) {
                    let err: string = `Error verifying user on refresh: ${error}`;
                    console.error(err);
                    setError(err);
                }
            };

            verifyUserAndDetermineMode();
        }
    }, [storedUserId, mode]);

    const validate = async (values: PlayFormValues) => {
        const errors: { user_id?: string } = {};
        if (!values.user_id) {
            errors.user_id = 'Required';
        } else if (values.user_id.length > 32) {
            errors.user_id = 'Must be 32 characters or less';
        } else {
            try {
                // First check if this is a valid user_id
                let url = mode === 'training'
                        ? `${API_BASE_URL}/validate-username/${values.user_id}?context=training`
                        : `${API_BASE_URL}/validate-username/${values.user_id}`;

                const validationResponse = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                    },
                });

                if (validationResponse.status !== 200) {
                    console.log("No user with this user_id found!!!");
                    errors.user_id = 'Invalid User ID';
                    return errors;
                }

                const gameTypeResponse = await fetch(`${API_BASE_URL}/check-game-type/${values.user_id}`, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                    },
                });

                if (gameTypeResponse.status === 200) {
                    const json = await gameTypeResponse.json();
                    if (json) {
                        const isAdmin = values.user_id?.endsWith("admin") ?? false;
                        const resolved = resolveLocalMode(mode, json, isAdmin);
                        resolvedModeRef.current = resolved;
                        setLocalGameMode(resolved);
                        console.log('Resolved mode:', resolved);
                    } else {
                        console.error('Empty response body');
                    }
                } else {
                    let err: string = `Error verifying user on refresh: ${error}`;
                    console.error(err);
                    setError(err);
                }
            } catch (error) {
                console.error('Error validating username:', error);
                let err: string = `Error verifying user on refresh: ${error}`;
                console.error(err);
                setError(err);
            }
        }
        return errors;
    };

    const submit = async (values: PlayFormValues, { setSubmitting }: FormikHelpers<PlayFormValues>) => {
        setSubmitting(true);

        if (error == "") {
            setUserId(values.user_id);

            const resolved = resolvedModeRef.current;
            setGameMode(resolved);
            navigate(`/game?mode=${resolved}`, { state: { initialHer2CoreId } });
        } else {
            console.log("error validating user");
        }
        setSubmitting(false);
    };


    return (
        <Formik 
            initialValues={initialValues} 
            validate={validate} 
            onSubmit={submit}
        >
            {({ errors, isSubmitting }) => (
                <Form>
                    <div className="p-3 mb-4 bg-blue-100 border border-blue-400 rounded">
                        <h3 className="font-bold">Play Form Active</h3>
                        <p>Mode: {mode}, Local Mode: {localGameMode}</p>
                    </div>
                    <div className="flex justify-between gap-2 mb-1">
                        <Field
                            name="user_id"
                            type="text"
                            placeholder="User ID"
                            className={`border ${errors.user_id && 'border-danger-500'} px-2 w-full`}
                        />
                        <button
                            className={`px-4 py-2 text-white w-[100px] ${
                                !canPlay ? "bg-gray-400 cursor-not-allowed" : "bg-primary-500 hover:bg-primary-600"
                            }`}
                            type="submit"
                            disabled={!canPlay}
                            >
                            {isInitialChallengeImageReady ? "Play" : "Loading..."}
                        </button>
                    </div>
                    {
                        disabled ? (
                            <div className="text-danger-500">
                                Screen too small... please use a larger device or resize your window to continue.
                            </div>
                        ) : mode === 'training' && localGameMode === 'pretest'?
                        (
                            <div className="text-danger-500">You can't train until you’ve completed your pretest.</div>
                        ) : mode === 'posttest' && localGameMode === 'pretest'?
                        (
                            <div className="text-danger-500">You can't take the posttest until you’ve completed your pretest.</div>
                        ) : localGameMode === 'pretest' ? (
                            <div className="text-primary-500">You're about to start your pretest!</div>
                        ) : localGameMode === 'training' && canPlay ? (
                            <div className="text-primary-500">You're about to start a training run!</div>
                        ) : null
                    }

                    {localGameMode === 'posttest' && mode !== 'posttest' && (
                        <div className="text-danger-500">You've completed all training runs!</div>
                    )}
                    {errors.user_id && (
                        <ul className="text-danger-500 text-left list-disc list-inside">
                            <li>
                                <ErrorMessage name="user_id" />
                            </li>
                        </ul>
                    )}
                </Form>
            )}
        </Formik>
    );
}

export default PlayForm;
