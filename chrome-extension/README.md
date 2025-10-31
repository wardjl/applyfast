# ApplyFast Chrome Extension

## Score Jobs Locally with Chrome's Built-in AI

The ApplyFast Chrome extension brings **Gemini Nano** directly to your browser for completely private, on-device job scoring. Browse LinkedIn jobs and score them instantly using local AI—no data leaves your machine.

Connect to the **applyfa.st backend** to sync your jobs and preferences. No backend setup required!

---

## Prerequisites (IMPORTANT!)

Before installing the extension, ensure you meet these requirements:

### Required Chrome Version
- **Chrome Canary** ([Download](https://www.google.com/chrome/canary/))
- **Chrome Dev** ([Download](https://www.google.com/chrome/dev/))
- **Chrome Beta** ([Download](https://www.google.com/chrome/beta/))
- Minimum version: **127+**

**Standard Chrome (Stable) does not support Chrome AI yet.** You must use Canary, Dev, or Beta.

### Required Chrome Flags

1. Navigate to: `chrome://flags/#prompt-api-for-gemini-nano`
2. Set to: **"Enabled"**
3. **Restart Chrome** (required for flag to take effect)

### Gemini Nano Model Download

- **Size:** ~1GB (one-time download)
- **Download:** Automatic on first use
- **Time:** ~5 minutes depending on connection
- **Storage:** Uses Chrome's built-in model storage

You'll see "Model downloading..." on first scoring attempt. This is normal and only happens once!

---

## Installation (Quick Start)

### Step 1: Configure Environment

Create a `.env` file in the `chrome-extension` directory:

```bash
cd chrome-extension
cp .env.example .env
```

**Use the official applyfa.st backend** (no setup required):

```env
# Official ApplyFast server - ready to use!
VITE_CONVEX_URL=https://acoustic-ermine-73.convex.cloud

# Web app URL
VITE_WEB_APP_URL=https://applyfa.st
```

### Step 2: Build the Extension

```bash
# Install dependencies and build
npm install
npm run build
```

The extension will be built to `chrome-extension/dist/`

### Step 3: Load Extension in Chrome

1. **Open Chrome Extensions Page**
   - Navigate to: `chrome://extensions/`
   - Or: Menu → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle switch in **top-right corner**

3. **Load Unpacked Extension**
   - Click **"Load unpacked"** button
   - Navigate to: `[your-project-path]/chrome-extension/dist`
   - Select the `dist` folder
   - Click **"Select Folder"** (or "Open" on Mac)

4. **Verify Installation**
   - ApplyFast icon should appear in extension toolbar
   - Extension card shows "ApplyFast" with version number
   - No errors in the extension card

### Step 4: Pin Extension (Optional but Recommended)

1. Click the **puzzle piece icon** in Chrome toolbar
2. Find **ApplyFast** in the list
3. Click the **pin icon** to keep it visible

---

## Verify Installation

### Test Chrome AI Availability

1. Open Chrome DevTools Console (F12)
2. Run this command:
   ```javascript
   const availability = await LanguageModel.availability();
   ```
3. Expected output: `"readily"` or `"after-download"`
   - `"readily"` = Gemini Nano is ready
   - `"after-download"` = Model will download on first use
   - `"no"` or `undefined` = Check prerequisites

### Test Extension Functionality

1. **Click the ApplyFast icon** in your toolbar
2. **Side panel opens** on the right side of your browser
3. **Sign in** with your ApplyFast credentials
4. **Verify connection:** You should see your jobs or a "Get Started" message

### Test Local AI Scoring

1. Navigate to any **LinkedIn job posting**
   - Example: [https://www.linkedin.com/jobs/](https://www.linkedin.com/jobs/)
2. A **floating "Score with AI" button** appears on the page
3. Click the button
4. Side panel opens with **streaming score updates** (80-120 chunks)
5. View score, explanation, and requirement checks

---

## How to Use

### Browsing Jobs in Side Panel

1. **Open side panel** by clicking the ApplyFast extension icon
2. **View all scraped jobs** with AI scores from your web dashboard
3. **Filter jobs:**
   - Minimum AI score slider
   - Date range picker
   - Location filter
   - Keyword search
4. **Click any job** to see full details
5. **Apply on LinkedIn** via direct link

### Scoring Jobs on LinkedIn

1. **Browse LinkedIn** as you normally would
2. **Floating button appears** on job postings
3. **Click to score locally** with Gemini Nano
4. **Watch streaming updates** as AI analyzes the job
5. **Save to dashboard** with one click (syncs to web app)

---

## Features

### Local AI Scoring
- **On-Device Processing** - Gemini Nano runs entirely in your browser
- **Real-Time Streaming** - Watch scores update as AI analyzes jobs
- **Complete Privacy** - No data sent to external servers
- **Smart Matching** - AI adapts to your job preferences and requirements
- **Detailed Explanations** - Understand why jobs match your profile

### Job Browsing
- **Side Panel UI** - Browse all your jobs without leaving LinkedIn
- **Smart Filters** - Filter by AI score, date, location, company, keywords
- **Quick Apply** - Direct links to apply on LinkedIn
- **Auto Sync** - Jobs sync automatically between extension and web app
- **Floating Button** - Score any LinkedIn job with one click

---

## Tech Stack

Built with modern web technologies:

- **Frontend:** React 18 + TypeScript + Vite
- **Extension:** Chrome Manifest V3 with @crxjs/vite-plugin
- **Backend:** Convex (real-time database and auth)
- **UI:** Shadcn UI + Tailwind CSS
- **Local AI:** Chrome's built-in Gemini Nano via Prompt API

---

## Troubleshooting

### Model Downloading...

**Symptom:** "Model downloading..." message on first scoring attempt

**This is normal!** Gemini Nano (~1GB) downloads on first use.

**What to do:**
1. Wait 5-10 minutes (depends on connection)
2. Keep Chrome open during download
3. Check progress in Chrome Task Manager (Shift+Esc)
4. After download completes, try scoring again

**Status Check:**
```javascript
await window.ai.languageModel.capabilities()
// { available: "readily" } = Downloaded and ready
```

---

## How It Works

```
LinkedIn Job Page
       ↓
   [Score Job]  ← Click floating button
       ↓
  Gemini Nano   ← AI runs locally in your browser
       ↓
  Score + Explanation
       ↓
  ApplyFast Backend  ← Syncs to dashboard
       ↓
   Web App + Extension  ← View everywhere
```

**Simple Flow:**
1. Browse LinkedIn and find a job you like
2. Click the floating "Score with AI" button
3. Watch the AI analyze the job in real-time (on your device!)
4. Review the score, explanation, and requirement matches
5. Save to your dashboard or apply directly

---

## Additional Resources

- **[Chrome Built-in AI Documentation](https://developer.chrome.com/docs/ai/built-in)** - Learn about Gemini Nano
- **[Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)** - Extension development guide
- **[ApplyFast Web App](https://applyfa.st)** - Main dashboard

---

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

Built with ❤️ for the Google Chrome Built-in AI Challenge
