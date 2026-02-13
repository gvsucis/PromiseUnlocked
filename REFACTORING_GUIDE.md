# DialogueDashboardScreen Refactoring Guide

## ✅ What's Been Completed

### Phase 1-2: Custom Hooks Extracted

All business logic has been extracted into reusable hooks in `/src/hooks/`:

1. **`useDialogueState.ts`** (195 lines) - Core state management
   - All dialogue state (mappedCategories, interactions, UI state, etc.)
   - `loadData()` and `handleReset()` methods
   - Automatic completion detection

2. **`useCategoryMapping.ts`** (292 lines) - API & category logic
   - `getNextQuestion()` - Fetches/prefetches questions
   - `mapAnswerToCategory()` - Maps answers to categories via API
   - `handleStartButtonPress()` - Initiates dialogue flow

3. **`useVoiceRecording.ts`** (191 lines) - Voice recording logic
   - `handleVoiceInputPress()` - Initiates voice workflow
   - `startRecording()` / `stopRecording()` - Audio controls
   - `handleVoiceSubmit()` - Transcription & submission

4. **`useImageHandling.ts`** (177 lines) - Image upload logic
   - `handleImageInputPress()` - Initiates image workflow
   - `handleImageSelection()` - Camera/gallery picker
   - `handleSubmitImage()` - Image analysis & submission

5. **`useFabAnimation.ts`** (104 lines) - FAB menu animations
   - `toggleFabMenu()` - Animates FAB expand/collapse
   - Pre-calculated animation styles for all buttons

**Total lines extracted:** ~960 lines of logic → **Reduction: ~45% of original file!**

---

## 🔧 How to Use the New Hooks

### Basic Pattern:

```tsx
export default function DialogueDashboardScreen({ navigation }: Props) {
  // 1. Initialize core dialogue state
  const dialogueState = useDialogueState();

  // 2. Additional state needed by hooks
  const [pendingVoiceRecording, setPendingVoiceRecording] = useState(false);
  const [isAnswerFromVoice, setIsAnswerFromVoice] = useState(false);
  const confettiRef = useRef<any>(null);

  // 3. Initialize specific feature hooks
  const categoryMapping = useCategoryMapping({
    dialogueState,
    pendingVoiceRecording,
    setPendingVoiceRecording,
    setIsAnswerFromVoice,
  });

  const voiceRecording = useVoiceRecording({
    dialogueState,
    mapAnswerToCategory: categoryMapping.mapAnswerToCategory,
  });

  const imageHandling = useImageHandling({
    dialogueState,
    mapAnswerToCategory: categoryMapping.mapAnswerToCategory,
  });

  const fabAnimation = useFabAnimation();

  // 4. Load data on mount
  useEffect(() => {
    dialogueState.loadData();
  }, []);

  // 5. Configure navigation header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={dialogueState.handleReset}
          style={{ marginRight: 15 }}
          disabled={dialogueState.uiState !== 'idle' && dialogueState.uiState !== 'complete'}
        >
          <MaterialIcons
            name="refresh"
            size={24}
            color={dialogueState.uiState !== 'idle' && dialogueState.uiState !== 'complete' ? '#ccc' : '#fff'}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, dialogueState.uiState]);

  // 6. Render - much simpler now!
  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView>
        {/* Header & Progress */}
        <ProgressCard
          mappedCategories={dialogueState.mappedCategories}
          onStart={categoryMapping.handleStartButtonPress}
          uiState={dialogueState.uiState}
        />

        {/* Category Grid */}
        <CategoryGrid categories={dialogueState.mappedCategories} />
      </ScrollView>

      {/* All modals */}
      <InputMethodModal {...dialogueState} />
      <AnswerModal {...dialogueState} />
      <VoiceRecordingModal {...voiceRecording} {...dialogueState} />
      {/* ...other modals */}
    </LinearGradient>
  );
}
```

---

## 📦 Phase 3: Modal Components (TODO)

Still need to extract these 7 modal components to `/src/components/dialogue/`:

