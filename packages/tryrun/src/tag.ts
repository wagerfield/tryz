/**
 * Symbol used to identify the type category of a tagged value.
 * @example "Result", "Error", "Token"
 */
export const TypeId = Symbol.for("tryrun/TypeId")
export type TypeId = typeof TypeId

/**
 * Symbol used to identify the specific key of a tagged value.
 * @example "Success", "NotFound", "AuthService"
 */
export const KeyId = Symbol.for("tryrun/KeyId")
export type KeyId = typeof KeyId

/**
 * Base interface for all tagged types in `tryrun`
 *
 * Provides a unified type identification system using symbols.
 *
 * @typeParam Type - The type category (e.g. `"Result"`, `"Error"`, `"Token"`)
 * @typeParam Key - The specific key (e.g. `"Success"`, `"NotFound"`, `"AuthService"`)
 */
export interface Tag<
	Type extends string = string,
	Key extends string = string,
> {
	readonly [TypeId]: Type
	readonly [KeyId]: Key
}

/**
 * Extracts the `TypeId` value from a `Tag`
 *
 * @example
 * ```ts
 * type T = TypeOf<Success<string>> // "Result"
 * ```
 */
export type TypeOf<T extends Tag> =
	T extends Tag<infer Type, string> ? Type : never

/**
 * Extracts the `KeyId` value from a `Tag`
 *
 * @example
 * ```ts
 * type K = KeyOf<Success<string>> // "Success"
 * ```
 */
export type KeyOf<T extends Tag> =
	T extends Tag<string, infer Key> ? Key : never
