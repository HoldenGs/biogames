const USER_ID_KEY = 'user_id';
const USERNAME_KEY = 'username';
const EMAIL_KEY = 'email';
const GAME_MODE_KEY = 'gameMode';

export function setUserId(userId: string): void {
    sessionStorage.setItem(USER_ID_KEY, userId);
}

export function getUserId(): string | null {
    return sessionStorage.getItem(USER_ID_KEY);
}

export function setUsername(username: string): void {
    sessionStorage.setItem(USERNAME_KEY, username);
}

export function getUsername(): string | null {
    return sessionStorage.getItem(USERNAME_KEY);
}

export function setEmail(email: string): void {
    sessionStorage.setItem(EMAIL_KEY, email);
}

export function getEmail(): string | null {
    return sessionStorage.getItem(EMAIL_KEY);
}

export function setGameMode(mode: string): void {
    sessionStorage.setItem(GAME_MODE_KEY, mode);
}

export function getGameMode(): string | null {
    return sessionStorage.getItem(GAME_MODE_KEY);
}

export function isAdmin(): boolean {
    const userId = getUserId();
    return userId ? userId.endsWith('admin') : false;
}

export function clearSession(): void {
    sessionStorage.removeItem(USER_ID_KEY);
    sessionStorage.removeItem(USERNAME_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    sessionStorage.removeItem(GAME_MODE_KEY);
}

export function isAuthenticated(): boolean {
    return sessionStorage.getItem(USER_ID_KEY) !== null;
}


