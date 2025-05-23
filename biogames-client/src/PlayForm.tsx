import { Formik, Form, Field, ErrorMessage, FormikHelpers } from "formik";
import { setUsername, getUsername, setGameMode, getGameMode, setUserId } from "./Auth";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./config";
import { useState, useEffect } from "react";


interface PlayFormValues {
    user_id: string
}

interface PlayFormProps {
    mode: string;
    disabled?: boolean;
    initialHer2CoreId?: number;
    isInitialChallengeImageReady?: boolean;
}

function PlayForm({ mode, disabled = false, initialHer2CoreId, isInitialChallengeImageReady }: PlayFormProps) {
    const navigate = useNavigate();
    const storedUserId = getUsername(); // may exist but we won't auto-fill
    
    const initialValues: PlayFormValues = { user_id: '' }; // always start blank
    const [localGameMode, setLocalGameMode] = useState<string>(mode);
    
    useEffect(() => {
        // Only verify and override mode for pretest/posttest; keep training as-is
        if (mode === 'training') return;
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
                        return;
                    }
                    
                    // Check if user has a username
                    const usernameCheckResponse = await fetch(`${API_BASE_URL}/check-username/${storedUserId}`, {
                        method: 'GET',
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache',
                        },
                    });
                    
                    if (usernameCheckResponse.status === 200) {
                        const usernameData = await usernameCheckResponse.json();
                        if (!usernameData.has_username) {
                            // User doesn't have a username, should go to pretest
                            setLocalGameMode('pretest');
                            return;
                        }
                        
                        // Use the actual username for checking game type
                        if (usernameData.username) {
                            // Determine game type based on progress
                            const gameTypeResponse = await fetch(`${API_BASE_URL}/check-game-type/${usernameData.username}`, {
                                method: 'GET',
                                headers: {
                                    'Cache-Control': 'no-cache',
                                    'Pragma': 'no-cache',
                                },
                            });
                            
                            if (gameTypeResponse.status === 200) {
                                const json = await gameTypeResponse.json();
                                if (json) {
                                    if (json.pretest == 0) {
                                        setLocalGameMode('pretest');
                                    } else if (json.training < 400) {
                                        setLocalGameMode('training');
                                    } else if (json.posttest == 0) {
                                        setLocalGameMode('posttest');
                                    } else {
                                        setLocalGameMode('finished');
                                    }
                                    if (storedUserId.endsWith('admin')) {
                                        setLocalGameMode('training');
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error verifying user on refresh:', error);
                }
            };
            
            verifyUserAndDetermineMode();
        }
    }, [storedUserId]);

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
                    errors.user_id = 'Invalid User ID';
                    return errors;
                }
                
                // Next check if this user has a username
                const usernameCheckResponse = await fetch(`${API_BASE_URL}/check-username/${values.user_id}`, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                    },
                });
                
                if (usernameCheckResponse.status === 200) {
                    const usernameData = await usernameCheckResponse.json();
                    if (!usernameData.has_username) {
                        // User doesn't have a username, redirect to pretest
                        setLocalGameMode('pretest');
                        return errors;
                    }
                    
                    // Use the actual username for checking game type
                    if (usernameData.username) {
                        // Check game type for users with usernames
                        const gameTypeResponse = await fetch(`${API_BASE_URL}/check-game-type/${usernameData.username}`, {
                            method: 'GET',
                            headers: {
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache',
                            },
                        });
                        
                        if (gameTypeResponse.status === 200) {
                            const json = await gameTypeResponse.json();
                            if (json) {
                                if (json.pretest == 0) {
                                    setLocalGameMode('pretest');
                                } else if (json.training < 400) {
                                    setLocalGameMode('training');
                                } else if (json.posttest == 0) {
                                    setLocalGameMode('posttest');
                                } else {
                                    setLocalGameMode('finished');
                                }
                                if (values.user_id?.endsWith('admin')) {
                                    setLocalGameMode('training');
                                }
                                console.log("Game mode:", localGameMode);
                            } else {
                                console.error('Empty response body');
                            }
                        } else {
                            console.error('Error checking game type:', gameTypeResponse.status);
                            errors.user_id = 'Error checking game type';
                        }
                    }
                }
            } catch (error) {
                console.error('Error validating username:', error);
                errors.user_id = 'Error validating user ID';
            }
        }
        return errors;
    };

    const submit = async (values: PlayFormValues, { setSubmitting }: FormikHelpers<PlayFormValues>) => {
        setSubmitting(true);
            setUserId(values.user_id);
        
        if (localGameMode === 'pretest') {
            // For pretest, username is typically set during the pretest/registration process itself.
            // Navigating to pretest/menu will handle this.
            navigate(`/pretest/menu`, { state: { initialHer2CoreId } });
        } else {
            // For other modes (e.g., training), fetch and set the username associated with the user_id.
            try {
                const usernameCheckResponse = await fetch(`${API_BASE_URL}/check-username/${values.user_id}`, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                    },
                });

                if (usernameCheckResponse.ok) {
                    const usernameData = await usernameCheckResponse.json();
                    if (usernameData.username) {
                        setUsername(usernameData.username); // Set the actual username from the API
                    } else {
                        // Fallback or error: No username found for this user_id.
                        // This might mean the user_id is valid but has no username yet,
                        // which should ideally be caught by validation or handled in a specific way.
                        console.warn(`[PlayForm] submit: No username found for user_id: ${values.user_id}. Display name might default to 'Player'.`);
                        // Optionally, clear any stale username: setUsername(null);
                    }
                } else {
                    const errorText = await usernameCheckResponse.text();
                    console.error(`[PlayForm] submit: Failed to fetch username for user_id: ${values.user_id}. Status: ${usernameCheckResponse.status}, ${errorText}`);
                    // Optionally, clear any stale username: setUsername(null);
                }
            } catch (error) {
                console.error('[PlayForm] submit: Error fetching username:', error);
                // Optionally, clear any stale username: setUsername(null);
            }
            
            // Set the game mode for training, etc.
            // Make sure localGameMode is appropriate here; it's updated by validate/useEffect
            setGameMode(localGameMode); 
            navigate(`/game?mode=${localGameMode}`, { state: { initialHer2CoreId } });
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
                            className={`px-4 py-2 text-white w-[100px] ${disabled || localGameMode === 'finished' || localGameMode === 'posttest' || !isInitialChallengeImageReady
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-primary-500 hover:bg-primary-600'
                            }`}
                            type="submit"
                            disabled={disabled || localGameMode === 'finished' || localGameMode === 'posttest' || !isInitialChallengeImageReady}
                        >
                            {isInitialChallengeImageReady ? 'Play' : 'Loading...'}
                        </button>
                        
                    </div>
                    {
                        disabled ? (
                        <div className="text-danger-500">
                            Screen too small... please use a larger device or resize your window to continue.
                            </div>
                        ) : localGameMode === 'pretest' ? (
                            <div className="text-primary-500">You're about to start your pretest!</div>
                        ) : localGameMode === 'training' ? (
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
