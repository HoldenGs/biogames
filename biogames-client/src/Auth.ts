export function setUsername(username: string) : void {
    sessionStorage.setItem('username', username);
}

export function getUsername() : string | null {
    return sessionStorage.getItem('username');
}

export function setGameMode(mode: string) : void {
    sessionStorage.setItem('gameMode', mode);
}

export function getGameMode() : string | null {
    return sessionStorage.getItem('gameMode');
}

export function isAdmin(str: string) : boolean {
    return str.endsWith('admin');
}


