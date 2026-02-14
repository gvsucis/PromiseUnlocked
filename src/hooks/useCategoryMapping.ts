import { useCallback } from 'react';
import { GeminiService } from '../services/geminiService';
import {
  MappedCategory,
  ConversationInteraction,
  TOTAL_CATEGORIES,
  INITIAL_PROMPT,
  NO_OP_CATEGORY,
  getTaxonomyString,
  findValidCategory,
} from '../services/categoryTaxonomyService';
import {
  saveMappedCategory,
  addConversationInteraction,
  isCategoryMapped,
} from '../services/categoryStorageService';
import { DialogueState } from './useDialogueState';

interface UseCategoryMappingProps {
  dialogueState: DialogueState;
  pendingVoiceRecording: boolean;
  setPendingVoiceRecording: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAnswerFromVoice: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useCategoryMapping({
  dialogueState,
  pendingVoiceRecording,
  setPendingVoiceRecording,
  setIsAnswerFromVoice,
}: UseCategoryMappingProps) {
  const {
    mappedCategories,
    setMappedCategories,
    interactions,
    setInteractions,
    setUiState,
    setCurrentPrompt,
    setUserAnswer,
    setLoadingMessage,
    setError,
    setPrefetchedQuestion,
    setIsPrefetching,
    setWeakFitJustification,
    setShowConfetti,
    setShowInputMethodModal,
    prefetchedQuestion,
    isPrefetching,
    loadingMessage,
    uiState,
  } = dialogueState;

  const getNextQuestion = useCallback(
    async (isPrefetch = false) => {
      setError('');

      if (mappedCategories.length === TOTAL_CATEGORIES) {
        setUiState('complete');
        return;
      }

      if (!isPrefetch) {
        setUiState('loading');
        setLoadingMessage('Synthesizing a new question...');
      }

      try {
        const taxonomyString = getTaxonomyString();
        const newQuestion = await GeminiService.synthesizeNextQuestion(
          interactions,
          mappedCategories,
          taxonomyString
        );

        if (isPrefetch) {
          console.log('Setting prefetched question:', newQuestion);
          setPrefetchedQuestion(newQuestion);
          setIsPrefetching(false);

          // If user is waiting, show question immediately
          setUiState((currentUiState) => {
            if (currentUiState === 'loading' && loadingMessage.includes('Wait while')) {
              console.log('User was waiting, showing question immediately');
              setCurrentPrompt(newQuestion);
              if (pendingVoiceRecording) {
                setPendingVoiceRecording(false);
                return 'voice-recording';
              }
              return 'answering';
            }
            return currentUiState === 'loading' ? 'idle' : currentUiState;
          });

          setLoadingMessage('');
        } else {
          console.log('Setting current prompt (non-prefetch):', newQuestion);
          setCurrentPrompt(newQuestion);
          setLoadingMessage('');

          // Small delay to ensure loading modal closes before answer modal opens
          setTimeout(() => {
            if (pendingVoiceRecording) {
              console.log('Setting uiState to voice-recording');
              setPendingVoiceRecording(false);
              setUiState('voice-recording');
            } else {
              console.log('Setting uiState to answering');
              setUiState('answering');
            }
            console.log('UI state should now be set, modal should appear');
          }, 100);
        }
      } catch (err) {
        console.error('Error getting next question:', err);
        setError('Failed to generate question. Please try again.');
        setIsPrefetching(false);
        setPendingVoiceRecording(false);
        setLoadingMessage('');
        setUiState('idle');
      }
    },
    [
      interactions,
      mappedCategories,
      pendingVoiceRecording,
      loadingMessage,
      setError,
      setUiState,
      setLoadingMessage,
      setPrefetchedQuestion,
      setIsPrefetching,
      setCurrentPrompt,
      setPendingVoiceRecording,
    ]
  );

  const mapAnswerToCategory = async (question: string, answer: string) => {
    setUiState('loading');
    setLoadingMessage('Analyzing your response...');
    setError('');

    setPrefetchedQuestion(null);
    setIsPrefetching(false);

    try {
      const isInitial = mappedCategories.length === 0;
      const taxonomyString = getTaxonomyString();

      // Use combined API call to map answer AND generate next question in one request
      const result = await GeminiService.mapAnswerAndGenerateNextQuestion(
        question,
        answer,
        isInitial,
        interactions,
        mappedCategories,
        taxonomyString
      );

      const { category: rawCategory, justification, nextQuestion } = result;

      // Validate category
      const validCategory = findValidCategory(rawCategory);
      const categoryNameToCheck = validCategory ? validCategory.category : rawCategory;

      let mappingResult = 'NO_CHANGE';

      if (categoryNameToCheck === NO_OP_CATEGORY) {
        // NO-OP: weak fit - ask follow-up question
        console.log('NO-OP Mapping: weak fit. Justification:', justification);
        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: 'NO-OP (WEAK FIT)',
          timestamp: new Date().toISOString(),
        };
        await addConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);

        // Show weak fit modal with follow-up prompt
        setWeakFitJustification(justification);
        setUiState('weak-fit');
        return; // Don't prefetch or continue
      } else if (validCategory && !(await isCategoryMapped(categoryNameToCheck))) {
        // Successful mapping
        mappingResult = 'SUCCESS';

        const newMappedCategory: MappedCategory = {
          category: categoryNameToCheck,
          justification,
          dateIdentified: new Date().toISOString(),
        };

        await saveMappedCategory(newMappedCategory);
        const newMappedCategories = [...mappedCategories, newMappedCategory];
        setMappedCategories(newMappedCategories);

        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: categoryNameToCheck,
          timestamp: new Date().toISOString(),
        };
        await addConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);

