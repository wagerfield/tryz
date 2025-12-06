import { expectTypeOf, test } from "vitest"
import { TypedError } from "./errors"
import type { Program } from "./program"
import { Provider } from "./provider"
import { Token, type TokenType } from "./token"

// ─────────────────────────────────────────────────────────────────────────────
// Test Tokens and Errors
// ─────────────────────────────────────────────────────────────────────────────

class FooService extends Token("FooService")<{
	readonly foo: string
}> {}

class BarService extends Token("BarService")<{
	readonly bar: number
}> {}

type FooInstance = TokenType<typeof FooService>
type BarInstance = TokenType<typeof BarService>

class NotFoundError extends TypedError("NotFound")<{
	readonly resource: string
}> {}

class TimeoutError extends TypedError("Timeout")<{
	readonly ms: number
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Program.provide()
// ─────────────────────────────────────────────────────────────────────────────

test("Program.provide() removes tokens from requirements", () => {
	const prog = {} as Program<string, Error, FooInstance | BarInstance>

	const fooProvider = new Provider().provide(FooService, { foo: "hello" })

	// After providing Foo, only Bar remains
	const provided = prog.provide(fooProvider)
	expectTypeOf(provided).toEqualTypeOf<Program<string, Error, BarInstance>>()
})

test("Program.provide() with all tokens results in never requirements", () => {
	const prog = {} as Program<string, Error, FooInstance>

	const fooProvider = new Provider().provide(FooService, { foo: "hello" })

	const provided = prog.provide(fooProvider)
	expectTypeOf(provided).toEqualTypeOf<Program<string, Error, never>>()
})

test("Program.provide() preserves value and error types", () => {
	const prog = {} as Program<number, TypeError, FooInstance>

	const fooProvider = new Provider().provide(FooService, { foo: "hello" })

	const provided = prog.provide(fooProvider)
	expectTypeOf(provided).toEqualTypeOf<Program<number, TypeError, never>>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Program.then()
// ─────────────────────────────────────────────────────────────────────────────

test("Program.then() transforms value type with sync function", () => {
	const prog = {} as Program<string, Error, never>

	const mapped = prog.then((s) => s.length)
	expectTypeOf(mapped).toEqualTypeOf<Program<number, Error, never>>()
})

test("Program.then() unwraps Promise return", () => {
	const prog = {} as Program<string, Error, never>

	const mapped = prog.then((s) => Promise.resolve(s.length))
	expectTypeOf(mapped).toEqualTypeOf<Program<number, Error, never>>()
})

test("Program.then() accumulates errors from returned Program", () => {
	const prog = {} as Program<string, Error, never>
	const inner = {} as Program<number, TypeError, never>

	const mapped = prog.then(() => inner)
	expectTypeOf(mapped).toEqualTypeOf<
		Program<number, Error | TypeError, never>
	>()
})

test("Program.then() accumulates requirements from returned Program", () => {
	const prog = {} as Program<string, Error, never>
	const inner = {} as Program<number, TypeError, FooInstance>

	const mapped = prog.then(() => inner)
	expectTypeOf(mapped).toEqualTypeOf<
		Program<number, Error | TypeError, FooInstance>
	>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Program.catch()
// ─────────────────────────────────────────────────────────────────────────────

test("Program.catch() with function recovers all errors", () => {
	const prog = {} as Program<string, NotFoundError | TimeoutError, never>

	const caught = prog.catch((err) => {
		expectTypeOf(err).toEqualTypeOf<NotFoundError | TimeoutError>()
		return "default"
	})

	// Error channel should be cleared, value includes recovery type
	expectTypeOf(caught).toEqualTypeOf<
		Program<string | "default", never, never>
	>()
})

test("Program.catch() by name removes specific error", () => {
	const prog = {} as Program<string, NotFoundError | TimeoutError, never>

	const caught = prog.catch("NotFound", (err) => {
		expectTypeOf(err).toEqualTypeOf<NotFoundError>()
		return null
	})

	// NotFound is removed, TimeoutError remains
	expectTypeOf(caught).toEqualTypeOf<
		Program<string | null, TimeoutError, never>
	>()
})

test("Program.catch() with handlers object", () => {
	const prog = {} as Program<string, NotFoundError | TimeoutError, never>

	const caught = prog.catch({
		NotFound: (err) => {
			expectTypeOf(err).toEqualTypeOf<NotFoundError>()
			return "not-found"
		},
		Timeout: (err) => {
			expectTypeOf(err).toEqualTypeOf<TimeoutError>()
			return "timed-out"
		},
	})

	// All errors handled, value is union of handler returns
	expectTypeOf(caught).toEqualTypeOf<
		Program<string | "not-found" | "timed-out", never, never>
	>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Program.tap()
// ─────────────────────────────────────────────────────────────────────────────

test("Program.tap() preserves all type parameters", () => {
	const prog = {} as Program<string, Error, FooInstance>

	const tapped = prog.tap((value) => {
		expectTypeOf(value).toEqualTypeOf<string>()
	})

	expectTypeOf(tapped).toEqualTypeOf<Program<string, Error, FooInstance>>()
})

test("Program.tap() with observer accepts TapObserver", () => {
	const prog = {} as Program<string, Error, FooInstance>

	// TapObserver has optional value and error handlers
	const tapped = prog.tap({
		value: (_v) => {},
		error: (_e) => {},
	})

	expectTypeOf(tapped).toEqualTypeOf<Program<string, Error, FooInstance>>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Program.timeout()
// ─────────────────────────────────────────────────────────────────────────────

test("Program.timeout() adds timeout error to union", () => {
	const prog = {} as Program<string, NotFoundError, never>

	const withTimeout = prog.timeout(1000, () => new TimeoutError({ ms: 1000 }))

	expectTypeOf(withTimeout).toEqualTypeOf<
		Program<string, NotFoundError | TimeoutError, never>
	>()
})

test("Program.timeout() without error factory keeps same error type", () => {
	const prog = {} as Program<string, NotFoundError, never>

	const withTimeout = prog.timeout(1000)

	expectTypeOf(withTimeout).toEqualTypeOf<
		Program<string, NotFoundError, never>
	>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Program.retry()
// ─────────────────────────────────────────────────────────────────────────────

test("Program.retry() preserves all type parameters", () => {
	const prog = {} as Program<string, Error, FooInstance>

	const retried = prog.retry(3)
	expectTypeOf(retried).toEqualTypeOf<Program<string, Error, FooInstance>>()
})

test("Program.retry() with options preserves types", () => {
	const prog = {} as Program<string, Error, never>

	const retried = prog.retry({ times: 3, delay: 100 })
	expectTypeOf(retried).toEqualTypeOf<Program<string, Error, never>>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Program.finally()
// ─────────────────────────────────────────────────────────────────────────────

test("Program.finally() preserves all type parameters", () => {
	const prog = {} as Program<string, Error, FooInstance>

	const withFinally = prog.finally(() => {
		// cleanup
	})

	expectTypeOf(withFinally).toEqualTypeOf<Program<string, Error, FooInstance>>()
})
