import { createContext, useContext } from 'react';

export type GerantSignOut = () => void | Promise<void>;

const GerantSessionContext = createContext<GerantSignOut | null>(null);

export const GerantSessionProvider = GerantSessionContext.Provider;

export function useGerantSignOut(): GerantSignOut | null {
  return useContext(GerantSessionContext);
}
