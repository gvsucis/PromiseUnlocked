import { getJSONFromStorage, setJSONInStorage, removeFromStorage } from "../utils/asyncStorage";
import { getScopedStorageKey } from "./auth/authSessionService";

const DIALOGUE_STATE_KEY = "@dialogue_active_state";

export interface PersistedDialogueState {
  currentPrompt: string;
  savedQuestion: string;
  userAnswer: string;
  savedAnswer: string;
  uiState: string;
}

export async function saveDialogueState(state: PersistedDialogueState): Promise<void> {
  const key = await getScopedStorageKey(DIALOGUE_STATE_KEY);
  await setJSONInStorage(key, state);
}

export async function loadDialogueState(): Promise<PersistedDialogueState | null> {
  const key = await getScopedStorageKey(DIALOGUE_STATE_KEY);
  return getJSONFromStorage<PersistedDialogueState | null>(key, null);
}

export async function clearDialogueState(): Promise<void> {
  const key = await getScopedStorageKey(DIALOGUE_STATE_KEY);
  await removeFromStorage(key);
}
