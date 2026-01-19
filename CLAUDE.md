# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an XMTP Agent SDK application that demonstrates building conversational commerce experiences using XMTP's decentralized messaging network. The project implements a "General Store" bot that allows users to browse products, manage a shopping cart, and complete orders through interactive messaging.

## Build & Development Commands

### Development
- `pnpm dev` - Run the agent in development mode with hot reload (uses `tsx watch`)
- `pnpm start` - Run the compiled agent from `dist/`

### Build & Type Checking
- `pnpm build` - Compile TypeScript to JavaScript (outputs to `dist/`)
- `pnpm build:watch` - Compile TypeScript in watch mode
- `pnpm typecheck` - Run TypeScript type checking without emitting files

### Code Quality
- `pnpm check` - Run Biome linter and formatter with auto-fix
- `pnpm format` - Format code in `src/` using Biome
- `pnpm format:check` - Format and check code in `src/`

### Utilities
- `pnpm gen:keys` - Generate XMTP agent keys (builds first, then runs key generation utility)

## Environment Setup

Required environment variables (see `.env.example`):
- `XMTP_ENV` - Environment: "local", "dev", or "production"
- `XMTP_WALLET_KEY` - Private key of the wallet (hex format with 0x prefix)
- `XMTP_FORCE_DEBUG` - Set to "true" for detailed debugging logs
- `XMTP_DB_ENCRYPTION_KEY` - (Optional) 32-byte encryption key for local database
- `RAILWAY_VOLUME_MOUNT_PATH` - Custom database path (use "/app/data/" for Railway deployment)

## Architecture

### Core Components

#### Agent System (`src/index.ts`)
The main entry point initializes an XMTP Agent with custom codecs and event handlers. The agent:
- Creates a persistent local database at a path determined by `dbPath()` function
- Registers custom content type codecs (Actions, Intent, Markdown)
- Uses middleware pattern for message processing
- Maintains conversation-scoped state (orders, hackathon message tracking)

#### Inline Actions System (`src/utils/inline-actions/`)
A custom framework for building interactive button-based UIs in XMTP messages, following the XIP-67 specification.

**Key concepts:**
- **Actions**: Interactive buttons sent to users (defined in `types/action-content.ts`)
- **Intents**: User responses when clicking buttons (defined in `types/intent-content.ts`)
- **Action Registry**: Global map storing action ID → handler function mappings
- **Middleware**: `inlineActionsMiddleware` intercepts intent messages and routes them to registered handlers

**ActionBuilder Pattern:**
```typescript
ActionBuilder.create("menu-id", "Description")
  .add("action-id", "Button Label", "style")
  .send(ctx)
```

**Helper Functions:**
- `registerAction(id, handler)` - Register an action handler
- `sendActions(conversation, content)` - Send actions to a conversation
- `sendConfirmation(ctx, message, onYes, onNo)` - Show yes/no confirmation
- `sendSelection(ctx, message, options)` - Show multiple choice menu
- `showMenu(ctx, config, menuId)` - Display a pre-configured menu

#### Content Type Codecs
Custom XMTP content types for rich messaging:

1. **ActionsCodec** (`types/action-content.ts`):
   - Encodes/decodes interactive button menus
   - Validates max 10 actions per message
   - Validates max 50 characters per label
   - Supports action styles: "primary", "secondary", "danger"
   - Supports expiration timestamps (ISO-8601)

2. **IntentCodec** (`types/intent-content.ts`):
   - Encodes/decodes user button click responses
   - Contains action ID and parent actions ID

3. **MarkdownCodec** (from `@xmtp/content-type-markdown`):
   - Used for formatted text content

### State Management

The application uses in-memory Maps for conversation-scoped state:
- `orders: Map<conversationId, Product[]>` - Shopping cart per conversation
- `hackathonMessageSent: Set<conversationId>` - Track first-time message delivery

**Important:** State is not persisted between restarts. The XMTP database handles message persistence only.

### Database Path Convention
The `dbPath()` function generates database filenames as:
```
{XMTP_ENV}-{inboxId.slice(0,8)}.db3
```
Stored in `RAILWAY_VOLUME_MOUNT_PATH` if set, otherwise current directory.

## Code Style

This project uses **Biome** (not Prettier/ESLint) for formatting and linting:
- Tab indentation
- Double quotes
- Organized imports on save
- Extends `ultracite/core` configuration
- See `biome.jsonc` for full configuration

**Important Biome rules:**
- `noParameterAssign: error` - Don't reassign function parameters
- `useAsConstAssertion: error` - Use `as const` for literal types
- `noInferrableTypes: error` - Don't add redundant type annotations
- `indentStyle: tab` - Use tabs, not spaces

## XMTP Agent SDK Patterns

### Agent Initialization
```typescript
const agent = await Agent.createFromEnv({
  dbPath,  // Function that returns path based on inboxId
  codecs,  // Array of ContentCodec instances
})
```

### Event Handlers
- `agent.on("text", handler)` - Handle incoming text messages
- `agent.on("start", handler)` - Handle agent startup
- Custom content types trigger specific handlers via middleware

### Middleware Pattern
Middleware functions receive `(ctx, next)` and can:
- Inspect message content type
- Handle specific content types (return early)
- Call `next()` to continue to next middleware/handler

### Message Context (`MessageContext<T>`)
Provides:
- `ctx.message` - The received message
- `ctx.conversation` - Conversation object for sending replies
- `ctx.sendText(text)` - Helper to send text messages
- `ctx.conversation.send(content, contentType)` - Send custom content types

## Common Development Patterns

### Adding New Product Categories
1. Add products to the `products` array in `main()`
2. Action handlers are auto-registered in the loop at lines 130-156
3. No additional registration needed - the pattern is dynamic

### Creating New Action Flows
1. Register handler: `registerAction("action-id", async (ctx) => { ... })`
2. Send actions to user: `await ActionBuilder.create(...).add(...).send(ctx)`
3. Handle user response in the registered handler

### Confirmation Pattern
Use `sendConfirmation()` for destructive actions:
```typescript
await sendConfirmation(ctx, "Are you sure?", async (ctx) => {
  // Handle yes
}, async (ctx) => {
  // Optional: Handle no (defaults to "Cancelled")
})
```

### Navigation After Actions
After completing an action, provide navigation options using ActionBuilder to guide users to their next action (see lines 144-153 for example).

## TypeScript Configuration

- Target: ES6
- Module: NodeNext (ESM)
- Strict mode enabled
- Source maps enabled
- Output directory: `dist/`
- Unused locals/parameters/returns all flagged as errors
