# Mobile App Transformation - Dialogue-Based Category Mapping

## Overview

The mobile app has been transformed to function like the web app with iterative dialogue-based category mapping instead of immediate skill identification from single activities.

## Key Changes

### 1. New Category Taxonomy (`categoryTaxonomyService.ts`)

- **8 categories** matching web app:
  - 🔧 Human Skills (Durable)
  - 🧠 Meta-Learning & Self-Awareness
  - 🛠️ Maker & Builder Skills
  - 🌍 Civic & Community Impact
  - 🖼️ Creative Expression & Communication
  - 🧩 Problem-Solving & Systems Thinking
  - 💼 Work & Entrepreneurial Experience
  - 🔭 Future Self & Directionality
- **NO_OP category** for weak fits
- Progress: mapped categories / 8

### 2. Category Storage Service (`categoryStorageService.ts`)

- Tracks mapped categories with justifications
- Stores conversation history
- AsyncStorage persistence
- Statistics and reset functions

### 3. Enhanced Gemini Service

Added two new dialogue functions:

- `synthesizeNextQuestion()`: Generates contextual questions based on conversation history
- `mapAnswerToCategory()`: Maps answers to categories with NO_OP support

### 4. New Dialogue Dashboard Screen (`DialogueDashboardScreen.tsx`)

**UI Components:**

- 8 category cards (grey when unmapped, purple border when mapped)
- Progress card showing mapped/total/percentage
- Modal for question/answer
- Loading modal for API calls
- Completion modal when all 8 categories mapped
- Two FABs: Reset (red) and Add Question (purple)

**Flow:**

1. User clicks + FAB
2. System shows question modal
3. User types answer and submits
4. System maps to category (or NO_OP if weak fit)
5. Background prefetch starts for next question
6. Repeat until 8/8 categories mapped

**Prefetching Logic:**

- After successful mapping, immediately starts fetching next question in background
- If user clicks + while prefetching, shows "Wait while system thinks..."
- Once prefetch completes, question appears instantly on next + click
- Matches web app UX optimization

### 5. Updated Navigation

- Welcome screen simplified: single "Start Journey" FAB → DialogueDashboard
- Added DialogueDashboard route to navigation types and App.tsx
- Old analysis flows (Home, VoiceAnalysis, TextAnalysis) remain for reference

## How to Test

### Starting the Journey

1. Login → Welcome screen
2. Tap "Start Journey" button
3. Should navigate to Skills Passport screen showing 8 grey category cards

### First Question

1. Tap the purple + FAB
2. Modal appears with: "Tell me what you are typically doing when you lose track of time"
3. Type a substantive answer (e.g., "I love building things with Arduino and creating robots")
4. Tap "Submit Answer"
5. Loading modal shows "Thinking... Mapping your response"
6. After a few seconds, category card turns purple with border (e.g., "Maker & Builder Skills")
7. Progress shows 1/8 categories, 12% complete

### Subsequent Questions

1. Wait ~2 seconds for background prefetch
2. Tap + FAB again
3. New contextual question appears immediately (prefetched)
4. Answer and submit
5. Repeat until 8/8

### Testing NO_OP (Weak Fit)

Try giving a vague answer like "I don't know" or "Maybe sometimes" - the system should detect weak fit and not map a category, then ask another question.

### Testing Already Mapped

If Gemini accidentally suggests an already-mapped category, the system will show an error and continue to next question.

### Completion

After mapping all 8 categories:

- Completion modal shows "🎉 Congratulations!!!"
- - FAB becomes disabled
- Can tap "Dismiss" to view final dashboard
- Can tap "Reset" FAB to clear and start over

### Viewing Justifications

Tap any mapped (purple border) category card to see an alert with Gemini's justification for why you have that trait.

### Reset

Tap red "Reset" FAB → confirmation alert → clears all data and returns to 0/8.

## API Requirements

- Same Gemini API key in `.env`
- Uses `gemini-2.5-flash` model (update `MODEL_NAME` in `geminiService.ts` if needed)
- Requires JSON response format support
- Network connection required for:
  - Question synthesis (~2-5 seconds)
  - Answer mapping (~2-5 seconds)

## Differences from Web App

1. **UI**: React Native Paper components instead of CSS/HTML
2. **Storage**: AsyncStorage instead of localStorage
3. **Modals**: React Native Modal component instead of CSS overlays
4. **FABs**: Paper FAB components with icons
5. **No real-time prefetch display**: Web shows small spinner during prefetch; mobile just prepares silently

## Migration Note

This is a **complete architectural shift** from the previous version:

- **Old**: Single activity → immediate multi-skill identification → results screen
- **New**: Iterative dialogue → one category at a time → gradual profile building

The old screens (Home, VoiceAnalysis, TextAnalysis, ResultScreen, SkillsDashboard) still exist but are no longer in the main flow. You can:

- Keep them for reference
- Delete them if not needed
- Create a settings menu to toggle between "Dialogue Mode" and "Analysis Mode"

## Future Enhancements

- Add category-specific stamp images
- Show conversation history on dashboard
- Export skills passport as PDF/image
- Social sharing of completed passport
- Onboarding tutorial explaining the dialogue flow
- Settings to choose between dialogue mode vs. quick analysis mode
