import { expectTypeOf, test } from "vitest"
import type { Program } from "./program"
import type { Result } from "./result"
import type {
	ProgramError,
	ProgramRequirements,
	ProgramResult,
	ProgramResultTuple,
	ProgramTypes,
	ProgramValue,
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
// ProgramTypes
// ─────────────────────────────────────────────────────────────────────────────

test("ProgramTypes extracts [T, E, R] tuple", () => {
	type FooToken = { readonly foo: string }
	expectTypeOf<ProgramTypes<Program<string, Error, FooToken>>>().toEqualTypeOf<
		[string, Error, FooToken]
	>()
})

test("ProgramValue extracts value type", () => {
	expectTypeOf<
		ProgramValue<Program<string, Error, never>>
	>().toEqualTypeOf<string>()
})

test("ProgramError extracts error type", () => {
	expectTypeOf<
		ProgramError<Program<string, Error, never>>
	>().toEqualTypeOf<Error>()
})

test("ProgramRequirements extracts requirements type", () => {
	type FooToken = { readonly foo: string }
	expectTypeOf<
		ProgramRequirements<Program<string, Error, FooToken>>
	>().toEqualTypeOf<FooToken>()
})

test("ProgramResult extracts Result type", () => {
	expectTypeOf<ProgramResult<Program<string, Error, never>>>().toEqualTypeOf<
		Result<string, Error>
	>()
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
