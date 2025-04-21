export function setUsername(username: string) : void {
    sessionStorage.setItem('username', username);
}

export function getUsername() : string | null {
    return sessionStorage.getItem('username');
}

export function setEmail(email: string) : void {
    sessionStorage.setItem('email', email);
}

export function getEmail() : string | null {
    return sessionStorage.getItem('email');
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

export function clearSession() : void {
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('email');
    sessionStorage.removeItem('gameMode');
}

export function isAuthenticated() : boolean {
    return sessionStorage.getItem('username') !== null;
}


