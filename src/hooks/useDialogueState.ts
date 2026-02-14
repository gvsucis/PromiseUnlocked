import { useState, useEffect } from 'react';
import {
  MappedCategory,
  ConversationInteraction,
  TOTAL_CATEGORIES,
} from '../services/categoryTaxonomyService';
import {
  getMappedCategories,
  getConversationHistory,
  clearAllData,
} from '../services/categoryStorageService';

export type UIState =
  | 'idle'
  | 'answering'
  | 'loading'
  | 'complete'
  | 'weak-fit'
  | 'voice-recording';

export interface DialogueState {
  // Core state
  mappedCategories: MappedCategory[];
  setMappedCategories: React.Dispatch<React.SetStateAction<MappedCategory[]>>;
  interactions: ConversationInteraction[];
  setInteractions: React.Dispatch<React.SetStateAction<ConversationInteraction[]>>;
  uiState: UIState;
  setUiState: React.Dispatch<React.SetStateAction<UIState>>;

  // Question/Answer state
  currentPrompt: string;
  setCurrentPrompt: React.Dispatch<React.SetStateAction<string>>;
  userAnswer: string;
  setUserAnswer: React.Dispatch<React.SetStateAction<string>>;

  // UI feedback state
  loadingMessage: string;
  setLoadingMessage: React.Dispatch<React.SetStateAction<string>>;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;

  // Prefetch state
  prefetchedQuestion: string | null;
  setPrefetchedQuestion: React.Dispatch<React.SetStateAction<string | null>>;
  isPrefetching: boolean;
  setIsPrefetching: React.Dispatch<React.SetStateAction<boolean>>;

  // Modal state
  showInputMethodModal: boolean;
  setShowInputMethodModal: React.Dispatch<React.SetStateAction<boolean>>;

  // Weak fit state
  weakFitJustification: string;
  setWeakFitJustification: React.Dispatch<React.SetStateAction<string>>;
  savedQuestion: string;
  setSavedQuestion: React.Dispatch<React.SetStateAction<string>>;

  // Confetti state
  showConfetti: boolean;
  setShowConfetti: React.Dispatch<React.SetStateAction<boolean>>;

  // Loading state
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;

  // Methods
  loadData: () => Promise<void>;
  handleReset: () => Promise<void>;
}

export function useDialogueState(): DialogueState {
  const [mappedCategories, setMappedCategories] = useState<MappedCategory[]>([]);
  const [interactions, setInteractions] = useState<ConversationInteraction[]>([]);
  const [uiState, setUiState] = useState<UIState>('idle');
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [prefetchedQuestion, setPrefetchedQuestion] = useState<string | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weakFitJustification, setWeakFitJustification] = useState('');
  const [savedQuestion, setSavedQuestion] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [showInputMethodModal, setShowInputMethodModal] = useState(false);

  // Load data on mount
  const loadData = async () => {
    try {
      const categories = await getMappedCategories();
      const history = await getConversationHistory();
      setMappedCategories(categories);
      setInteractions(history);
      console.log('Loaded data:', categories.length, 'categories,', history.length, 'interactions');
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load your progress. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle reset
  const handleReset = async () => {
    try {
      await clearAllData();
      setMappedCategories([]);
      setInteractions([]);
      setCurrentPrompt('');
      setUserAnswer('');
      setPrefetchedQuestion(null);
      setIsPrefetching(false);
      setWeakFitJustification('');
      setSavedQuestion('');
      setError('');
      setShowConfetti(false);
      setUiState('idle');
      console.log('Data reset successfully');
    } catch (err) {
      console.error('Error resetting data:', err);
      setError('Failed to reset data. Please try again.');
    }
  };

  // Check completion
  useEffect(() => {
    if (mappedCategories.length === TOTAL_CATEGORIES) {
      setUiState('complete');
      setPrefetchedQuestion(null);
      setIsPrefetching(false);
    }
  }, [mappedCategories.length]);

  // Debug useEffect to monitor showInputMethodModal changes
  useEffect(() => {
    console.log('showInputMethodModal changed to:', showInputMethodModal);
  }, [showInputMethodModal]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('State changed:', {
      uiState,
      currentPrompt: currentPrompt.substring(0, 50) + '...',
      hasPrompt: !!currentPrompt,
    });
  }, [uiState, currentPrompt]);

  // Debug: Specifically track Answer modal visibility
  useEffect(() => {
    const shouldShowAnswerModal = uiState === 'answering';
    console.log('🔴 Answer Modal should be visible:', shouldShowAnswerModal, {
      uiState,
      hasCurrentPrompt: !!currentPrompt,
      promptLength: currentPrompt.length,
      showInputMethodModal,
    });
  }, [uiState, currentPrompt, showInputMethodModal]);

  return {
    mappedCategories,
    setMappedCategories,
    interactions,
    setInteractions,
    uiState,
    setUiState,
    currentPrompt,
    setCurrentPrompt,
    userAnswer,
    setUserAnswer,
    loadingMessage,
    setLoadingMessage,
    error,
    setError,
    prefetchedQuestion,
    setPrefetchedQuestion,
    isPrefetching,
    setIsPrefetching,
    showInputMethodModal,
    setShowInputMethodModal,
    weakFitJustification,
    setWeakFitJustification,
    savedQuestion,
    setSavedQuestion,
    showConfetti,
    setShowConfetti,
    loading,
    setLoading,
    loadData,
    handleReset,
  };
}
