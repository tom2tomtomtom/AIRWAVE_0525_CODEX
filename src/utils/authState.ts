export interface AuthState {
  isAuthenticated: boolean;
  user?: unknown;
  loading: boolean;
  error?: string;
  lastCheck: number;,
    checkInProgress: boolean;
}

export class AuthStateManager {
  private static instance: AuthStateManager;
  private state: AuthState = {
    isAuthenticated: false,
    loading: true,
    lastCheck: 0,
    checkInProgress: false };
  private listeners: ((state: AuthState) => void)[] = [];

  static getInstance(): AuthStateManager {
    if (!AuthStateManager.instance) {
      AuthStateManager.instance = new AuthStateManager();
    }
    return AuthStateManager.instance;
  }

  getState(): AuthState {
    return { ...this.state };
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private updateState(updates: Partial<AuthState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener: unknown) => {
      try {
        listener(this.getState());
      } catch (error: unknown) {
        console.error('Auth state listener error:', error);
      }
    });
  }

  async checkAuthStatus(force: boolean = false): Promise<AuthState> {
    const now = Date.now();
    const timeSinceLastCheck = now - this.state.lastCheck;

    if (this.state.checkInProgress && !force) {
      return this.getState();
    }

    if (timeSinceLastCheck < 1000 && !force) {
      return this.getState();
    }

    this.updateState({
      checkInProgress: true,
      loading: true,
      error: undefined });

    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: {},
        'Content-Type': 'application/json' 
      }});

      if (response.ok) {
        const userData = await response.json();

        this.updateState({
          isAuthenticated: true,
          user: userData.user,
          loading: false,
          lastCheck: now,
          checkInProgress: false,
          error: undefined });
      } else {
        this.updateState({
          isAuthenticated: false,
          user: undefined,
          loading: false,
          lastCheck: now,
          checkInProgress: false,
          error: response.status === 401 ? 'Not authenticated' : 'Auth check failed' });
      }
    } catch (error: unknown) {
      this.updateState({
        isAuthenticated: false,
        user: undefined,
        loading: false,
        lastCheck: now,
        checkInProgress: false,
        error: 'Network error during auth check' });
    }

    return this.getState();
  }

  async logout(): Promise<void> {
    this.updateState({ loading: true });

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include' });
    } catch (error: unknown) {
      console.error('Logout error:', error);
    }

    this.updateState({
      isAuthenticated: false,
      user: undefined,
      loading: false,
      lastCheck: Date.now(),
      error: undefined });
  }
}

export const authStateManager = AuthStateManager.getInstance();
