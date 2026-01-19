# XMTP General Store Agent

A conversational commerce bot built with the [XMTP Agent SDK](https://github.com/xmtp/agent-sdk) that demonstrates interactive messaging experiences on XMTP's decentralized messaging network.

## Overview

This project showcases how to build an interactive shopping experience entirely within a chat interface using XMTP's inline actions (XIP-67). Users can browse products, add items to their cart, and complete orders through clickable buttons - no external UI required.

### Key Features

- 🛍️ **Interactive Product Catalog** - Browse products with emoji representations
- 🛒 **Shopping Cart Management** - Add, view, and clear items from your cart
- ✅ **Order Confirmation Flow** - Safe checkout with confirmation dialogs
- 📱 **Pure Chat Interface** - Entire shopping experience happens in-chat with no external links
- 🔄 **Stateful Conversations** - Maintains separate shopping carts per conversation
- 🎨 **Custom Content Types** - Implements XIP-67 Actions and Intents for rich interactions

## Prerequisites

- Node.js >= 20
- pnpm package manager
- An Ethereum wallet with private key (for XMTP agent identity)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd test-xmtp
```

2. Install dependencies:
```bash
pnpm install
```

3. Create environment configuration:
```bash
cp .env.example .env
```

4. Configure your `.env` file:
```env
XMTP_ENV="production"              # or "dev" or "local"
XMTP_WALLET_KEY="0x..."           # Your wallet's private key
XMTP_FORCE_DEBUG="false"          # Set to "true" for verbose logs
XMTP_DB_ENCRYPTION_KEY=""         # Optional: 32-byte hex string for DB encryption
RAILWAY_VOLUME_MOUNT_PATH="."     # Or "/app/data/" for Railway deployment
```

## Usage

### Development Mode

Run with hot reload for development:
```bash
pnpm dev
```

### Production Mode

Build and run the compiled version:
```bash
pnpm build
pnpm start
```

### Generate Keys

Generate a new wallet and XMTP keys:
```bash
pnpm gen:keys
```

## How It Works

### Agent Architecture

The agent runs continuously, listening for messages on the XMTP network. When initialized:

1. Creates a local encrypted database for message persistence
2. Registers custom content type codecs (Actions, Intents, Markdown)
3. Sets up middleware to handle interactive button clicks
4. Listens for incoming messages and responds with interactive menus

### Inline Actions Flow

The bot uses XMTP's XIP-67 specification for inline actions:

1. **Agent sends Actions** - Presents buttons to the user
   ```
   🏪 Welcome to General Store!
   [🧴 Deodorant] [🪥 Toothbrush] [🛒 View Cart]
   ```

2. **User clicks button** - Sends an Intent message back to the agent

3. **Agent handles Intent** - Executes the registered handler for that action

4. **Agent responds** - Sends confirmation and next set of actions

### State Management

- **Shopping Carts**: Stored in-memory per conversation ID
- **Message History**: Persisted to local SQLite database
- **First-Time Messages**: Tracks which conversations have seen welcome message

**Note**: In-memory state (carts) is cleared on restart. For production, implement database-backed state.

## Project Structure

```
test-xmtp/
├── src/
│   ├── index.ts                    # Main agent entry point
│   └── utils/
│       ├── general.ts              # Environment utilities
│       └── inline-actions/         # XIP-67 Actions framework
│           ├── index.ts            # Action registry and middleware
│           └── types/
│               ├── action-content.ts   # Actions codec
│               └── intent-content.ts   # Intent codec
├── dist/                           # Compiled JavaScript output
├── .env.example                    # Environment template
├── biome.jsonc                     # Biome formatter/linter config
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Dependencies and scripts
```

## Interactive Actions Framework

This project includes a custom framework (`src/utils/inline-actions/`) for building interactive chat experiences:

### ActionBuilder

Create interactive menus easily:

```typescript
await ActionBuilder.create("menu-id", "Choose an option:")
  .add("option-1", "Option 1", "primary")
  .add("option-2", "Option 2", "secondary")
  .add("cancel", "Cancel", "danger")
  .send(ctx)
```

### Action Handlers

Register handlers for user interactions:

```typescript
registerAction("option-1", async (ctx) => {
  await ctx.sendText("You selected Option 1!")
  // Show next menu...
})
```

### Confirmation Pattern

Safe confirmations for destructive actions:

```typescript
await sendConfirmation(
  ctx,
  "Are you sure?",
  async (ctx) => {
    // Handle "Yes"
  },
  async (ctx) => {
    // Handle "No" (optional)
  }
)
```

## Development

### Code Quality

The project uses Biome for formatting and linting:

```bash
# Format and lint with auto-fix
pnpm check

# Format only
pnpm format

# Type check
pnpm typecheck
```

### Code Style

- **Formatter**: Biome (not Prettier)
- **Indentation**: Tabs
- **Quotes**: Double quotes
- **Module System**: ESM (ES Modules)
- **Imports**: Auto-organized on save

## Testing the Agent

1. Start the agent with `pnpm dev`
2. Note the agent's address in the console output
3. Use an XMTP client to message the agent:
   - [Converse](https://converse.xyz/) (mobile)
   - [XMTP Inbox](https://dev.xmtp.org/inbox) (web)
4. Send any message to trigger the welcome menu
5. Click buttons to interact with the store

## Technologies Used

- **[XMTP Agent SDK](https://github.com/xmtp/agent-sdk)** - Decentralized messaging infrastructure
- **TypeScript** - Type-safe development
- **Biome** - Fast formatter and linter
- **tsx** - TypeScript execution with hot reload
- **pnpm** - Fast, disk-efficient package manager

## Deployment

### Railway

This project is configured for deployment on Railway:

1. Set `RAILWAY_VOLUME_MOUNT_PATH="/app/data/"` in Railway environment
2. Create a volume mounted at `/app/data/` for persistent database storage
3. Deploy from GitHub repository

### Other Platforms

The agent can run anywhere Node.js is supported. Ensure:
- Persistent storage for the `.db3` database file
- Environment variables are properly set
- Port configuration if needed (agent doesn't expose HTTP by default)

## Common Issues

### "Agent failed to start"

- Verify `XMTP_WALLET_KEY` is a valid hex private key with `0x` prefix
- Check that `XMTP_ENV` is set to a valid environment
- Ensure Node.js version is >= 20

### Database errors

- Verify write permissions in the directory
- Check that `XMTP_DB_ENCRYPTION_KEY` is consistent between restarts (if used)
- Ensure sufficient disk space

### Messages not received

- Confirm the agent is running (check console for "Agent is running...")
- Verify you're messaging the correct agent address
- Check that your XMTP client is on the same network (dev/production)

## Resources

- [XMTP Documentation](https://xmtp.org/docs)
- [XMTP Agent SDK](https://github.com/xmtp/agent-sdk)
- [XIP-67: Inline Actions](https://github.com/xmtp/XIPs/blob/main/XIPs/xip-67-inline-actions.md)
- [XMTP Content Types](https://xmtp.org/docs/build/messages)

## License

ISC
