import type {
	AgentMiddleware,
	Conversation,
	MessageContext,
} from "@xmtp/agent-sdk";
import {
	type Action,
	type ActionsContent,
	ContentTypeActions,
} from "./types/action-content.js";
import type { IntentContent } from "./types/intent-content.js";

// Core types
export type ActionHandler<T = unknown> = (
	ctx: MessageContext<T>
) => Promise<void>;

// Action registry - using unknown to accept handlers for any content type
const actionHandlers = new Map<string, ActionHandler<unknown>>();

// Track the last sent action message for reply functionality
let lastSentActionMessage: unknown = null;

// Track the last shown menu for automatic navigation
let lastShownMenu: { config: AppConfig; menuId: string } | null = null;

export function registerAction<T = unknown>(
	actionId: string,
	handler: ActionHandler<T> | ((ctx: MessageContext<T>) => Promise<void>)
): void {
	// Prevent overwriting existing handlers unless explicitly intended
	if (actionHandlers.has(actionId)) {
		console.warn(`⚠️ Action ${actionId} already registered, overwriting...`);
	}
	actionHandlers.set(actionId, handler as ActionHandler<unknown>);
}

// Get the last sent action message for reply functionality
export function getLastSentActionMessage(): unknown {
	return lastSentActionMessage;
}

// Clear all registered actions (useful for debugging)
export function clearAllActions(): void {
	actionHandlers.clear();
	console.log("🧹 Cleared all registered actions");
}

// Show the last shown menu
export async function showLastMenu<T = unknown>(
	ctx: MessageContext<T>
): Promise<void> {
	if (lastShownMenu) {
		console.log(`🔄 Showing last menu: ${lastShownMenu.menuId}`);
		await showMenu(ctx, lastShownMenu.config, lastShownMenu.menuId);
	} else {
		console.warn("⚠️ No last menu to show, falling back to main menu");
		// Fallback to main menu if no last menu is tracked
		await ctx.sendText("Returning to main menu...");
	}
}