### 1. `InputMethodModal.tsx` (~100 lines)
Shows text/voice/image options after "Start/Continue" button.

```tsx
interface InputMethodModalProps {
  visible: boolean;
  onSelect: (method: 'text' | 'voice' | 'image') => void;
  onClose: () => void;
}
```

### 2. `AnswerModal.tsx` (~200 lines)
Text input modal for answering questions.

```tsx
interface AnswerModalProps {
  visible: boolean;
  currentPrompt: string;
  userAnswer: string;
  setUserAnswer: (answer: string) => void;
  selectedImage: string | null;
  onSubmit: () => void;
  onSubmitImage: () => void;
  onRemoveImage: () => void;
  onDismiss: () => void;
  error: string;
}
```

### 3. `VoiceRecordingModal.tsx` (~150 lines)
Voice recording interface with timer and controls.

```tsx
interface VoiceRecordingModalProps {
  visible: boolean;
  currentPrompt: string;
  isRecording: boolean;
  recordingDuration: number;
  recordingUri: string | null;
  isProcessingAudio: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}
```

### 4. `WeakFitModal.tsx` (~120 lines)
Shown when answer doesn't map well - offers retry or new question.

```tsx
interface WeakFitModalProps {
  visible: boolean;
  justification: string;
  onTryAgain: () => void;
  onNewQuestion: () => void;
}
```

### 5. `LoadingModal.tsx` (~60 lines)
Loading spinner with message.

```tsx
interface LoadingModalProps {
  visible: boolean;
  message: string;
}
```

### 6. `CompletionModal.tsx` (~80 lines)
Congratulations message when all categories are mapped.

```tsx
interface CompletionModalProps {
  visible: boolean;
  onDismiss: () => void;
}
```

### 7. `CategoryCard.tsx` (~80 lines)
Individual category display card.

```tsx
interface CategoryCardProps {
  category: { category: string; description: string; example: string };
  isMapped: boolean;
  mappedData?: MappedCategory;
}
```

---

## 🎯 Benefits Achieved So Far

### Before Refactoring:
- ❌ 2,109 lines in one file
- ❌ 20+ useState hooks mixed together
- ❌ Impossible to test individual features
- ❌ Hard to find specific logic
- ❌ Can't reuse logic in other screens

### After Hooks Extraction:
- ✅ ~960 lines moved to 5 focused hooks
- ✅ Clear separation of concerns
- ✅ Each hook is independently testable
- ✅ Logic can be reused
- ✅ Easier to debug (know which hook has the issue)
- ✅ Main screen will be ~300-400 lines once modals are extracted

---

## 🚀 Next Steps

### Option A: Complete Modal Extraction (Recommended)
Extract all 7 modal components to finish the refactoring. This will reduce the main screen to ~300 lines.

### Option B: Use Hooks Immediately
Update `DialogueDashboardScreen.tsx` to import and use the new hooks right away. Keep modals inline for now.

### Option C: Fix Rate Limiting First
Before continuing refactoring, address the rate limiting issues we identified earlier (increase delays from 1.5s to 4.5s).

---

## 📝 Key Takeaways

1. **Hooks successfully extracted** - All business logic is now modular
2. **960+ lines saved** - Nearly half the file is now in reusable hooks
3. **Modals remain** - Still the largest chunk of code to extract
4. **Pattern established** - Same approach can be used for other large screens

## 🔗 Files Created

```
src/
├── hooks/
│   ├── useDialogueState.ts          ✅ Created (195 lines)
│   ├── useCategoryMapping.ts        ✅ Created (292 lines)
│   ├── useVoiceRecording.ts         ✅ Created (191 lines)
│   ├── useImageHandling.ts          ✅ Created (177 lines)
│   └── useFabAnimation.ts           ✅ Created (104 lines)
└── components/
    └── dialogue/                     📁 Created (ready for modals)
```

---

**Would you like me to:**
1. Complete the modal extraction (Phase 3)?
2. Refactor the main screen to use these hooks immediately?
3. Fix the rate limiting issue first, then continue refactoring?
