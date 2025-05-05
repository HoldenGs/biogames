import { Formik, Form, Field, ErrorMessage, FormikHelpers } from "formik";
import { setUsername, setGameMode } from "./Auth";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./config";
import { useState, useEffect } from "react";

interface PreTestPlayFormValues {
    user_id: string;
    username: string;
}

interface PreTestPlayFormProps {
    mode: string;
    disabled?: boolean;
}

function PreTestPlayForm({ mode }: PreTestPlayFormProps) {
    const navigate = useNavigate();
    
    const initialValues: PreTestPlayFormValues = { 
        user_id: '', // always start blank
        username: ''
    };
    const [localGameMode, setLocalGameMode] = useState<string>(mode);

    const validate = async (values: PreTestPlayFormValues) => {
        const errors: { user_id?: string; username?: string } = {};
        
        if (!values.user_id) {
            errors.user_id = 'Required';
        } else if (values.user_id.length > 32) {
            errors.user_id = 'Must be 32 characters or less';
        }
        
        if (!values.username) {
            errors.username = 'Required';
        } else if (values.username.length > 32) {
            errors.username = 'Must be 32 characters or less';
        }
        
        return errors;
    };

    const submit = async (values: PreTestPlayFormValues, { setSubmitting, setFieldError }: FormikHelpers<PreTestPlayFormValues>) => {
        setSubmitting(true);
        
        try {
            // First validate the user_id
            const validationResponse = await fetch(`${API_BASE_URL}/validate-username/${values.user_id}`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                },
            });
            
            if (validationResponse.status !== 200) {
                setFieldError('user_id', 'Invalid user ID');
                setSubmitting(false);
                return;
            }
            
            // Check if user already has a username
            const usernameCheckResponse = await fetch(`${API_BASE_URL}/check-username/${values.user_id}`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                },
            });
            
            if (usernameCheckResponse.status === 200) {
                const usernameData = await usernameCheckResponse.json();
                if (usernameData.has_username) {
                    // User already has a username, proceed directly to game using their existing username
                    if (usernameData.username) {
                        setUsername(usernameData.username);
                    }
                    setGameMode('pretest');
                    navigate(`/game?mode=pretest`);
                    return;
                }
            }
            
            // Register the username with the user_id using new endpoint
            const registerResponse = await fetch(`${API_BASE_URL}/register-with-username`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                },
                body: JSON.stringify({
                    user_id: values.user_id,
                    username: values.username
                }),
            });
            
            if (registerResponse.status !== 200) {
                setFieldError('username', 'Failed to register username');
                setSubmitting(false);
                return;
            }
            
            const responseData = await registerResponse.json();
            
            // Successfully registered - use the generated user_id from backend
            if (responseData.username) {
                setUsername(responseData.username);
                setGameMode('pretest');
                navigate(`/game?mode=pretest`);
            } else {
                setFieldError('username', 'Missing user ID in response');
                setSubmitting(false);
            }
        } catch (error) {
            console.error('Error in form submission:', error);
            setFieldError('user_id', 'Error processing request');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Formik
            initialValues={initialValues}
            validate={validate}
            onSubmit={submit}
        >
            {({ errors, isSubmitting }) => (
                <Form>
                    <div className="p-3 mb-4 bg-yellow-100 border border-yellow-400 rounded">
                        <h3 className="font-bold">PreTest Play Form Active</h3>
                        <p>Mode: {mode}</p>
                    </div>
                    <div className="mb-4">
                        <label htmlFor="user_id" className="block text-sm font-medium text-gray-700 mb-1">
                            User ID
                        </label>
                        <Field
                            id="user_id"
                            name="user_id"
                            type="text"
                            placeholder="Enter your User ID"
                            className={`border ${errors.user_id ? 'border-danger-500' : 'border-gray-300'} px-2 py-2 w-full rounded-md`}
                        />
                        {errors.user_id && (
                            <div className="text-danger-500 text-sm mt-1">
                                <ErrorMessage name="user_id" />
                            </div>
                        )}
                    </div>
                    
                    <div className="mb-4">
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                            Username
                        </label>
                        <Field
                            id="username"
                            name="username"
                            type="text"
                            placeholder="Choose a username"
                            className={`border ${errors.username ? 'border-danger-500' : 'border-gray-300'} px-2 py-2 w-full rounded-md`}
                        />
                        {errors.username && (
                            <div className="text-danger-500 text-sm mt-1">
                                <ErrorMessage name="username" />
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-6">
                        <button
                            className="bg-primary-500 text-white px-4 py-2 w-full rounded-md"
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Processing...' : 'Start Pre-Test'}
                        </button>
                    </div>
                    
                    <div className="mt-3 text-center text-primary-500 text-sm">
                        You're about to start your pre-test! Please enter your User ID and choose a username.
                    </div>
                </Form>
            )}
        </Formik>
    );
}

export default PreTestPlayForm; 