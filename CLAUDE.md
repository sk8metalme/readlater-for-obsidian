# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the "readlater-for-obsidian" project - a Chrome Extension (Manifest V3) that saves web articles to Obsidian with AI summarization powered by Claude CLI via Native Messaging. Built with vanilla JavaScript and npm as the package manager with Node.js 18.x.

### Key Technologies
- **Chrome Extension MV3**: Service Worker-based architecture
- **Native Messaging**: Chrome ↔ Native Host communication for file system access
- **Claude CLI**: Local AI processing for summarization and keyword extraction
- **Test Framework**: Jest for unit and integration testing

### Core Features
- **Article Extraction**: Automatic web article content extraction
- **AI Summarization**: Claude CLI-powered article summarization (structured, bullet, paragraph styles)
- **Aggregated Saving**: Multiple articles in a single Markdown file with table-of-contents
- **Individual Saving**: Each article as a separate Markdown file
- **Slack Notifications**: Optional webhook notifications for saved articles
- **Native File System Access**: Direct file writing via Native Messaging (no Downloads API limitations)

## Development Commands

Based on the project settings, use these commands for development:

- **Development server**: `npm run dev`
- **Build**: `npm run build` 
- **Test**: `npm test`
- **Lint**: `npm run lint`
- **Install dependencies**: `npm install`

## Architecture

### Chrome Extension Architecture (MV3)
The project follows Chrome Extension Manifest V3 architecture:

**Service Worker** (`src/background/service-worker.js`):
- Context menu management
- Article processing orchestration
- Native Messaging communication
- File saving coordination (Downloads API or Native Host)
- Slack notification integration

**Content Script** (`src/content/content-script.js`):
- Article content extraction from web pages
- DOM manipulation and analysis
- Message passing to Service Worker

**Options Page** (`src/options/`):
- User preferences management
- Claude CLI connection testing
- Settings persistence via chrome.storage.sync

### Native Messaging Architecture
```
Chrome Extension → Native Messaging → claude_host.js → Claude CLI
```

**Native Host** (`native_host/claude_host.js`):
- Receives JSON messages from Chrome extension
- Executes Claude CLI commands
- Handles file system operations (read/write)
- Returns processed results

**Communication Protocol**:
- `check`: Verify Native Host availability
- `summarize`: Generate article summary
- `keywords`: Extract keywords from text
- `readFile`: Read file from disk
- `writeFile`: Write file to disk

### Data Flow
1. User clicks context menu on web page
2. Content Script extracts article data
3. Service Worker receives extracted data
4. Native Host processes AI tasks (summarization)
5. Service Worker saves to file (aggregated or individual)
6. Optional: Send Slack notification
7. User notification displayed

## Code Standards

- **Indentation**: 2 spaces
- **Semicolons**: Required
- **Quotes**: Single quotes
- **Trailing commas**: Required
- **Max line length**: 100 characters

## Git Workflow

- **Protected branches**: main, master, production
- **Commit message template**: `[type]: brief description` with detailed changes
- **Pull requests**: Required for all changes
- **Auto-staging**: Disabled - manual git add required

## Security

- Secret commit prevention enabled
- Dependency scanning active
- Code review required for all changes