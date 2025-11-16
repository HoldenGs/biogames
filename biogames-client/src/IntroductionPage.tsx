import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from './config';
import { setUserId, setEmail as setEmailInStorage } from './Auth';
import logo from './assets/logo3.webp';

function IntroductionPage() {
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const emailIsValid = emailInput.endsWith('@mednet.ucla.edu') || emailInput.endsWith('@ucla.edu') || emailInput.endsWith('@mail.huji.ac.il');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate email format client-side
    if (!emailInput.endsWith('@mednet.ucla.edu') && !emailInput.endsWith('@ucla.edu') && !emailInput.endsWith('@mail.huji.ac.il')) {
      setError('Please enter a valid @mednet.ucla.edu, @ucla.edu, or @mail.huji.ac.il email address');
      setLoading(false);
      return;
    }

    try {
      console.log(emailInput);
      const response = await fetch(`${API_BASE_URL}/generate-user-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailInput }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log(response);
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to register');
      }

      if (!data.success) {
        setError(data.message || "registration failed");
        setLoading(false);
        return;
      }

      setUserId(data.user_id);
      setEmailInStorage(emailInput);
      setSuccess(true);
      setTimeout(() => {
        navigate('/pretest/menu');
      }, 5000);
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <img src={logo} alt="BioGames Logo" className="w-[500px] h-auto mb-8" />
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-xl text-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-700">Welcome to BioGames!</h1>
        
        {!success ? (
          <>
            <p className="mb-4 text-gray-600">
              This study is for <strong>educational and research purposes</strong>. By participating, you will play a series of games designed to test and improve your ability to identify HER2 expression levels in tumor images, a critical skill in cancer diagnosis and treatment planning. Your performance will help us understand how effective our game-based learning platform is.
            </p>
            <p className="mb-4 text-gray-600">
              All data collected will be <strong>anonymized and used solely for research</strong>. Your privacy is important to us. You can withdraw from the study at any time.
            </p>
            <p className="mb-6 text-gray-600">
              To begin, please enter your <strong>@mednet.ucla.edu</strong>, <strong>@ucla.edu</strong>, or <strong>@mail.huji.ac.il</strong> email address below. We will email you a unique User ID that you will need to use throughout the study.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
              <input
                type="email"
                id="email"
                  value={emailInput} 
                  onChange={(e) => setEmailInput(e.target.value)} 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="your_email@example.edu"
                required
              />
            </div>
            <div className="flex items-center">
            <input
                  id="agree"
                  name="agree"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
                <label htmlFor="agree" className="ml-2 block text-sm text-gray-900">
                  I have read the information above and agree to participate in the study.
            </label>
            </div>
            <button
              type="submit"
                disabled={loading || !agreed || !emailIsValid}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
            >
                {loading ? 'Registering...' : 'Register and Get User ID'}
            </button>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </form>
          </>
        ) : (
          <div className="text-center">
            <p className="text-xl font-semibold text-green-600 mb-4">Registration Successful!</p>
            <p className="text-gray-700 mb-2">Your unique User ID has been emailed to you.</p>
            <p className="text-gray-700 mb-6">Please check your email and save your User ID. You will need it to log in and play.</p>
            <p className="text-gray-700">You will be redirected to the Pre-Test Menu shortly...</p>
        </div>
      )}

        <hr className="my-6" />

        <h2 className="text-xl font-bold mb-3 text-gray-700">Study Information & Consent</h2>
        <p className="mb-2 text-gray-600">
          <strong>Study Title:</strong> BioGames - A Game-Based Learning Platform for HER2 Scoring
        </p>
        <p className="mb-2 text-gray-600">
          <strong>Principal Investigator:</strong> Dr. Aydogan Ozcan, Chancellor’s Professor at the Samueli School of Elecrical Engineering, Bioengineering; HHMI Professor at the Howard Hughes Medical Institute; Associate Director of the California NanoSystems Institute (CNSI), UCLA.
        </p>
        <p className="mb-2 text-gray-600">
          <strong>Purpose of the Study:</strong> To evaluate the effectiveness of a game-based learning platform in teaching HER2 scoring for breast cancer pathology.
        </p>
        <p className="mb-2 text-gray-600">
          <strong>Procedures:</strong> Participants will register using their MEDNET email, receive a User ID, and then complete a pre-test, a series of training games, and a post-test. Each part involves viewing breast tumor images and scoring HER2 expression.
        </p>
        <p className="mb-2 text-gray-600">
          <strong>Confidentiality:</strong> Your email will only be used to send you your User ID. All gameplay data will be associated with this anonymized User ID. Published results will not contain any personally identifiable information.
        </p>
        <p className="mb-2 text-gray-600">
          <strong>Voluntary Participation:</strong> Your participation is entirely voluntary. You may withdraw at any time without penalty.
        </p>
        <p className="mb-2 text-gray-600">
          <strong>Contact Information:</strong> If you have any questions about the study, please contact Paloma Casteleiro Costa at <a href="mailto:casteleiro@ucla.edu" className="text-primary-500 hover:underline">casteleiro@ucla.edu</a>.
        </p>
         <p className="mb-2 text-gray-600">
          <strong>IRB Approval:</strong> This study has been reviewed and approved by the UCLA Institutional Review Board (IRB-24-5794).
        </p>
      </div>
    </div>
  );
}

export default IntroductionPage; 