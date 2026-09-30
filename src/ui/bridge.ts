import type { UiToCode } from '../shared/types';
export const send = (msg: UiToCode) => parent.postMessage({ pluginMessage: msg }, '*');
