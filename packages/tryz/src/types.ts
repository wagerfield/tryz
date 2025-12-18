import type { Context } from "./context"
import type { Program } from "./program"
import type { Result } from "./result"

// ─────────────────────────────────────────────────────────────────────────────
// Shared Type Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect if T is the `any` type.
 * Uses the fact that `any` is the only type where `0 extends 1 & T` is true.
 */
export type IsAny<T> = 0 extends 1 & T ? true : false

/**
 * Forces TypeScript to expand/simplify an intersection type.
 * Useful for improving IDE tooltip readability.
 */
export type Simplify<A> = { [K in keyof A]: A[K] } extends infer B ? B : never

// ─────────────────────────────────────────────────────────────────────────────
// Options Types
// ─────────────────────────────────────────────────────────────────────────────

export type RetryOptions = {
	times?: number
	delay?: number | ((attempt: number) => number)
	while?: (error: unknown) => boolean
}

export type ConcurrencyOptions = {
	concurrency?: number
}

export type RunOptions = {
	signal?: AbortSignal
	unwrap?: boolean
}

export type TryOptions<T, E, R> = {
	try: (ctx: Context<R>) => T
	catch: (e: unknown) => E
}

export type TapOptions<T, E, U, F> = {
	value?: (value: T) => U
	error?: (error: E) => F
}

// ─────────────────────────────────────────────────────────────────────────────
// Program Type Extractors
// Uses tuple wrapping [P] extends [...] to prevent distributive conditionals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A `Program` with any types, used for generic constraints.
 */
export type AnyProgram = Program<any, any, any>

/**
 * Extract the [Value, Error, Requirements] tuple from a Program type.
 */
export type ProgramTypes<P> = [P] extends [Program<infer T, infer E, infer R>]
	? [T, E, R]
	: never

/**
 * Extract the success value type from a Program.
 */
export type ProgramValue<P> = ProgramTypes<P>[0]

/**
 * Extract the failure error type from a Program.
 */
export type ProgramError<P> = ProgramTypes<P>[1]

/**
 * Extract the requirements type from a Program.
 */
export type ProgramRequirements<P> = ProgramTypes<P>[2]

/**
 * Extract the Result<T, E> type from a Program.
 */
export type ProgramResult<P> = [P] extends [Program<infer T, infer E>]
	? Result<T, E>
	: never

// ─────────────────────────────────────────────────────────────────────────────
// Program Tuple/Array Utilities
// Extracts union of types across all programs in an array
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract union of [Value, Error, Requirements] across all programs in a tuple.
 * Note: Returns a union, not a mapped tuple.
 */
export type UnionProgramTypes<T extends readonly AnyProgram[]> =
	T[number] extends Program<infer V, infer E, infer R> ? [V, E, R] : never

/**
 * Extract union of all value types from a program tuple.
 */
export type UnionProgramValues<T extends readonly AnyProgram[]> =
	UnionProgramTypes<T>[0]

/**
 * Extract union of all error types from a program tuple.
 */
export type UnionProgramErrors<T extends readonly AnyProgram[]> =
	UnionProgramTypes<T>[1]

/**
 * Extract union of all requirement types from a program tuple.
 */
export type UnionProgramRequirements<T extends readonly AnyProgram[]> =
	UnionProgramTypes<T>[2]

/**
 * Map a program tuple to a tuple of value types (preserves tuple structure).
 */
export type ProgramValuesTuple<T extends readonly AnyProgram[]> = {
	-readonly [K in keyof T]: ProgramValue<T[K]>
}

/**
 * Map a program tuple to a tuple of Result types (preserves tuple structure).
 */
export type ProgramResultTuple<T extends readonly AnyProgram[]> = {
	-readonly [K in keyof T]: ProgramResult<T[K]>
}

// ─────────────────────────────────────────────────────────────────────────────
// Unwrap Utilities
// For unified map/try that accepts T | Promise<T> | Program<T, E, R>
// These use DISTRIBUTIVE conditionals (no tuple wrapping) because they need
// to extract types from union members like `T | Program<V, E, R>`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the success value from T | Promise<T> | Program<T, E, R>
 * Explicitly handles `any` to return `any` since `any` is not a Program.
 */
export type UnwrapValue<T> =
	IsAny<T> extends true
		? any
		: T extends Program<infer U, unknown, unknown>
			? U
			: Awaited<T>

/**
 * Extract the error type from Program, or never for plain values/Promises.
 * Explicitly handles `any` to return `never` since `any` is not a Program.
 * Uses distributive conditional to extract errors from Program members of unions.
 */
export type UnwrapError<T> =
	IsAny<T> extends true
		? never
		: T extends Program<unknown, infer E, unknown>
			? E
			: never

/**
 * Extract the requirements from Program, or never for plain values/Promises.
 * Explicitly handles `any` to return `never` since `any` is not a Program.
 * Uses distributive conditional to extract requirements from Program members of unions.
 */
export type UnwrapRequirements<T> =
	IsAny<T> extends true
		? never
		: T extends Program<unknown, unknown, infer R>
			? R
			: never
