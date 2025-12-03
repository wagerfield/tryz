import type { Program } from "./program"
import type { Result } from "./result"

export type RetryPolicy = {
	times?: number
	delay?: number | ((attempt: number) => number)
	while?: (error: unknown) => boolean
}

export type ConcurrencyOptions = {
	concurrency?: number
}

export type Middleware<C> = (context: {
	context: C
	signal: AbortSignal
	next: () => Promise<unknown>
}) => Promise<unknown>

export type RunMode = "result" | "unwrap"

export type RunOptions = {
	signal?: AbortSignal
	mode?: RunMode
}

// Unwrap Utils (for unified map/try that accepts T | Promise<T> | Program<T, E, R>)

/**
 * Extract the success value from T | Promise<T> | Program<T, E, R>
 */
export type UnwrapValue<T> =
	T extends Program<infer U, unknown, unknown> ? U : Awaited<T>

/**
 * Extract the error type from Program, or never for plain values/Promises
 */
export type UnwrapError<T> =
	T extends Program<unknown, infer E, unknown> ? E : never

/**
 * Extract the requirements from Program, or never for plain values/Promises
 */
export type UnwrapRequirements<T> =
	T extends Program<unknown, unknown, infer R> ? R : never

// Program Type Utils

export type ExtractProgramResult<P> =
	P extends Program<infer T, infer E> ? Result<T, E> : never

export type ExtractProgramTypes<P> =
	P extends Program<infer T, infer E, infer R> ? [T, E, R] : never

export type ExtractProgramValues<P> = ExtractProgramTypes<P>[0]

export type ExtractProgramErrors<P> = ExtractProgramTypes<P>[1]

export type ExtractProgramRequirements<P> = ExtractProgramTypes<P>[2]

// Program Tuple Utils

export type ExtractProgramTupleTypes<T extends readonly Program[]> =
	T[number] extends Program<infer T, infer E, infer R> ? [T, E, R] : never

export type ExtractProgramTupleValues<T extends readonly Program[]> =
	ExtractProgramTupleTypes<T>[0]

export type ExtractProgramTupleErrors<T extends readonly Program[]> =
	ExtractProgramTupleTypes<T>[1]

export type ExtractProgramTupleRequirements<T extends readonly Program[]> =
	ExtractProgramTupleTypes<T>[2]

// Program Tuple Types

export type ProgramValuesTuple<T extends readonly Program[]> = {
	-readonly [P in keyof T]: ExtractProgramValues<T[P]>
}

export type ProgramResultTuple<T extends readonly Program[]> = {
	-readonly [P in keyof T]: ExtractProgramResult<T[P]>
}
