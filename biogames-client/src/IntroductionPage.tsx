import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from './config';
import { setUsername } from './Auth';
import logo from './assets/logo3.webp';

function IntroductionPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate email format client-side
    if (!email.endsWith('@ucla.edu') && !email.endsWith('@mednet.ucla.edu')) {
      setError('Please enter a valid @ucla.edu or @mednet.ucla.edu email address');
      setLoading(false);
      return;
    }

    try {
      console.log(email);
      const response = await fetch(`${API_BASE_URL}/generate-user-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        console.log(response);
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to register');
      }

      // Parse generated user ID and store it for authentication
      const data = await response.json();
      setUsername(data.user_id);
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
    <div className="border-2 border-black m-2 mx-auto p-4 w-[1000px] max-w-[95vw]">
      <img src={logo} alt="Logo" className="mb-6 max-w-[500px] h-auto mx-auto"/>
      <div>  </div>
      <h1 className="text-3xl font-bold mb-6 flex justify-center">Introduction</h1>
      
      {/* Study information sheet */}
      <div className="bg-white rounded-lg shadow p-6 mb-8 space-y-4 max-h-[60vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-center mb-6">University of California, Los Angeles</h2>
        <h3 className="text-xl font-semibold">Study Information Sheet</h3>
        <h3 className="text-lg font-semibold">Evaluating the BioGames Platform as a Competitive Learning Tool for Training Diagnostic Accuracy in Breast Tissue Scoring</h3>

        <h4 className="font-semibold">INTRODUCTION</h4>
        <p>Principle Investigator, Brian Qinyu Cheng, and Faculty Sponsor, Dr. Aydogan Ozcan, from the Department of Electrical Engineering at the University of California, Los Angeles are conducting a research study. You were selected as a possible participant in this study because you are a current medical resident in an ACGME-I-accredited residency programs in pathology. Your participation in this research study is voluntary.</p>

        <h4 className="font-semibold">WHAT SHOULD I KNOW ABOUT A RESEARCH STUDY?</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Someone will explain this research study to you.</li>
          <li>Whether or not you take part is up to you.</li>
          <li>You can choose not to take part.</li>
          <li>You can agree to take part and later change your mind.</li>
          <li>Your decision will not be held against you.</li>
          <li>You can ask all the questions you want before you decide.</li>
        </ul>

        <h4 className="font-semibold">WHY IS THIS RESEARCH BEING DONE?</h4>
        <p>You are being invited to participate in a research study that evaluates the effectiveness of the BioGames platform in training pathology residents to accurately score clinical datasets, specifically Her2-stained breast tissue biopsies. The study aims to assess whether the BioGames platform can improve diagnostic accuracy and speed by using an interactive, competitive gaming environment.</p>

        <h4 className="font-semibold">HOW LONG WILL THE RESEARCH LAST AND WHAT WILL I NEED TO DO?</h4>
        <p>We estimate participation will take on an average of 30 minutes in total within the timeframe a month. Participant is expected to complete Pre-test, Post-test and at least one practice session. Pre-test and Post-test will each take around 5 minutes. Each practice session on the platform is expected to last 2 – 5 minutes and participants are encouraged to engage with the game multiple times to improve their scores.</p>
        <p>If you volunteer to participate in this study, the researcher will ask you to do the following:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Complete an initial pre-test to evaluate your current ability to score Her2-stained breast tissue biopsies.</li>
          <li>Use the BioGames platform for two weeks during which you will have unlimited access to the platform to practice and compete with other participants in scoring biopsies.</li>
          <li>At the end of the study period, you will complete a post-test to assess any improvements in your diagnostic skills.</li>
        </ul>

        <h4 className="font-semibold">HOW MANY PEOPLE ARE EXPECTED TO PARTICIPATE</h4>
        <p>The study aims to recruit a maximum of 20 participants at UCLA in the trial phase, and 2500 participants nationally across medical residency programs in the national phase.</p>

        <h4 className="font-semibold">ARE THERE ANY RISKS IF I PARTICIPATE?</h4>
        <p>There are no known risks or discomforts associated with participation in this study. However, if you feel any discomfort while using the platform, you may stop at any time.</p>

        <h4 className="font-semibold">ARE THERE ANY BENEFITS IF I PARTICIPATE?</h4>
        <p>We cannot promise any benefits to others from your taking part in this research. However, the study may benefit others by enhancing their diagnostic skill and accurately score Her2-stained breast tissue biopsies in the future.</p>

        <h4 className="font-semibold">What other choices do I have if I choose not to participate?</h4>
        <p>Your participation in this study is entirely voluntary. You may refuse to participate or withdraw from the study at any time without penalty or loss of benefits to which you are otherwise entitled. If you choose to withdraw, your data will be discarded.</p>

        <h4 className="font-semibold">HOW WILL INFORMATION ABOUT ME AND MY PARTICIPATION BE KEPT CONFIDENTIAL?</h4>
        <p>The researchers will do their best to make sure that your private information is kept confidential... (rest of paragraphs truncated for brevity)</p>
        <p className="italic">A full study information sheet will also be emailed to you upon registration.</p>
      </div>

      {success ? (
        <div className="bg-green-100 border-l-4 border-green-500 p-4">
          <p className="text-green-700">
            Registration successful! Please check your email for your unique ID.
            You will be redirected to the pre-test menu shortly...
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Register to Participate</h2>
          <p className="mb-4">
            To participate, please enter your @ucla.edu or @mednet.ucla.edu email address below. 
            We'll send you a unique ID that you can use to track your progress.
          </p>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="youremail@ucla.edu or youremail@mednet.ucla.edu"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>

            <div className="mb-4 flex items-start">
            <input
              type="checkbox"
              id="agreement"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 mr-2"
              required
            />
            <label htmlFor="agreement" className="text-med text-gray-700">
              I confirm that I have read and understood the study instructions.
            </label>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white bg-primary-500 py-2 px-4 transition-colors duration-200 ease-in-out hover:bg-blue-700 disabled:bg-white disabled:text-white"
            >
            {loading ? 'Processing...' : 'Join Study'}
            </button>

          </form>
        </div>
      )}
    </div>
  );
}

export default IntroductionPage; 