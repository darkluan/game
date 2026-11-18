import { createContext } from 'react';

/**
 * True inside a lobby frame that already shows the picked hero's abilities over the 3D hero, so the
 * hero picker does not show them a second time.
 */
export const AbilitiesShownContext = createContext(false);
