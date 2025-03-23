import { useState } from "react";
import GameResult from "./GameResult";
import ResultDisplay from "./ResultDisplay";

export interface ResultsDisplayProps {
    className: string,
    title: string,
    results: GameResult[]
}

function ResultsDisplay(props: ResultsDisplayProps) {
    const [show, setShow] = useState(false);
    
    return (
        <div className={props.className}>
            <h5 className="text-xl cursor-pointer"
                onClick={() => setShow(!show)}>
                {props.title} ({props.results.length})
                {show ? (<i className="ml-2 fa fa-minus"></i>)
                      : (<i className="ml-2 fa fa-plus"></i>)}
            </h5>
            <div className={`${!show && "hidden"} flex flex-col gap-2`}>
                {props.results.map(r => (
                    <ResultDisplay result={r}/>
                 ))}
            </div>
        </div>
    )
}

export default ResultsDisplay;
