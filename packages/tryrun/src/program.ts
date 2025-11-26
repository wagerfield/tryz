import type { Result } from "./result"

// ═════════════════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════════════════

export type AnyService = {
	readonly name: string
}

export type RetryPolicy = {
	times?: number
	delay?: number | ((attempt: number) => number)
	while?: (error: unknown) => boolean
}

export type ConcurrencyOptions = {
	concurrency?: number
}

export type ProgramMode = "result" | "unwrap"

export type ProgramContext<C> = {
	signal: AbortSignal
	context: C
}

export type ProgramMiddleware<C> = (
	context: ProgramContext<C> & { next: () => Promise<unknown> },
) => Promise<unknown>

export type ProgramRunOptions = {
	signal?: AbortSignal
	mode?: ProgramMode
}

// ═════════════════════════════════════════════════════════════════════════════
// PROGRAM TYPE UTILS
// ═════════════════════════════════════════════════════════════════════════════

export type ExtractProgramTypes<P> = P extends Program<
	infer T,
	infer E,
	infer R
>
	? [T, E, R]
	: never

export type ExtractProgramValues<P> = ExtractProgramTypes<P>[0]

export type ExtractProgramErrors<P> = ExtractProgramTypes<P>[1]

export type ExtractProgramRequirements<P> = ExtractProgramTypes<P>[2]

export type ExtractProgramResult<P> = P extends Program<
	infer T,
	infer E,
	unknown
>
	? Result<T, E>
	: never

// ═════════════════════════════════════════════════════════════════════════════
// PROGRAM TUPLE UTILS
// ═════════════════════════════════════════════════════════════════════════════

export type ExtractProgramTupleTypes<T extends readonly Program[]> =
	T[number] extends Program<infer T, infer E, infer R> ? [T, E, R] : never

export type ExtractProgramTupleValues<T extends readonly Program[]> =
	ExtractProgramTupleTypes<T>[0]

export type ExtractProgramTupleErrors<T extends readonly Program[]> =
	ExtractProgramTupleTypes<T>[1]

export type ExtractProgramTupleRequirements<T extends readonly Program[]> =
	ExtractProgramTupleTypes<T>[2]

export type ProgramValuesTuple<T extends readonly Program[]> = {
	-readonly [P in keyof T]: ExtractProgramValues<T[P]>
}

export type ProgramResultTuple<T extends readonly Program[]> = {
	-readonly [P in keyof T]: ExtractProgramResult<T[P]>
}

// ═════════════════════════════════════════════════════════════════════════════
// PROGRAM
// ═════════════════════════════════════════════════════════════════════════════

export class Program<T = unknown, E = unknown, R = unknown> {
	private constructor() {}

	// ───────────────────────────────────────────────────────────────────────────
	// DEPENDENCY INJECTION
	// ───────────────────────────────────────────────────────────────────────────

	provide<S extends AnyService>(
		_service: S,
		_implementation: S,
	): Program<T, E, Exclude<R, S>> {
		throw new Error("Program.provide not implemented")
	}

	// ───────────────────────────────────────────────────────────────────────────
	// TRANSFORMATION
	// ───────────────────────────────────────────────────────────────────────────

	map<U>(_fn: (value: T) => U): Program<U, E, R> {
		throw new Error("Program.map not implemented")
	}

	mapError<F>(_fn: (error: E) => F): Program<T, F, R> {
		throw new Error("Program.mapError not implemented")
	}

	tap(_fn: (value: T) => void | Promise<void>): Program<T, E, R> {
		throw new Error("Program.tap not implemented")
	}

	tapError(_fn: (error: E) => void | Promise<void>): Program<T, E, R> {
		throw new Error("Program.tapError not implemented")
	}

	catch<F>(_fn: (error: E) => F): Program<T, F, R> {
		throw new Error("Program.catch not implemented")
	}

	// ───────────────────────────────────────────────────────────────────────────
	// RECOVERY
	// ───────────────────────────────────────────────────────────────────────────

	retry(_policy: RetryPolicy | number): Program<T, E, R> {
		throw new Error("Program.retry not implemented")
	}

	timeout<F = E>(_ms: number, _onTimeout?: () => F): Program<T, E | F, R> {
		throw new Error("Program.timeout not implemented")
	}

	orElse<U, F, R2 = never>(
		_fn: (error: E) => Program<U, F, R2>,
	): Program<T | U, F, R | R2> {
		throw new Error("Program.orElse not implemented")
	}
}

// ═════════════════════════════════════════════════════════════════════════════
// PROGRAM BUILDER
// ═════════════════════════════════════════════════════════════════════════════

export class ProgramBuilder<C = never, R = never> {
	use(_middleware: ProgramMiddleware<C>): ProgramBuilder<C, R> {
		throw new Error("ProgramBuilder.use not implemented")
	}

	// ───────────────────────────────────────────────────────────────────────────
	// DEPENDENCY INJECTION
	// ───────────────────────────────────────────────────────────────────────────

	require<S extends AnyService>(_service: S): ProgramBuilder<C | S, R | S> {
		throw new Error("ProgramBuilder.require not implemented")
	}

	provide<S extends R>(
		_service: S,
		_implementation: S,
	): ProgramBuilder<C, Exclude<R, S>> {
		throw new Error("ProgramBuilder.provide not implemented")
	}

	// ───────────────────────────────────────────────────────────────────────────
	// CREATION
	// ───────────────────────────────────────────────────────────────────────────

	try<T, E = unknown, F = never>(
		_fn: (context: ProgramContext<C>) => T | Promise<T> | Program<T, E, R>,
		_catch?: (error: E) => F,
	): Program<T, F, R> {
		throw new Error("ProgramBuilder.try not implemented")
	}

	fail<E>(_error: E): Program<never, E, R> {
		throw new Error("ProgramBuilder.fail not implemented")
	}

	// ───────────────────────────────────────────────────────────────────────────
	// COMBINATORS
	// ───────────────────────────────────────────────────────────────────────────

	all<T extends readonly Program[]>(
		_programs: T,
		_options?: ConcurrencyOptions,
	): Program<
		ProgramValuesTuple<T>,
		ExtractProgramTupleErrors<T>,
		R | ExtractProgramTupleRequirements<T>
	> {
		throw new Error("ProgramBuilder.all not implemented")
	}

	any<T extends readonly Program[]>(
		_programs: T,
	): Program<
		ExtractProgramTupleValues<T>,
		ExtractProgramTupleErrors<T>,
		R | ExtractProgramTupleRequirements<T>
	> {
		throw new Error("ProgramBuilder.any not implemented")
	}

	race<T extends readonly Program[]>(
		_programs: T,
	): Program<
		ExtractProgramTupleValues<T>,
		ExtractProgramTupleErrors<T>,
		R | ExtractProgramTupleRequirements<T>
	> {
		throw new Error("ProgramBuilder.race not implemented")
	}

	// ───────────────────────────────────────────────────────────────────────────
	// EXECUTION
	// ───────────────────────────────────────────────────────────────────────────

	run<T, E, Options extends ProgramRunOptions>(
		_program: Program<T, E, never>,
		_options?: Options,
	): Options["mode"] extends "unwrap" ? Promise<T> : Promise<Result<T, E>> {
		throw new Error("Program.run not implemented")
	}
}

export const x = new ProgramBuilder()
