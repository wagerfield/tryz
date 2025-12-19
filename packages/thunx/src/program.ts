import type {
  ErrorHandlers,
  ErrorHandlersReturnType,
  ErrorName,
} from "./errors"
import type { Provider, TokenFactory } from "./provider"
import type { TokenClass, TokenType } from "./token"
import type { SpanAttributes, Tracer } from "./tracer"
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
 * A `Program` represents a computation that:
 * - Produces a success value (`T`)
 * - Might fail with an error (`E`)
 * - Has requirements that must be provided (`R` must be `never` to run)
 *
 * Created via `Shell.try` and executed with `Shell.run`
 *
 * @example
 * ```ts
 * // Create a program with requirements
 * const program = x.require(UserService).try({
 *   try: (ctx) => ctx.get(UserService).name,
 *   catch: (error) => new NotFoundError({ cause: error }),
 * })
 * // program: Program<string, NotFoundError, UserService>
 *
 * // Provide requirements to make it runnable
 * const runnable = program.provide(appProvider)
 * // runnable: Program<string, NotFoundError, never>
 * ```
 */
export class Program<out T = never, out E = never, out R = never> {
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
   * Wrap the program in a tracing span for observability.
   * The span captures execution time and success/failure status.
   * Requires a `Tracer` token to be provided before running.
   *
   * @example
   * ```ts
   * // Add a span to a program
   * const traced = fetchUser(id).span("fetchUser", { userId: id })
   * // traced: Program<User, FetchError, R | Tracer>
   *
   * // Chain multiple spans
   * const program = fetchUser(id)
   *   .span("fetchUser")
   *   .then(enrichUser)
   *   .span("enrichUser")
   *   .then(saveUser)
   *   .span("saveUser")
   * ```
   */
  span(_name: string, _attributes?: SpanAttributes): Program<T, E, R | Tracer> {
    throw new Error("Program.span not implemented")
  }

  /**
   * Pipe the program through a transformation function.
   * The function receives the program and must return a new program.
   * Useful for applying reusable program transformations.
   *
   * @example
   * ```ts
   * // Define reusable transformations
   * const withCaching = <T, E, R>(p: Program<T, E, R>) =>
   *   x.use(cachingMiddleware).from(p)
   *
   * const withRetry = <T, E, R>(p: Program<T, E, R>) =>
   *   p.retry({ times: 3, delay: 1000 })
   *
   * const orNull = <T, E, R>(p: Program<T, E, R>) =>
   *   p.catch(() => null)
   *
   * // Apply transformations fluently
   * const program = fetchUser(id)
   *   .pipe(withCaching)
   *   .pipe(withRetry)
   *   .pipe(orNull)
   *   .then(enrichUser)
   * ```
   */
  pipe<U, F, S>(
    _fn: (program: Program<T, E, R>) => Program<U, F, S>,
  ): Program<U, F, S> {
    throw new Error("Program.pipe not implemented")
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

  /**
   * Add a timeout to the program.
   */
  timeout<F = E>(_ms: number, _onTimeout?: () => F): Program<T, E | F, R> {
    throw new Error("Program.timeout not implemented")
  }

  /**
   * Retry the program on failure.
   */
  retry(_policy: RetryOptions | number): Program<T, E, R> {
    throw new Error("Program.retry not implemented")
  }
}
