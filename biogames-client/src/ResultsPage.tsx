import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import Game from "./Game";
import ResultsDisplay from "./ResultsDisplay";
import Leaderboard from "./Leaderboard";
import { API_BASE_URL } from './config';

interface ResultsPageProps {
    mode: string;
}

function ResultsPage({ mode }: ResultsPageProps) {
    const { id } = useParams();

    const gameQuery = useQuery<Game, Error>({
        queryKey: ['game'],
        queryFn: async () =>
            await fetch(`${API_BASE_URL}/games/${id}`)
            .then((res) => res.json())
    });

    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const playAgain = () => {
        queryClient.removeQueries(['game']);
        queryClient.removeQueries(['challenge']);
        queryClient.removeQueries(['leaderboard']);
        navigate('/menu');
    }

    if (gameQuery.isLoading || !gameQuery.data || !gameQuery.data.results) return 'Loading...';

    return (
        <div className="border-2 border-black m-2 mx-auto p-4 w-[1000px] max-w-[95vw] text-center">
            <h3 className="text-4xl mb-2">Game complete!</h3>
            <div className="flex flex-col gap-4 md:grid md:grid-rows-[1.4rem_1fr] md:grid-cols-2">
                <h4 className="text-3xl md:order-1">Your score: {gameQuery.data.total_points}</h4>
                <div className="border border-black h-min md:order-3">
                    <Leaderboard game_id={Number(id ?? 0)}/>
                </div>
                <h4 className="text-3xl md:order-2">Game Summary</h4>
                <div className="text-right md:order-4">
                    <ResultsDisplay
                        className="text-[red]"
                        results={gameQuery.data.results.severe_mistakes}
                        title="Severe Mistakes"/>
                    <ResultsDisplay
                        className="text-[orange]"
                        results={gameQuery.data.results.moderate_mistakes}
                        title="Moderate Mistakes"/>
                    <ResultsDisplay
                        className="text-[#e6c300]"
                        results={gameQuery.data.results.mild_mistakes}
                        title="Mild Mistakes"/>
                    <ResultsDisplay
                        className="text-[green]"
                        results={gameQuery.data.results.correct}
                        title="Correct"/>
                </div>
            </div>
            <button className="p-2 mt-2 bg-primary-500 text-white" onClick={playAgain}>Play Again</button>
        </div>
    )
}

export default ResultsPage;
