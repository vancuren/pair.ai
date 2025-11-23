# Pair.AI ✨ 

> Meet your new AI pair programmer — inside a familiar, Google-Meets-style chat room.

**Pair.AI** reimagines collaborative coding by bringing AI pair programming into a natural, conversational interface. Just talk naturally, share your screen, explain your idea, or point at the code you're stuck on. No more context switching between your IDE and a chatbot.

## Problem Statement

**Statement Three: Collaborative Code Generation Tooling**

Coding with AI shouldn't be a solo activity. How can we build collaborative environments where humans and AI co-develop, review, and deploy software together in real time, supporting both human-to-human and human-to-AI interactions? How can AI tools integrate seamlessly into existing team workflows to optimize live collaboration and collective problem-solving?

## Solution

Pair.AI creates a **real-time collaborative coding environment** that feels as natural as a video call with a colleague. Instead of copying code snippets into a chat window, you:

- **Share your screen** — The AI sees exactly what you see
- **Talk naturally** — "Hey, this function is slow. Can we optimize it?"
- **Connect repositories** — AI can read files, understand context, and create pull requests automatically
- **Get spoken responses** — The AI talks back, making the interaction feel truly collaborative

### Key Features

#### **Screen Share Mode**
- Share your entire screen or a specific window
- AI analyzes your code visually using Gemini's vision capabilities
- Point at code, explain problems, or ask questions naturally
- Perfect for debugging, code reviews, and pair programming sessions

#### **GitHub Integration**
- Connect any GitHub repository with a personal access token
- AI can:
  - Browse your file structure
  - Read and understand your codebase
  - Make intelligent changes
  - Automatically create pull requests with fixes
- Example: *"Fix the bug in `src/utils.ts`"* → AI reads the file, identifies the issue, fixes it, and opens a PR

#### **Voice-First Interaction**
- **Speech-to-Text**: Talk naturally using your browser's Web Speech API
- **Text-to-Speech**: AI responds with natural voice using Gemini's TTS
- Real-time conversation flow — no typing required
- Visual indicators show when AI is listening, thinking, or speaking

#### **Chat Sidebar**
- Full conversation history
- Type or speak your messages
- See system messages when AI is reading files or creating PRs
- Toggle sidebar on/off for a cleaner view

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- A [Google Gemini API key](https://makersuite.google.com/app/apikey)
- (Optional) A GitHub Personal Access Token for repository integration

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd pair.ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   API_KEY=your_gemini_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to `http://localhost:5173` (or the port shown in your terminal)

## 📖 Usage Examples

### Screen Share Mode

1. Click **"Present Screen"** in the control bar
2. Select the window or screen you want to share
3. Click the microphone button to start voice input
4. Say something like:
   - *"Can you explain what this function does?"*
   - *"This code looks inefficient. Can we optimize it?"*
   - *"I'm getting an error here. What's wrong?"*

The AI will analyze your screen and respond with both visual and spoken feedback.

### GitHub Mode

1. Click **"Connect Repo"** in the control bar
2. Enter your repository details:
   - Repository owner (username or org)
   - Repository name
   - GitHub Personal Access Token (with `repo` scope)
3. Click **"Connect"**
4. Start talking:
   - *"Show me all the files in this repo"*
   - *"Read the file `src/App.tsx`"*
   - *"Fix the bug in `utils/helpers.ts`"*
   - *"Add error handling to the login function"*

The AI will:
- List files when asked
- Read specific files to understand context
- Make intelligent code changes
- Automatically create a pull request with the fix

### Example Workflow

```
You: "Fix the bug in src/components/Button.tsx"

AI: [System] Reading src/components/Button.tsx...
     [System] Creating PR for src/components/Button.tsx...
     "I've identified and fixed the issue. I've created a pull request. 
      You can review it here: https://github.com/owner/repo/pull/123"
```

## 🏗️ Architecture

### Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **AI**: Google Gemini 2.5 Flash (with vision and TTS)
- **Voice**: Web Speech API (Speech Recognition)
- **Audio**: Web Audio API
- **GitHub**: GitHub REST API

### Key Components

- **`App.tsx`**: Main application orchestrator
- **`ChatSidebar.tsx`**: Chat interface with message history
- **`ControlBar.tsx`**: Bottom control panel (mic, screen share, GitHub, chat toggle)
- **`GitHubModal.tsx`**: Repository connection dialog
- **`services/geminiService.ts`**: AI integration with function calling
- **`services/githubService.ts`**: GitHub API operations (file tree, read file, create PR)

### AI Function Calling

The AI uses Gemini's function calling capabilities to interact with GitHub:

1. **`list_files`**: Get repository file structure
2. **`read_file`**: Read file contents
3. **`create_pull_request`**: Create a PR with code changes

The system handles recursive tool calls automatically — if you ask to fix a bug, the AI will:
1. List files to find the right one
2. Read the file to understand the code
3. Generate a fix
4. Create a pull request

## 🎨 Design Philosophy

Pair.AI is designed to feel like a **video call with a colleague**, not a chatbot:

- **Visual presence**: AI participant overlay shows when it's listening, thinking, or speaking
- **Natural conversation**: Voice-first interaction with minimal friction
- **Context awareness**: Screen sharing or repository connection provides full context
- **Real-time feedback**: Visual and audio indicators keep you informed
- **Familiar UI**: Google Meets-inspired interface that feels instantly recognizable

## 🔒 Security & Privacy

- **API Keys**: Stored locally in environment variables, never committed
- **Screen Sharing**: Uses browser's native `getDisplayMedia` API — all processing happens client-side
- **GitHub Tokens**: Stored in memory only, never persisted
- **No Data Collection**: All processing happens through Google's Gemini API — we don't store your conversations

## 🚧 Limitations & Future Work

### Current Limitations

- GitHub integration requires manual token entry (no OAuth flow)
- Single file edits per PR (multi-file changes coming soon)
- No persistent conversation history across sessions
- Screen share mode works best with code editors (may struggle with complex UIs)

### Planned Features

- **Multi-file PRs**: Edit multiple files in a single pull request
- **GitHub OAuth**: Seamless repository connection without manual tokens
- **Team Collaboration**: Multiple developers in the same session
- **Code Review Mode**: AI reviews existing PRs and suggests improvements
- **Visual Diff Preview**: See changes before creating PRs
- **Breakpoint Debugging**: AI can set breakpoints and step through code
- **Test Generation**: Automatically generate tests for code changes
- **Multi-agent Collaboration**: Multiple AI agents working together on complex tasks

## 🎯 Hackathon Highlights

This project addresses the hackathon problem statement by:

✅ **Real-time Collaboration**: Voice and visual interaction creates a true pair programming experience

✅ **Seamless Integration**: Works with existing GitHub workflows — no new tools to learn

✅ **Automated PR Creation**: AI can read, understand, fix, and deploy code changes automatically

✅ **Human-AI Interaction**: Natural conversation flow makes AI feel like a team member

✅ **Multi-modal Context**: Screen sharing + voice + repository access provides comprehensive context

## 📝 License

MIT License — feel free to use this project for your own hackathons and experiments!

## 🙏 Acknowledgments

- Built with [Google Gemini](https://deepmind.google/technologies/gemini/)
- Inspired by the collaborative nature of pair programming
- Designed for hackathon: **Statement Three: Collaborative Code Generation Tooling**

---

**Made with ❤️ for collaborative coding**
