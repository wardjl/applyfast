# Local AI Scoring - Chrome Gemini Nano

This module enables **on-device job scoring** using Chrome's built-in Gemini Nano AI model. All processing happens locally in your browser - zero data leaves your device.

## What It Does

- Score LinkedIn jobs using browser-based AI (Gemini Nano)
- Get personalized job fit scores (1-10) with detailed explanations
- Check if job requirements are met with visual indicators
- **Complete privacy**: All AI processing happens on-device
- **Streaming UI**: Real-time score updates as AI generates results
- Save locally-scored jobs to your dashboard

## Files

| File | Purpose |
|------|---------|
| `chrome-ai-provider.ts` | Vercel AI SDK adapter for Chrome's Prompt API |
| `scoring-utils.ts` | Job scoring logic (same prompts as cloud version) |
| `LocalJobScoring.tsx` | Main scoring component with state management |
| `LocalJobScoringStream.tsx` | Streaming UI with real-time updates |

## Architecture

This module is **optional and isolated**. The extension works fine if you delete this folder - it's conditionally imported and gracefully falls back if unavailable.

## Requirements

**Chrome Setup:**
1. Install Chrome Canary, Dev, or Beta (version 127+)
2. Enable flag: `chrome://flags/#prompt-api-for-gemini-nano`
3. Restart Chrome
4. Gemini Nano downloads automatically (~1GB, one-time)

**Extension Manifest:**
```json
{
  "permissions": ["aiLanguageModelOriginTrial"]
}
```

## How It Works

1. **Browse LinkedIn** - Open any LinkedIn job page
2. **Open Side Panel** - Click ApplyFast extension icon
3. **Score Job** - Click "💡 Try Local AI Scoring" button
4. **AI Processing** - Gemini Nano scores the job on-device with streaming updates
5. **View Results** - See score (1-10) with detailed explanation in real-time
6. **Save or Re-score** - Save to dashboard or generate a new score

**Key Points:**
- Jobs are extracted from LinkedIn via content script
- Scoring uses the same prompts as cloud-based system
- Results stream character-by-character for responsive UX
- Saved jobs include the local score (no cloud re-scoring needed)

## Implementation Details

### Chrome AI Provider (`chrome-ai-provider.ts`)

Custom Vercel AI SDK adapter that bridges Chrome's Prompt API with the standard AI SDK interface.

**Features:**
- Session management for Chrome AI API
- Streaming responses via `partialObjectStream`
- Capability detection using `LanguageModel.params()`
- Error handling and graceful fallbacks

### Scoring Utilities (`scoring-utils.ts`)

Reuses the exact same scoring logic as the cloud system:
- Job scoring Zod schema
- Scoring prompts from `lib/constants.ts`
- User profile integration
- Consistent scoring between local and cloud

### UI Components

**`LocalJobScoring.tsx`** - Main component:
- AI availability checking
- Privacy messaging
- Job extraction via content script
- State management and error handling

**`LocalJobScoringStream.tsx`** - Streaming display:
- Real-time score updates
- Character-by-character description rendering
- Score color coding (green ≥8, blue ≥6, gray <6)
- Stream completion detection with React refs

### Saving to Database

Local scores are saved directly to Convex without cloud re-scoring:

```typescript
// convex/jobScraping.ts - createManualLinkedinJob mutation
args: {
  job: v.object({
    aiScore: v.optional(v.number()),
    aiDescription: v.optional(v.string()),
    // ... other fields
  }),
}
```

**Flow:**
1. Local scoring completes → results stored in state
2. User clicks "Save to ApplyFast" → job saved with local score
3. User clicks "Re-score" → component resets for new evaluation

### Shared Modules

**LinkedIn Parser** (`shared/linkedin.ts`) - Used by:
- Content script for job extraction
- Local AI scoring for prompt building
- Manual job capture in side panel

## Testing

**Quick Test:**
1. Install Chrome Canary/Dev/Beta (127+)
2. Enable `chrome://flags/#prompt-api-for-gemini-nano` + restart
3. Load extension in `chrome://extensions/` (Developer mode)
4. Navigate to LinkedIn job page
5. Open side panel → click "💡 Try Local AI Scoring"
6. Click "Score Using Local Model"
7. Watch streaming updates in real-time
8. Click "Save to ApplyFast" or "Re-score"

**Verify:**
- AI availability check shows "Local AI Available"
- Score streams character-by-character
- Final score appears with color coding
- Saved jobs show up in dashboard with local score

## Privacy & Security

**100% On-Device Processing:**
- Zero job data sent to external AI servers
- Chrome's Gemini Nano runs entirely locally
- User profile stays in browser
- Only saved jobs sync to Convex (no AI scoring involved)

**Data Flow:**
1. Job extracted from LinkedIn (browser content script)
2. User profile fetched from Convex (authenticated)
3. Scoring prompt built locally
4. AI inference runs on-device (Gemini Nano)
5. Results stream to side panel UI
6. Optional: Job + local score saved to Convex

## Known Limitations

**Browser Support:**
- Chrome Canary/Dev/Beta only (127+)
- Experimental API (origin trial phase)
- ~1GB model download on first use
- API may change before stable release

**Scoring Differences:**
- Local scores may differ from cloud scores (different models)
- Non-deterministic: re-scoring may produce different results
- First score slower (session initialization)
- Performance varies by device hardware

## References

- [Chrome Built-in AI Docs](https://developer.chrome.com/docs/ai/built-in)
- [Prompt API for Gemini Nano](https://developer.chrome.com/docs/ai/built-in-apis)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
