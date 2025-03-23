export default function humanize_time(time: number, include_ms: boolean) : string {
    const hours = Math.floor(time / (1000 * 60 * 60));
    const minutes = Math.floor((time / (1000 * 60)) % 60);
    const builder = [];
    if (hours > 0) {
        builder.push(`${hours}h `);
    }
    if (minutes > 0) {
        builder.push(`${minutes}m `);
    }
    if (!include_ms) {
        const seconds = Math.floor((time / (1000)) % 60);
        builder.push(`${seconds}s`);
    } else {
        const seconds = (time - (hours * 3600 + minutes * 60) * 1000) / 1000;
        builder.push(`${seconds.toPrecision(4)}s`);
    }
    return builder.join('');
}
