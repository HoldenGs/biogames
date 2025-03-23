export interface InstructionsProps {
    onClose: React.MouseEventHandler<HTMLButtonElement>
}

function Instructions(props: InstructionsProps) {
    return (
        <div className="fixed top-0 left-0 w-screen h-screen bg-black/50 z-1">
            <div className="p-4 mx-auto my-4 w-[720px] max-w-[50vw] bg-white border-2 border-black text-black">
                <div className="flex justify-end mb-2">
                    <button onClick={props.onClose}>
                        <i className="fa fa-x"></i>
                    </button>
                </div>
                <p className="text-justify mb-4">
                    In this game, you will be presented with a series of
                    patches of HER2 cores. For each core, indicate its HER2
                    level using one of the four buttons. There is a minimum wait
                    time of 5 seconds before you can make a selection. When you
                    have identified the last patch, you will have the
                    opportunity to review your mistakes and the correct HER2
                    level for those patches. You will also see a leaderboard to
                    compare your performance to that of other players.
                </p>
            </div>
        </div>
    )
}

export default Instructions;
