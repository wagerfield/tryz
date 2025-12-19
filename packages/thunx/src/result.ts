/**
 * Represents a successful `Result<T, E>` containing a `value` of type `T`.
 *
 * @typeParam T - The type of the success value
 */
export type Success<T> = {
  readonly success: true
  readonly value: T
}

/**
 * Represents a failed `Result<T, E>` containing an `error` of type `E`.
 *
 * @typeParam E - The type of the error
 */
export type Failure<E> = {
  readonly success: false
  readonly error: E
}

/**
 * A `Result<T, E>` is either a `Success<T>` containing a `value` of type `T`,
 * or a `Failure<E>` containing an `error` of type `E`.
 *
 * @typeParam T - The type of the `value` in a `Success<T>`
 * @typeParam E - The type of the `error` in a `Failure<E>`
 *
 * @example
 * ```ts
 * const result = await x.run(program)
 * if (result.success) {
 *   console.log(result.value)
 * } else {
 *   console.error(result.error)
 * }
 * ```
 */
export type Result<T, E> = Success<T> | Failure<E>

/**
 * Create a successful result.
 *
 * @example
 * ```ts
 * const result = success(42)
 * // { success: true, value: 42 }
 * ```
 */
export const success = <T>(value: T): Success<T> => ({ success: true, value })

/**
 * Create a failed result.
 *
 * @example
 * ```ts
 * const result = failure(new Error("oops"))
 * // { success: false, error: Error }
 * ```
 */
export const failure = <E>(error: E): Failure<E> => ({ success: false, error })
