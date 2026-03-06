# Rate Limit Handling Guide

## Problem

The Gemini API has rate limits (429 errors) when making too many requests in a short time. This is especially common during the dialogue flow where we make 2 API calls per interaction (mapping + prefetch).

## Solutions Implemented

### 1. Exponential Backoff Retry Logic

Added `retryWithBackoff()` helper in `geminiService.ts`:

- Automatically retries on 429 errors
- Uses exponential backoff: 1s → 2s → 4s
- Up to 3 retry attempts
- Immediate throw for non-rate-limit errors

### 2. Delayed Prefetching

Modified `DialogueDashboardScreen.tsx`:

- Added 2-second delay before background prefetch starts
- Prevents rapid-fire API calls
- User sees result immediately, prefetch happens in background

### 3. Better Error Messages

Now shows specific errors:

- "Rate limit exceeded. Please wait a moment and try again."
- "API key invalid or missing. Check your .env file."
- "Network error. Please check your internet connection."
- "API Error: [status] - [message]"

## How It Works Now

**Before (causes 429 errors):**

```
User submits answer
  → Mapping API call (2-5s)
  → Prefetch API call immediately (429 ERROR!)
```

**After (with rate limit handling):**

```
User submits answer
  → Mapping API call (2-5s)
  → Show result, return to idle
  → Wait 2 seconds
  → Prefetch API call (succeeds!)
  → If 429 error, retry with backoff
```

## Gemini API Free Tier Limits

Based on Gemini API documentation:

- **15 requests per minute (RPM)**
- **1 million tokens per minute (TPM)**
- **1,500 requests per day (RPD)**

Our usage per interaction:

- 1 mapping call (~500-1000 tokens)
- 1 question synthesis call (~800-1500 tokens)
- **Total: 2 calls per complete interaction**

## Best Practices

### For Development/Testing

1. **Don't spam the + button** - Wait a few seconds between interactions
2. **Test with deliberate pace** - Mimics real user behavior
3. **Use meaningful answers** - Short tests consume quota without value

### For Production

Current implementation handles this automatically:

- 2-second prefetch delay
- 3 retry attempts with exponential backoff
- Clear error messages for users

### If You Still Hit Limits

1. **Increase prefetch delay** in `DialogueDashboardScreen.tsx`:

   ```typescript
   setTimeout(() => {
     getNextQuestion(true);
   }, 3000); // Change from 2000 to 3000 or higher
   ```

2. **Disable prefetching** temporarily:

   ```typescript
   // Comment out the prefetch block
   // if (mappingResult !== 'COMPLETE' && mappingResult !== 'MAPPING_FAILED') {
   //   setIsPrefetching(true);
   //   setTimeout(() => {
   //     getNextQuestion(true);
   //   }, 2000);
   // }
   ```

3. **Upgrade API quota** (if using for production):
   - Go to Google AI Studio
   - Request increased quota
   - Consider paid tier for production apps

## Monitoring Rate Limits

Watch console logs for:

```
Rate limit hit. Retrying in 1000ms... (attempt 1/3)
Rate limit hit. Retrying in 2000ms... (attempt 2/3)
Rate limit hit. Retrying in 4000ms... (attempt 3/3)
```

If you see this often, increase the prefetch delay.

## Testing the Fix

1. **Test normal flow:**

   - Answer question
   - Wait for result
   - Click + again
   - Should use prefetched question instantly

2. **Test retry logic:**

   - Answer multiple questions rapidly
   - If 429 occurs, watch console for retry messages
   - Should succeed after 1-3 retries

3. **Test error display:**
   - Temporarily break API key
   - Should show: "API key invalid or missing..."
   - Turn off internet
   - Should show: "Network error. Please check..."

## Free Tier Optimization Tips

1. **Cache questions locally** (future enhancement):

   - Pre-generate common follow-up questions
   - Reduce API calls by 50%

2. **Batch mode** (future enhancement):

   - Collect 2-3 answers before processing
   - Process all at once

3. **Smart prefetching** (current implementation):
   - Only prefetch when mapping succeeds
   - Skip prefetch on NO_OP or errors
   - Delay to respect rate limits

## Summary

✅ Automatic retry with exponential backoff  
✅ 2-second delay before prefetch  
✅ Clear error messages  
✅ Respects free tier limits  
✅ Graceful degradation

With these changes, rate limit errors should be rare and automatically handled when they do occur.
