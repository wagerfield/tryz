import { Context } from "./context"
import type { Provider } from "./provider"
import type { Result } from "./result"

/**
 * Extended context available to middleware functions.
 * Provides access to the abort signal, tokens via `get()`, and `next()` to continue execution.
 *
 * @typeParam R - Union of token INSTANCE types available in this context
 *
 * @example
 * ```ts
 * x.use(async (ctx) => {
 *   const logger = ctx.get(LoggerService)
 *   const start = Date.now()
 *
 *   const result = await ctx.next()
 *
 *   logger.info({
 *     success: result.success,
 *     duration: Date.now() - start,
 *   })
 *
 *   return result
 * })
 * ```
 */
export class MiddlewareContext<R = never> extends Context<R> {
	/**
	 * Continue execution to the next middleware or program.
	 * Returns a `Result` containing either the success value or error.
	 */
	readonly next: () => Promise<Result<unknown, unknown>>

	constructor(
		provider: Provider<R>,
		signal: AbortSignal,
		next: () => Promise<Result<unknown, unknown>>,
	) {
		super(provider, signal)
		this.next = next
	}
}

/**
 * A middleware function that wraps program execution.
 * Receives a `MiddlewareContext` with access to services, signal, and `next()`.
 * Must return a `Result` (or `Promise<Result>`).
 *
 * @typeParam R - Union of token INSTANCE types required by this middleware
 *
 * @example
 * ```ts
 * // Logging middleware
 * const logging: Middleware<LoggerService> = async (ctx) => {
 *   ctx.get(LoggerService).info("Starting...")
 *   const result = await ctx.next()
 *   ctx.get(LoggerService).info("Done:", result.success)
 *   return result
 * }
 *
 * // Timing middleware
 * const timing: Middleware<never> = async (ctx) => {
 *   const start = Date.now()
 *   const result = await ctx.next()
 *   console.log(`Duration: ${Date.now() - start}ms`)
 *   return result
 * }
 * ```
 */
export type Middleware<R = never> = (
	ctx: MiddlewareContext<R>,
) => Result<unknown, unknown> | Promise<Result<unknown, unknown>>
