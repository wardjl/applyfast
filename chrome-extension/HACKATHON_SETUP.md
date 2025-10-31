# ApplyFast Chrome Extension - Hackathon Judge Setup

## Quick Start (5 minutes)

### Prerequisites
- Chrome Canary, Dev, or Beta (version 127+) with Gemini Nano enabled
- Node.js installed

### 1. Clone and Setup
```bash
git clone https://github.com/wardjl/applyfast.git
cd applyfast
npm install
cd chrome-extension
```

### 2. Configure Environment
```bash
cp .env.example .env
```
**Note:** The `.env.example` already contains the official ApplyFast backend URLs - no changes needed!

### 3. Build Extension
```bash
npm install
npm run build
```

### 4. Load in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `chrome-extension/dist` folder
5. Click "Select Folder"

### 5. Setup Account (Web App)
1. Visit https://applyfa.st/login in a new tab
2. Click "Create Account" and sign up
3. Complete the onboarding (import LinkedIn profile + answer 5 questions)

### 6. Setup Extension
1. Return to the extension icon in your toolbar
2. Click the ApplyFast icon to open the side panel
3. Login with your ApplyFa.st account
4. Pin the extension for easy access

### 7. Test Local AI Job Scoring
1. Visit any LinkedIn job posting
2. Click the floating "Match" button
3. Watch Gemini Nano score the job locally in real-time
4. View detailed score, explanation, and requirement matches

## Demo Flow
1. **Browse LinkedIn jobs** as you normally would
2. **Score jobs locally** with Gemini Nano
3. **View all scored jobs** in the extension side panel
4. **Apply directly** via LinkedIn links

## Troubleshooting
- If you see "Model downloading..." - wait 5 minutes for Gemini Nano (~1GB)
- Extension not working? Check Chrome version and Gemini Nano flag
- Backend issues? The official ApplyFast backend should work out-of-the-box