        // Trigger confetti animation for successful mapping!
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);

        if (newMappedCategories.length === TOTAL_CATEGORIES) {
          mappingResult = 'COMPLETE';
        }
      } else if (await isCategoryMapped(categoryNameToCheck)) {
        setError(`"${categoryNameToCheck}" is already mapped. Trying next question.`);
        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: 'ALREADY MAPPED (IGNORED)',
          timestamp: new Date().toISOString(),
        };
        await addConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);
      } else {
        setError(`Unexpected category: "${rawCategory}". Please try again.`);
        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: 'MAPPING FAILED',
          timestamp: new Date().toISOString(),
        };
        await addConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);
      }

      setUserAnswer('');
      setIsAnswerFromVoice(false);

      // Use the next question that was generated in the same API call
      // No need to prefetch separately - we already have it!
      if (mappingResult !== 'COMPLETE' && mappingResult !== 'MAPPING_FAILED' && nextQuestion) {
        console.log('Using next question from combined API response:', nextQuestion);
        setPrefetchedQuestion(nextQuestion);
        setIsPrefetching(false);
      } else if (mappingResult !== 'COMPLETE' && mappingResult !== 'MAPPING_FAILED') {
        // Fallback: only prefetch if the combined call didn't return a question
        console.log('Next question not returned, falling back to separate prefetch');
        setIsPrefetching(true);
        setTimeout(() => {
          getNextQuestion(true);
        }, 2000);
      }

      if (mappingResult === 'COMPLETE') {
        setUiState('complete');
      } else {
        setUiState('idle');
      }
    } catch (err) {
      console.error('Error mapping answer:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to process your answer. Please try again.';
      setError(errorMessage);
      setUserAnswer('');
      setIsAnswerFromVoice(false);
      setCurrentPrompt('');
      setUiState('idle');
    }
  };

  const handleStartButtonPress = async () => {
    if (uiState !== 'idle') return;
    setError('');

    // If we need a question and don't have one, synthesize it first
    if (mappedCategories.length > 0 && !prefetchedQuestion && !isPrefetching) {
      console.log('Need to synthesize question before showing input method modal');
      setUiState('loading');
      setLoadingMessage('Synthesizing a new question...');

      try {
        const taxonomyString = getTaxonomyString();
        const newQuestion = await GeminiService.synthesizeNextQuestion(
          interactions,
          mappedCategories,
          taxonomyString
        );

        console.log('Question synthesized, storing as prefetched:', newQuestion);
        setPrefetchedQuestion(newQuestion);
        setUiState('idle');
        setLoadingMessage('');

        // Small delay before showing input method modal
        setTimeout(() => {
          setShowInputMethodModal(true);
        }, 100);
      } catch (err) {
        console.error('Error synthesizing question:', err);
        setError('Failed to generate question. Please try again.');
        setUiState('idle');
        setLoadingMessage('');
      }
    } else {
      // Question ready or it's first question (INITIAL_PROMPT)
      setShowInputMethodModal(true);
    }
  };

  return {
    getNextQuestion,
    mapAnswerToCategory,
    handleStartButtonPress,
  };
}
