import { expectTypeOf, test } from "vitest"
import type { Program } from "./program"
import type { Result } from "./result"
import type {
	ExtractProgramErrors,
	ExtractProgramRequirements,
	ExtractProgramResult,
	ExtractProgramTypes,
	ExtractProgramValues,
	ProgramResultTuple,
	ProgramValuesTuple,
	UnwrapError,
	UnwrapRequirements,
	UnwrapValue,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// UnwrapValue
// ─────────────────────────────────────────────────────────────────────────────

test("UnwrapValue extracts value from Program", () => {
	expectTypeOf<
		UnwrapValue<Program<string, Error, never>>
	>().toEqualTypeOf<string>()
	expectTypeOf<
		UnwrapValue<Program<number, never, never>>
	>().toEqualTypeOf<number>()
})

test("UnwrapValue awaits Promise", () => {
	expectTypeOf<UnwrapValue<Promise<string>>>().toEqualTypeOf<string>()
	expectTypeOf<UnwrapValue<Promise<number>>>().toEqualTypeOf<number>()
})

test("UnwrapValue passes through plain values", () => {
	expectTypeOf<UnwrapValue<string>>().toEqualTypeOf<string>()
	expectTypeOf<UnwrapValue<number>>().toEqualTypeOf<number>()
	expectTypeOf<UnwrapValue<{ foo: string }>>().toEqualTypeOf<{ foo: string }>()
})

test("UnwrapValue handles any", () => {
	// any should pass through as any (since it's not a Program)
	expectTypeOf<UnwrapValue<any>>().toBeAny()
})

// ─────────────────────────────────────────────────────────────────────────────
// UnwrapError
// ─────────────────────────────────────────────────────────────────────────────

test("UnwrapError extracts error from Program", () => {
	expectTypeOf<
		UnwrapError<Program<string, Error, never>>
	>().toEqualTypeOf<Error>()
	expectTypeOf<
		UnwrapError<Program<string, TypeError | RangeError, never>>
	>().toEqualTypeOf<TypeError | RangeError>()
})

test("UnwrapError returns never for plain values", () => {
	expectTypeOf<UnwrapError<string>>().toEqualTypeOf<never>()
	expectTypeOf<UnwrapError<number>>().toEqualTypeOf<never>()
	expectTypeOf<UnwrapError<{ foo: string }>>().toEqualTypeOf<never>()
})

test("UnwrapError returns never for Promise", () => {
	expectTypeOf<UnwrapError<Promise<string>>>().toEqualTypeOf<never>()
})

test("UnwrapError returns never for any (not unknown)", () => {
	// This is the critical fix - any should return never, not unknown
	expectTypeOf<UnwrapError<any>>().toEqualTypeOf<never>()
})

// ─────────────────────────────────────────────────────────────────────────────
// UnwrapRequirements
// ─────────────────────────────────────────────────────────────────────────────

test("UnwrapRequirements extracts requirements from Program", () => {
	type FooToken = { readonly foo: string }
	type BarToken = { readonly bar: number }
	expectTypeOf<
		UnwrapRequirements<Program<string, Error, FooToken>>
	>().toEqualTypeOf<FooToken>()
	expectTypeOf<
		UnwrapRequirements<Program<string, Error, FooToken | BarToken>>
	>().toEqualTypeOf<FooToken | BarToken>()
})

test("UnwrapRequirements returns never for plain values", () => {
	expectTypeOf<UnwrapRequirements<string>>().toEqualTypeOf<never>()
	expectTypeOf<UnwrapRequirements<number>>().toEqualTypeOf<never>()
})

test("UnwrapRequirements returns never for Promise", () => {
	expectTypeOf<UnwrapRequirements<Promise<string>>>().toEqualTypeOf<never>()
})

test("UnwrapRequirements returns never for any (not unknown)", () => {
	// This is the critical fix - any should return never, not unknown
	expectTypeOf<UnwrapRequirements<any>>().toEqualTypeOf<never>()
})

// ─────────────────────────────────────────────────────────────────────────────
// ExtractProgramTypes
// ─────────────────────────────────────────────────────────────────────────────

test("ExtractProgramTypes extracts [T, E, R] tuple", () => {
	type FooToken = { readonly foo: string }
	expectTypeOf<
		ExtractProgramTypes<Program<string, Error, FooToken>>
	>().toEqualTypeOf<[string, Error, FooToken]>()
})

test("ExtractProgramValues extracts value type", () => {
	expectTypeOf<
		ExtractProgramValues<Program<string, Error, never>>
	>().toEqualTypeOf<string>()
})

test("ExtractProgramErrors extracts error type", () => {
	expectTypeOf<
		ExtractProgramErrors<Program<string, Error, never>>
	>().toEqualTypeOf<Error>()
})

test("ExtractProgramRequirements extracts requirements type", () => {
	type FooToken = { readonly foo: string }
	expectTypeOf<
		ExtractProgramRequirements<Program<string, Error, FooToken>>
	>().toEqualTypeOf<FooToken>()
})

test("ExtractProgramResult extracts Result type", () => {
	expectTypeOf<
		ExtractProgramResult<Program<string, Error, never>>
	>().toEqualTypeOf<Result<string, Error>>()
})

// ─────────────────────────────────────────────────────────────────────────────
// ProgramValuesTuple
// ─────────────────────────────────────────────────────────────────────────────

test("ProgramValuesTuple maps Program tuple to value tuple", () => {
	type Programs = [
		Program<string, Error, never>,
		Program<number, TypeError, never>,
		Program<boolean, never, never>,
	]
	expectTypeOf<ProgramValuesTuple<Programs>>().toEqualTypeOf<
		[string, number, boolean]
	>()
})

test("ProgramResultTuple maps Program tuple to Result tuple", () => {
	type Programs = [
		Program<string, Error, never>,
		Program<number, TypeError, never>,
	]
	expectTypeOf<ProgramResultTuple<Programs>>().toEqualTypeOf<
		[Result<string, Error>, Result<number, TypeError>]
	>()
})
