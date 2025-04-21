import { Formik, Form, Field, ErrorMessage, FormikHelpers } from "formik";
import { setUsername, getUsername, setEmail, getEmail } from "./Auth";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./config";
import { useState } from "react";

interface TestRegisterFormValues {
    email: string;
}

function TestRegisterForm() {
    const initialValues: TestRegisterFormValues = { 
        email: getEmail() ?? 'holdengs@ucla.edu' 
    };
    const [registrationResult, setRegistrationResult] = useState<string>('');
    const navigate = useNavigate();

    const validate = (values: TestRegisterFormValues) => {
        const errors: { email?: string } = {};
        
        if (!values.email) {
            errors.email = 'Required';
        } else if (!values.email.includes('@')) {
            errors.email = 'Invalid email format';
        }
        
        return errors;
    };

    const submit = async (values: TestRegisterFormValues, { setSubmitting, setFieldError }: FormikHelpers<TestRegisterFormValues>) => {
        setSubmitting(true);
        setRegistrationResult('');
        
        try {
            // Register with the email
            const registerResponse = await fetch(`${API_BASE_URL}/generate-user-id`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                },
                body: JSON.stringify({
                    email: values.email
                }),
            });
            
            if (registerResponse.status !== 200) {
                const errorText = await registerResponse.text();
                setFieldError('email', `Failed to register: ${errorText}`);
                setSubmitting(false);
                return;
            }
            
            // Successfully registered
            const responseData = await registerResponse.json();
            setEmail(values.email);
            setUsername(responseData.user_id);
            setRegistrationResult(`Registration successful! Your user ID is: ${responseData.user_id}`);
        } catch (error) {
            console.error('Error in form submission:', error);
            setFieldError('email', 'Error processing request');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="border-2 border-black m-2 mx-auto p-4 w-[600px] max-w-[95vw]">
            <h2 className="text-xl font-bold mb-4">Test Registration</h2>
            <Formik
                initialValues={initialValues}
                validate={validate}
                onSubmit={submit}
            >
                {({ errors, isSubmitting }) => (
                    <Form>
                        <div className="mb-4">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email (for testing)
                            </label>
                            <Field
                                id="email"
                                name="email"
                                type="email"
                                placeholder="Enter your email"
                                className={`border ${errors.email ? 'border-danger-500' : 'border-gray-300'} px-2 py-2 w-full rounded-md`}
                            />
                            {errors.email && (
                                <div className="text-danger-500 text-sm mt-1">
                                    <ErrorMessage name="email" />
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-6">
                            <button
                                className="bg-primary-500 text-white px-4 py-2 w-full rounded-md"
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Processing...' : 'Register for Testing'}
                            </button>
                        </div>
                        
                        {registrationResult && (
                            <div className="mt-4 p-3 bg-green-100 border border-green-400 rounded">
                                {registrationResult}
                            </div>
                        )}
                        
                        <div className="mt-3 text-center text-gray-500 text-sm">
                            This form is for testing the registration process with UCLA emails.
                        </div>
                    </Form>
                )}
            </Formik>
        </div>
    );
}

export default TestRegisterForm; 