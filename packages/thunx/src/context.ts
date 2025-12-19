import type { Provider } from "./provider"
import type { TokenClass, TokenName, TokenType } from "./token"

/**
 * Creates a typed context map from a union of token instance types.
 * Maps from token name to the instance type.
 *
 * @example
 * ```ts
 * type Ctx = ContextMap<FooService | BarService>
 * // {
 * //   "FooService": FooService
 * //   "BarService": BarService
 * // }
 * ```
 */
export type ContextMap<Instances> = {
  [I in Instances as TokenName<I> extends string ? TokenName<I> : never]: I
}

/**
 * A resolved runtime context that lazily resolves and caches token instances.
 * Created internally when running a program.
 *
 * @typeParam C - Union of token INSTANCE types available in this context
 */
export class Context<C = never> {
  readonly signal: AbortSignal

  constructor(_provider: Provider<C>, signal?: AbortSignal) {
    this.signal = signal ?? new AbortController().signal
  }

  /**
   * Get a token instance by token class.
   * Lazily resolves on first access, then cached.
   *
   * @param token - The token class to retrieve
   * @returns The resolved token instance
   *
   * @example
   * ```ts
   * const env = ctx.get(EnvService)
   * const db = ctx.get(DatabaseService)
   * ```
   */
  get<T extends TokenClass & { name: TokenName<C> }>(_token: T): TokenType<T> {
    throw new Error("Context.get not implemented")
  }
}
