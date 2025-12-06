import { expectTypeOf, test } from "vitest"
import {
	type Failure,
	failure,
	type Result,
	type Success,
	success,
} from "./result"

// ─────────────────────────────────────────────────────────────────────────────
// Success
// ─────────────────────────────────────────────────────────────────────────────

test("Success has success: true and value: T", () => {
	type S = Success<string>

	expectTypeOf<S["success"]>().toEqualTypeOf<true>()
	expectTypeOf<S["value"]>().toEqualTypeOf<string>()
})

test("Success does not have error property", () => {
	type S = Success<string>

	expectTypeOf<S>().not.toHaveProperty("error")
})

// ─────────────────────────────────────────────────────────────────────────────
// Failure
// ─────────────────────────────────────────────────────────────────────────────

test("Failure has success: false and error: E", () => {
	type F = Failure<Error>

	expectTypeOf<F["success"]>().toEqualTypeOf<false>()
	expectTypeOf<F["error"]>().toEqualTypeOf<Error>()
})

test("Failure does not have value property", () => {
	type F = Failure<Error>

	expectTypeOf<F>().not.toHaveProperty("value")
})

// ─────────────────────────────────────────────────────────────────────────────
// Result
// ─────────────────────────────────────────────────────────────────────────────

test("Result is union of Success and Failure", () => {
	type R = Result<string, Error>

	expectTypeOf<R>().toEqualTypeOf<Success<string> | Failure<Error>>()
})

test("Result narrows correctly on success check", () => {
	const result = {} as Result<string, Error>

	if (result.success) {
		expectTypeOf(result).toEqualTypeOf<Success<string>>()
		expectTypeOf(result.value).toEqualTypeOf<string>()
	} else {
		expectTypeOf(result).toEqualTypeOf<Failure<Error>>()
		expectTypeOf(result.error).toEqualTypeOf<Error>()
	}
})

test("Result with never error is still a valid union type", () => {
	type R = Result<string, never>

	// Result<T, never> = Success<T> | Failure<never>
	// The Failure<never> branch is uninhabitable but still part of the type
	const result: R = { success: true, value: "hello" }
	expectTypeOf(result.value).toEqualTypeOf<string>()
})

test("Result with never value is still a valid union type", () => {
	type R = Result<never, Error>

	// Result<never, E> = Success<never> | Failure<E>
	// The Success<never> branch is uninhabitable but still part of the type
	const result: R = { success: false, error: new Error("oops") }
	expectTypeOf(result.error).toEqualTypeOf<Error>()
})

// ─────────────────────────────────────────────────────────────────────────────
// success() helper
// ─────────────────────────────────────────────────────────────────────────────

test("success() returns Success<T>", () => {
	const s = success("hello")

	expectTypeOf(s).toEqualTypeOf<Success<string>>()
	expectTypeOf(s.success).toEqualTypeOf<true>()
	expectTypeOf(s.value).toEqualTypeOf<string>()
})

test("success() infers type from argument", () => {
	const s1 = success(42)
	expectTypeOf(s1.value).toEqualTypeOf<number>()

	const s2 = success({ foo: "bar" })
	expectTypeOf(s2.value).toEqualTypeOf<{ foo: string }>()

	const s3 = success([1, 2, 3])
	expectTypeOf(s3.value).toEqualTypeOf<number[]>()
})

// ─────────────────────────────────────────────────────────────────────────────
// failure() helper
// ─────────────────────────────────────────────────────────────────────────────

test("failure() returns Failure<E>", () => {
	const f = failure(new Error("oops"))

	expectTypeOf(f).toEqualTypeOf<Failure<Error>>()
	expectTypeOf(f.success).toEqualTypeOf<false>()
	expectTypeOf(f.error).toEqualTypeOf<Error>()
})

test("failure() infers type from argument", () => {
	const f1 = failure("error string")
	expectTypeOf(f1.error).toEqualTypeOf<string>()

	const f2 = failure({ code: 404, message: "Not found" })
	expectTypeOf(f2.error).toEqualTypeOf<{ code: number; message: string }>()

	const f3 = failure(new TypeError("type error"))
	expectTypeOf(f3.error).toEqualTypeOf<TypeError>()
})
