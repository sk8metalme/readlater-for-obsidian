# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the "readlater-for-obsidian" project - a React-based JavaScript application using npm as the package manager with Node.js 18.x.

## Development Commands

Based on the project settings, use these commands for development:

- **Development server**: `npm run dev`
- **Build**: `npm run build` 
- **Test**: `npm test`
- **Lint**: `npm run lint`
- **Install dependencies**: `npm install`

## Architecture

The project follows a structured agent-based development workflow with specialized agents for different development phases:

### Agent System
- **test-developer**: TDD-focused development with strict Red-Green-Refactor cycles
- **analyzer-pj**: Project analysis and architecture insights
- **developer**: General development tasks
- **manager-pj**: Project planning and timeline management
- **design-expert**: UI/UX design guidance
- **manager-doc**: Documentation management
- **review-cq**: Code quality reviews
- **manager-agent**: Team coordination and resource allocation

### Workflow Commands
- **req**: Executes complete development workflow loop (planning → implementation → review → testing → documentation → PR creation)
- **pr**: Creates pull requests using gh command

### Development Workflow
The project uses an automated workflow loop that continues until user stops:
1. Project planning
2. Internal review and design
3. Test design and TDD development
4. Code review and documentation
5. PR creation with CI validation
6. Progress tracking and next task determination

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