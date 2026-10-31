import { createContext, useContext } from 'react';

/** Lets edge labels (rendered outside the SVG) open the link editor. */
export const EdgeClickContext = createContext<(linkId: string) => void>(() => undefined);

export function useEdgeClick(): (linkId: string) => void {
  return useContext(EdgeClickContext);
}
