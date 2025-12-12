import { create } from "zustand";

interface AuthStore {
    logged: boolean;
    setLogged: (value: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
    logged: false,
    setLogged: (value: boolean) => set({ logged: value }),
}))



interface UserStore {
    balance: number;
    stocks: Record<string, number>;
    update: (bal: number, stks: Record<string, number>) => void;
}

export const useUserStore = create<UserStore>((set) => ({
    balance: 0,
    stocks: {},

    update: (bal: number, stks: Record<string, number>) =>
        set({ balance: bal, stocks: stks })
    
}))

