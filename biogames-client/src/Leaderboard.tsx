import { useQuery } from "@tanstack/react-query";
import LeaderboardResponse from "./LeaderboardResponse";
import humanize_time from "./Humanize";
import { API_BASE_URL } from './config';

export interface LeaderboardProps {
    game_id: number
}

function Leaderboard(props: LeaderboardProps) {
    const leaderboardQuery = useQuery<LeaderboardResponse, Error>({
        queryKey: ['leaderboard'],
        queryFn: async () =>
            await fetch(`${API_BASE_URL}/leaderboard?game_id=${props.game_id}`)
            .then((res) => res.json())
    });


    if (leaderboardQuery.isLoading || !leaderboardQuery.data || !leaderboardQuery.data.entries) return 'Loading...';

    return (
        <table className="table-auto w-full">
            <thead className="border-b border-black">
                <tr>
                    <td>Username</td>
                    <td>Max Score</td>
                    <td>Time</td>
                </tr>
            </thead>
            <tbody>
                {leaderboardQuery.data.entries
                .filter(e => !e.username.endsWith('admin'))
                .map((e, index) => {
                    const name = e.username.startsWith('UCLA_') ? 'Anonymous' : e.username;
                    
                    // Determine row class based on rank
                    let rowClass = "";
                    if (index === 0) { // 1st place
                        rowClass = "bg-yellow-300 hover:bg-yellow-400"; 
                    } else if (index === 1) { // 2nd place
                        rowClass = "bg-slate-300 hover:bg-slate-400";
                    } else if (index === 2) { // 3rd place
                        rowClass = "bg-orange-300 hover:bg-orange-400"; // Using orange for bronze-like color
                    } else {
                        rowClass = "odd:bg-gray-100 hover:bg-gray-200"; // Default, keep odd striping for others
                    }

                    return (
                    <tr key={e.username + e.timestamp} className={rowClass}>
                        <td>{name}</td>
                        <td>{e.score}</td>
                        <td>{humanize_time(e.time_taken_ms, true)}</td>
                    </tr>
                    )} )
                }
            </tbody>
        </table>
    );
}

export default Leaderboard;

/**
 * Format a score from the confusion matrix for display
 * @param score The raw score from the backend
 */
export function formatScore(score: number): string {
    if (score === 5) {
        return "Correct";
    } else if (score === -1) {
        return "Minor error";
    } else if (score === -2) {
        return "Moderate error";
    } else if (score <= -3) {
        return "Severe error";
    } else {
        return score.toString();
    }
}

/**
 * Get a color class for a score
 * @param score The raw score from the backend
 */
export function getScoreColorClass(score: number): string {
    if (score === 5) {
        return "text-green-600";
    } else if (score === -1) {
        return "text-yellow-600";
    } else if (score === -2) {
        return "text-orange-600";
    } else {
        return "text-red-600";
    }
}