// Middleware - works with any content type
// Using any for the context parameter to allow compatibility with any agent content types
export const inlineActionsMiddleware = (async (
	ctx,
	next: () => Promise<void>
) => {
	if (ctx.message.contentType?.typeId === "intent") {
		const intentContent = ctx.message.content as IntentContent;
		const handler = actionHandlers.get(intentContent.actionId);

		console.log("🎯 Processing intent:", intentContent.actionId);

		if (handler) {
			try {
				await handler(ctx as MessageContext<unknown>);
			} catch (error) {
				console.error("❌ Error in action handler:", error);
				await ctx.sendText(
					`❌ Error: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		} else {
			await ctx.sendText(`❌ Unknown action: ${intentContent.actionId}`);
		}
		return;
	}
	await next();
}) as AgentMiddleware;

// Builder for creating actions
export class ActionBuilder {
	private actions: Action[] = [];
	private actionId = "";
	private actionDescription = "";

	static create(id: string, description: string): ActionBuilder {
		const builder = new ActionBuilder();
		builder.actionId = id;
		builder.actionDescription = description;
		return builder;
	}

	add(
		id: string,
		label: string,
		style?: "primary" | "secondary" | "danger"
	): this {
		this.actions.push({ id, label, style });
		return this;
	}

	build(): ActionsContent {
		return {
			id: this.actionId,
			description: this.actionDescription,
			actions: this.actions,
		};
	}

	async send<T = unknown>(ctx: MessageContext<T>): Promise<void> {
		const message = await ctx.conversation.send(
			this.build(),
			ContentTypeActions
		);
		lastSentActionMessage = message;
	}
}

// Helper functions
export async function sendActions(
	conversation: Conversation,
	actionsContent: ActionsContent
): Promise<void> {
	const message = await conversation.send(actionsContent, ContentTypeActions);
	lastSentActionMessage = message;
}

export async function sendConfirmation<T = unknown>(
	ctx: MessageContext<T>,
	message: string,
	onYes: ActionHandler<T> | ((ctx: MessageContext<T>) => Promise<void>),
	onNo?: ActionHandler<T> | ((ctx: MessageContext<T>) => Promise<void>)
): Promise<void> {
	const timestamp = Date.now();
	const yesId = `yes-${timestamp}`;
	const noId = `no-${timestamp}`;

	registerAction(yesId, onYes as ActionHandler<unknown>);
	registerAction(
		noId,
		(onNo ||
			(async (ctx) => {
				await ctx.sendText("❌ Cancelled");
			})) as ActionHandler<unknown>
	);

	await ActionBuilder.create(`confirm-${timestamp}`, message)
		.add(yesId, "✅ Yes")
		.add(noId, "❌ No", "danger")
		.send(ctx);
}

export async function sendSelection<T = unknown>(
	ctx: MessageContext<T>,
	message: string,
	options: Array<{
		id: string;
		label: string;
		style?: "primary" | "secondary" | "danger";
		handler: ActionHandler<T>;
	}>
): Promise<void> {
	const builder = ActionBuilder.create(`selection-${Date.now()}`, message);

	for (const option of options) {
		registerAction(option.id, option.handler);
		builder.add(option.id, option.label, option.style);
	}

	await builder.send(ctx);
}

// Validation helpers
export const validators = {
	inboxId: (input: string) => {
		const pattern = /^[a-fA-F0-9]{64}$/g;
		return pattern.test(input.trim())
			? { valid: true }
			: { valid: false, error: "Invalid Inbox ID format (64 hex chars)" };
	},

	ethereumAddress: (input: string) => {
		const pattern = /^0x[a-fA-F0-9]{40}$/g;
		return pattern.test(input.trim())
			? { valid: true }
			: {
					valid: false,
					error: "Invalid Ethereum address format (0x + 40 hex chars)",
				};
	},
};

// Common patterns
export const patterns = {
	inboxId: /^[a-fA-F0-9]{64}$/,
	ethereumAddress: /^0x[a-fA-F0-9]{40}$/,
};

// Additional types needed by index.ts
export type MenuAction<T = unknown> = {
	id: string;
	label: string;
	style?: "primary" | "secondary" | "danger";
	handler?: ActionHandler<T>;
	showNavigationOptions?: boolean;
};

export type Menu = {
	id: string;
	title: string;
	actions: MenuAction[];
};

export type AppConfig = {
	name: string;
	menus: Record<string, Menu>;
	options?: {
		autoShowMenuAfterAction?: boolean;
		defaultNavigationMessage?: string;
	};
};

// Utility functions needed by index.ts
export function getRegisteredActions(): string[] {
	return Array.from(actionHandlers.keys());
}

export async function showMenu<T = unknown>(
	ctx: MessageContext<T>,
	config: AppConfig,
	menuId: string
): Promise<void> {
	const menu = config.menus[menuId];
	if (!menu) {
		console.error(`❌ Menu not found: ${menuId}`);
		await ctx.sendText(`❌ Menu not found: ${menuId}`);
		return;
	}

	// Track the last shown menu
	lastShownMenu = { config, menuId };

	// Use a stable action ID without timestamp to prevent conflicts
	const builder = ActionBuilder.create(menuId, menu.title);

	for (const action of menu.actions) {
		builder.add(action.id, action.label, action.style);
	}

	await builder.send(ctx);
}

// Configurable navigation helper
export async function showNavigationOptions<T = unknown>(
	ctx: MessageContext<T>,
	config: AppConfig,
	message: string,
	customActions?: Array<{
		id: string;
		label: string;
		style?: "primary" | "secondary" | "danger";
	}>
): Promise<void> {
	// Check if auto-show menu is enabled (default: true for backward compatibility)
	const autoShowMenu = config.options?.autoShowMenuAfterAction !== false;

	if (!autoShowMenu) {
		// If auto-show is disabled, just send the message without showing menu
		await ctx.sendText(message);
		return;
	}

	// Use a stable action ID to prevent conflicts
	const navigationMenu = ActionBuilder.create("navigation-options", message);

	// Add custom actions if provided
	if (customActions) {
		for (const action of customActions) {
			navigationMenu.add(action.id, action.label, action.style);
		}
	} else {
		// Default navigation options - show all main menu items
		const mainMenu = config.menus["main-menu"];
		if (mainMenu) {
			for (const action of mainMenu.actions) {
				navigationMenu.add(action.id, action.label, action.style);
			}
		}
	}

	await navigationMenu.send(ctx);
}

export function initializeAppFromConfig(
	config: AppConfig,
	options?: {
		deferredHandlers?: Record<string, ActionHandler>;
	}
): void {
	console.log(`🚀 Initializing app: ${config.name}`);

	// Log configuration options
	if (config.options) {
		console.log("📋 App options:", config.options);
	}

	// Register all handlers from menu actions
	for (const menu of Object.values(config.menus)) {
		for (const action of menu.actions) {
			if (action.handler) {
				// Wrap handler to automatically show last menu if showNavigationOptions is true
				const wrappedHandler = async (ctx: MessageContext<unknown>) => {
					await action.handler?.(ctx);
					if (action.showNavigationOptions) {
						await showLastMenu(ctx);
					}
				};
				registerAction(action.id, wrappedHandler);
				console.log(
					`✅ Registered handler for action: ${action.id}${action.showNavigationOptions ? " (with auto-navigation)" : ""}`
				);
			}
		}
	}

	// Register any deferred handlers
	if (options?.deferredHandlers) {
		for (const [actionId, handler] of Object.entries(
			options.deferredHandlers
		)) {
			registerAction(actionId, handler);
			console.log(`✅ Registered deferred handler for action: ${actionId}`);
		}
	}

	// Auto-register menu navigation actions (for actions without handlers that match menu IDs)
	for (const menu of Object.values(config.menus)) {
		for (const action of menu.actions) {
			if (!action.handler && config.menus[action.id]) {
				// This action navigates to another menu
				registerAction(action.id, async (ctx: MessageContext<unknown>) => {
					await showMenu(ctx, config, action.id);
				});
				console.log(`✅ Auto-registered navigation for menu: ${action.id}`);
			}
		}
	}

	// Auto-register common navigation actions
	registerAction("main-menu", async (ctx: MessageContext<unknown>) => {
		await showMenu(ctx, config, "main-menu");
	});

	registerAction("help", async (ctx: MessageContext<unknown>) => {
		await showMenu(ctx, config, "main-menu");
	});

	registerAction("back-to-main", async (ctx: MessageContext<unknown>) => {
		await showMenu(ctx, config, "main-menu");
	});
}
