import type {
	ErrorHandlers,
	ErrorHandlersReturnType,
	ErrorName,
} from "./errors"
import type { Provider, TokenFactory } from "./provider"
import type { TokenClass, TokenType } from "./token"
import type {
	RetryOptions,
	TapOptions,
	UnwrapError,
	UnwrapRequirements,
	UnwrapValue,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Catch Helper Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract error by name from a union.
 * Uses direct conditional instead of Extract for cleaner IDE tooltips.
 * @internal
 */
type ErrorByName<E, Name extends string> = E extends { name: Name } ? E : never

/**
 * A program that produces a value of type T, may fail with error E,
 * and requires token implementations R to be provided before it can run.
 *
 * @typeParam T - Success value type
 * @typeParam E - Failure error type
 * @typeParam R - Union of required token types (must be `never` to run)
 *
 * @example
 * ```ts
 * const prog = shell.try((ctx) => ctx.get(FooService).value)
 * // prog: Program<string, unknown, FooService>
 *
 * const runnable = prog.provide(fooProvider)
 * // runnable: Program<string, unknown, never>
 * ```
 */
export class Program<out T = unknown, out E = unknown, out R = never> {
	private constructor() {}

	/**
	 * Satisfy requirements with a `Provider` or token and factory.
	 * Returns a new `Program` with the provided tokens removed from requirements.
	 *
	 * @example
	 * ```ts
	 * // Provide with a Provider
	 * const runnable = program.provide(appProvider)
	 * // runnable: Program<T, E, Exclude<R, ProvidedTokens>>
	 *
	 * // Provide a single token with a factory
	 * const runnable = program.provide(Config, { apiUrl: "https://..." })
	 * // runnable: Program<T, E, Exclude<R, Config>>
	 * ```
	 */
	provide<C>(_provider: Provider<C>): Program<T, E, Exclude<R, C>>

	provide<C extends TokenClass>(
		_token: C,
		_factory: TokenFactory<never, C>,
	): Program<T, E, Exclude<R, TokenType<C>>>

	provide<C>(
		_providerOrToken: Provider<C> | TokenClass,
		_factory?: TokenFactory<never, TokenClass>,
	): Program<T, E, Exclude<R, C>> {
		throw new Error("Program.provide not implemented")
	}

	/**
	 * Transform the success value of a `Program`.
	 * Returns a new `Program` with the transformed value.
	 * Can return a value, `Promise`, or `Program`.
	 *
	 * @example
	 * ```ts
	 * const userName = program
	 *   .then((value) => value * 2)           // transform value
	 *   .then((value) => fetchUser(value.id)) // return Promise
	 *   .then((user) => validateUser(user))   // return Program
	 *   .then((user) => user.name)            // extract property
	 * // userName: Program<string, E, R>
	 * ```
	 */
	then<U>(
		_fn: (value: T) => U,
	): Program<UnwrapValue<U>, E | UnwrapError<U>, R | UnwrapRequirements<U>> {
		throw new Error("Program.then not implemented")
	}

	/**
	 * Perform side effects without changing the `Program` value.
	 * Returns the same value but may introduce errors or requirements.
	 * Can return `void`, `Promise`, or `Program` (value is discarded).
	 *
	 * @example
	 * ```ts
	 * // Tap with a void side effect
	 * program.tap((value) => console.log("success:", value))
	 *
	 * // Tap with a Program (value discarded, errors/requirements propagate)
	 * const tapped = program.tap((value) => log(value))
	 * // log: Program<void, LoggerError, LoggerService>
	 * // tapped: Program<T, E | LoggerError, R | LoggerService>
	 *
	 * // Tap success value and/or failure error
	 * program.tap({
	 *   value: (value) => console.log("success:", value),
	 *   error: (error) => console.error("failed:", error),
	 * })
	 * ```
	 */
	tap<U>(
		_fn: (value: T) => U,
	): Program<T, E | UnwrapError<U>, R | UnwrapRequirements<U>>

	tap<U, F>(
		_options: TapOptions<T, E, U, F>,
	): Program<
		T,
		E | UnwrapError<U> | UnwrapError<F>,
		R | UnwrapRequirements<U> | UnwrapRequirements<F>
	>

	tap<U, F>(
		_input: ((value: T) => U) | TapOptions<T, E, U, F>,
	): Program<
		T,
		E | UnwrapError<U> | UnwrapError<F>,
		R | UnwrapRequirements<U> | UnwrapRequirements<F>
	> {
		throw new Error("Program.tap not implemented")
	}

	/**
	 * Catch and handle errors from the `Program`.
	 * Can return a recovery value, `Promise`, or `Program`.
	 * Use `x.fail` to re-throw or transform errors.
	 *
	 * @example
	 * ```ts
	 * // Catch all errors with a fallback value
	 * const handleAll = program.catch(() => null)
	 * // handleAll: Program<T | null, never, R>
	 *
	 * // Catch specific error by name
	 * const handleOne = program.catch("NotFoundError", () => null)
	 * // handleOne: Program<T | null, Exclude<E, NotFoundError>, R>
	 *
	 * // Catch multiple errors by name
	 * const handleSome = program.catch({
	 *   NotFoundError: () => null, // recover with null
	 *   DatabaseError: (error) => x.fail(error), // re-throw error
	 *   TimeoutError: () => x.fail(new RetryError()), // transform error
	 * })
	 * // handleSome: Program<T | null, DatabaseError | RetryError, R>
	 *
	 * // Transform errors using x.fail
	 * const transformOne = program.catch("HttpError", (error) => {
	 *   return error.status === 404
	 *     ? x.fail(new NotFoundError())
	 *     : x.fail(new ServerError())
	 * })
	 * // transformOne: Program<T, NotFoundError | ServerError, R>
	 * ```
	 */
	catch<F>(
		fn: (error: E) => F,
	): Program<T | UnwrapValue<F>, UnwrapError<F>, R | UnwrapRequirements<F>>

	catch<Name extends ErrorName<E>, F>(
		name: Name,
		fn: (error: ErrorByName<E, Name>) => F,
	): Program<
		T | UnwrapValue<F>,
		Exclude<E, { name: Name }> | UnwrapError<F>,
		R | UnwrapRequirements<F>
	>

	catch<Handlers extends ErrorHandlers<E>>(
		handlers: Handlers,
	): Program<
		T | UnwrapValue<ErrorHandlersReturnType<Handlers>>,
		| Exclude<E, { name: keyof Handlers }>
		| UnwrapError<ErrorHandlersReturnType<Handlers>>,
		R | UnwrapRequirements<ErrorHandlersReturnType<Handlers>>
	>

	catch<F>(
		_input: unknown,
		_fn?: unknown,
	): Program<T | UnwrapValue<F>, unknown, R | UnwrapRequirements<F>> {
		throw new Error("Program.catch not implemented")
	}

	/**
	 * Retry the program on failure.
	 */
	retry(_policy: RetryOptions | number): Program<T, E, R> {
		throw new Error("Program.retry not implemented")
	}

	/**
	 * Add a timeout to the program.
	 */
	timeout<F = E>(_ms: number, _onTimeout?: () => F): Program<T, E | F, R> {
		throw new Error("Program.timeout not implemented")
	}

	/**
	 * Run cleanup logic regardless of success or failure.
	 * The cleanup function cannot change the result.
	 *
	 * @example
	 * ```ts
	 * program.finally(() => {
	 *   metrics.recordDuration()
	 *   cleanup()
	 * })
	 * ```
	 */
	finally(_fn: () => void | Promise<void>): Program<T, E, R> {
		throw new Error("Program.finally not implemented")
	}
}
