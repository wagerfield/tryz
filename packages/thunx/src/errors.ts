import type { Simplify } from "./types"

export interface TypedErrorShape {
  readonly message?: string
  readonly cause?: unknown
  readonly [key: string]: unknown
}

/**
 * Creates a TypedError class with a typed `name` for error identification.
 *
 * @example
 * ```ts
 * class NotFoundError extends TypedError("NotFound")<{ readonly resource: string }> {}
 *
 * const error = new NotFoundError({ resource: "user", message: "User not found" })
 * error.name // "NotFound" (typed as literal)
 *
 * NotFoundError.name // "NotFound" - static access
 * ```
 */
export const TypedError = <const Name extends string>(name: Name) =>
  class TypedError extends Error {
    static override readonly name = name
    override readonly name = name

    constructor(shape: TypedErrorShape = {}) {
      const { message, cause, ...rest } = shape
      super(message, { cause })
      Object.assign(this, rest)
    }
  } as TypedErrorConstructor<Name>

export interface TypedErrorConstructor<Name extends string> {
  readonly name: Name
  new <Shape extends Record<string, unknown> = Record<string, unknown>>(
    args?: { message?: string; cause?: unknown } & Shape,
  ): TypedErrorInstance<Name, Shape>
}

export type TypedErrorInstance<
  Name extends string,
  Shape extends Record<string, unknown>,
> = Error & { readonly name: Name } & Readonly<Shape>

export class Defect extends TypedError("Defect") {}

export const defect = (error?: unknown): never => {
  if (error instanceof Error) {
    throw new Defect({
      message: error.message,
      stack: error.stack,
      cause: error,
    })
  }

  throw new Defect({
    message: "Unexpected error",
    cause: error,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Type Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract valid error names from a union of typed errors.
 *
 * @example
 * ```ts
 * type Names = ErrorName<NotFoundError | TimeoutError>
 * // "NotFound" | "Timeout"
 * ```
 */
export type ErrorName<E> = E extends { name: infer N extends string }
  ? N
  : never

/**
 * Handler object type for catching multiple errors by name.
 *
 * @example
 * ```ts
 * type Handlers = ErrorHandlers<NotFoundError | TimeoutError>
 * // {
 * //   NotFound?: (error: NotFoundError) => unknown
 * //   Timeout?: (error: TimeoutError) => unknown
 * // }
 * ```
 */
export type ErrorHandlers<E> = {
  [N in ErrorName<E>]?: (error: Extract<E, { name: N }>) => unknown
}

/**
 * Extract union of return types from error handlers.
 */
export type ErrorHandlersReturnType<H> = Simplify<
  {
    [K in keyof H]: H[K] extends (...args: never[]) => infer R ? R : never
  }[keyof H]
>
