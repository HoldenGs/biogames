import { Formik, Form, Field, ErrorMessage, FormikHelpers } from "formik";
import { setUsername, getUsername, setGameMode } from "./Auth";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./config";
import { useState } from "react";


interface PlayFormValues {
    username: string
}

interface PlayFormProps {
    mode: string;
}

function PlayForm({ mode }: PlayFormProps) {
    const initialValues: PlayFormValues = { username: getUsername() ?? '' };
    const [localGameMode, setLocalGameMode] = useState<string>(mode);
    const navigate = useNavigate();

    const validate = async (values: PlayFormValues) => {
        const errors: { username?: string } = {};
        if (!values.username) {
            errors.username = 'Required';
        } else if (values.username.length > 32) {
            errors.username = 'Must be 32 characters or less';
        } else {
            try {
                setLocalGameMode('training');
                // const response = await fetch(`${API_BASE_URL}/validate-username/${values.username}`, {
                //     method: 'GET',
                //     headers: {
                //         'Cache-Control': 'no-cache',
                //         'Pragma': 'no-cache',
                //     },
                // });
                // if (response.status === 200) {
                //     const gameTypeResponse = await fetch(`${API_BASE_URL}/check-game-type/${values.username}`, {
                //         method: 'GET',
                //         headers: {
                //             'Cache-Control': 'no-cache',
                //             'Pragma': 'no-cache',
                //         },
                //     });
                //     if (gameTypeResponse.status === 200) {
                //         const json = await gameTypeResponse.json();
                //         if (json) {
                //             if (json.pretest == 0) {
                //                 setLocalGameMode('pretest');
                //             } else if (json.training < 5) {
                //                 setLocalGameMode('training');
                //             } else if (json.posttest == 0) {
                //                 setLocalGameMode('posttest');
                //             } else {
                //                 setLocalGameMode('finished');
                //             }
                //             if (getUsername()?.endsWith('admin')) {
                //                 setLocalGameMode('training');
                //             }
                //             console.log("Game mode:", localGameMode);
                //         } else {
                //             console.error('Empty response body');
                //         }
                //     } else {
                //         console.error('Error checking game type:', gameTypeResponse.status);
                //         errors.username = 'Error checking game type';
                //     }
                // } else {
                //     console.error('Error validating username:', response.status);
                //     errors.username = 'Invalid username';
                // }
            } catch (error) {
                console.error('Error validating username:', error);
                errors.username = 'Error validating username';
            }
        }
        return errors;
    };

    const submit = (values: PlayFormValues, { setSubmitting }: FormikHelpers<PlayFormValues>) => {
        setSubmitting(true);
        setUsername(values.username);
        setGameMode(localGameMode);
        navigate(`/game?mode=${localGameMode}`);
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
                    <div className="flex justify-between gap-2 mb-1">
                        <Field
                            name="username"
                            type="text"
                            placeholder="Username"
                            className={`border ${errors.username && 'border-danger-500'} px-2 w-full`}
                        />
                        <button
                            className="bg-primary-500 text-white px-4 py-2"
                            type="submit"
                            disabled={localGameMode === 'finished' || localGameMode === 'posttest'}
                        >
                            Play
                        </button>
                    </div>
                    {
                        localGameMode === 'pretest' && (
                            <div className="text-primary-500">You're about to start your pretest!</div>
                        )
                    }
                    {
                        localGameMode === 'training' && (
                            <div className="text-primary-500">You're about to start a training run!</div>
                        )
                    }
                    {localGameMode === 'posttest' && (
                        <div className="text-danger-500">You've completed all 5 training runs!</div>
                    )}
                    {errors.username && (
                        <ul className="text-danger-500 text-left list-disc list-inside">
                            <li>
                                <ErrorMessage name="username" />
                            </li>
                        </ul>
                    )}
                </Form>
            )}
        </Formik>
    );
}

export default PlayForm;
