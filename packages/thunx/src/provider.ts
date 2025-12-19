import type { Context } from "./context"
import type { TokenClass, TokenName, TokenShape, TokenType } from "./token"

/**
 * Factory type for creating token implementations.
 * Can be a direct value or a function that receives context.
 */
export type TokenFactory<C, T extends TokenClass> =
  | TokenShape<T>
  | ((ctx: Context<C>) => TokenShape<T>)

/**
 * Internal record of token factories keyed by token name.
 */
export type FactoryRecord = Map<string, TokenFactory<unknown, TokenClass>>

/**
 * A composable recipe for building token implementations.
 * Each `.provide()` returns a new Provider with the additional factory.
 *
 * @typeParam C - Union of token INSTANCE types that have been provided
 *
 * @example
 * ```ts
 * const base = provider()
 *   .provide(EnvService, { DATABASE_URL: "postgres://..." })
 *   .provide(LoggerService, (ctx) => ({
 *     log: (msg) => console.log(msg)
 *   }))
 * ```
 */
export class Provider<out C = never> {
  /** @internal */
  readonly _factories: FactoryRecord

  /** @internal */
  constructor(factories?: FactoryRecord) {
    this._factories = factories ?? new Map()
  }

  /**
   * Add a token implementation to the provider.
   * Returns a new Provider with the additional factory.
   *
   * @param token - The token class to provide
   * @param factory - The implementation (value or factory function)
   */
  provide<T extends TokenClass>(
    _token: T,
    _factory: TokenFactory<C, T>,
  ): Provider<C | TokenType<T>> {
    throw new Error("Provider.provide not implemented")
  }

  /**
   * Get the factory for a token.
   *
   * @param token - The token class to retrieve
   * @returns The factory for the token
   */
  get<T extends TokenClass & { name: TokenName<C> }>(
    _token: T,
  ): TokenFactory<C, T> {
    throw new Error("Provider.get not implemented")
  }

  /**
   * Create a new Provider with only the specified tokens.
   *
   * @param tokens - The token classes to include
   * @returns A new Provider with only the specified tokens
   */
  pick<T extends TokenClass & { name: TokenName<C> }>(
    ..._tokens: T[]
  ): Provider<TokenType<T>> {
    throw new Error("Provider.pick not implemented")
  }

  /**
   * Create a new Provider without the specified tokens.
   *
   * @param tokens - The token classes to exclude
   * @returns A new Provider without the specified tokens
   */
  omit<T extends TokenClass & { name: TokenName<C> }>(
    ..._tokens: T[]
  ): Provider<Exclude<C, TokenType<T>>> {
    throw new Error("Provider.omit not implemented")
  }
}
