import { expectTypeOf, test } from "vitest"
import { TypedError } from "./errors"
import type { Program } from "./program"
import type { Result } from "./result"
import { Shell } from "./shell"
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

class BazService extends Token("BazService")<{
	readonly baz: boolean
}> {}

type FooInstance = TokenType<typeof FooService>
type BarInstance = TokenType<typeof BarService>
type BazInstance = TokenType<typeof BazService>

class NotFoundError extends TypedError("NotFound")<{
	readonly resource: string
}> {}

class TimeoutError extends TypedError("Timeout")<{
	readonly ms: number
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Shell.require()
// ─────────────────────────────────────────────────────────────────────────────

test("Shell.require() accumulates token requirements", () => {
	const shell = new Shell()
	expectTypeOf(shell).toEqualTypeOf<Shell<never>>()

	const withFoo = shell.require(FooService)
	expectTypeOf(withFoo).toEqualTypeOf<Shell<FooInstance>>()

	const withFooBar = withFoo.require(BarService)
	expectTypeOf(withFooBar).toEqualTypeOf<Shell<FooInstance | BarInstance>>()
})

test("Shell.require() with multiple tokens at once", () => {
	const shell = new Shell().require(FooService, BarService, BazService)
	expectTypeOf(shell).toEqualTypeOf<
		Shell<FooInstance | BarInstance | BazInstance>
	>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Shell.try() with function
// ─────────────────────────────────────────────────────────────────────────────

test("Shell.try(fn) infers Program types from callback return", () => {
	const shell = new Shell()

	const prog = shell.try(() => "hello")
	expectTypeOf(prog).toEqualTypeOf<Program<string, never, never>>()
})

test("Shell.try(fn) infers requirements from shell", () => {
	const shell = new Shell().require(FooService, BarService)

	const prog = shell.try((ctx) => {
		expectTypeOf(ctx.get(FooService).foo).toEqualTypeOf<string>()
		return "hello"
	})

	expectTypeOf(prog).toEqualTypeOf<
		Program<string, never, FooInstance | BarInstance>
	>()
})

test("Shell.try(fn) with Promise return unwraps Promise", () => {
	const shell = new Shell()

	const prog = shell.try(() => Promise.resolve(42))
	expectTypeOf(prog).toEqualTypeOf<Program<number, never, never>>()
})

test("Shell.try(fn) with Program return accumulates types", () => {
	const shell = new Shell().require(FooService)
	const inner = {} as Program<number, NotFoundError, BarInstance>

	const prog = shell.try(() => inner)
	expectTypeOf(prog).toEqualTypeOf<
		Program<number, NotFoundError, FooInstance | BarInstance>
	>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Shell.try() with { try, catch } options
// ─────────────────────────────────────────────────────────────────────────────

test("Shell.try({ try, catch }) infers error from catch handler", () => {
	const shell = new Shell()

	const prog = shell.try({
		try: () => JSON.parse("{}"),
		catch: (e) => new Error(`Parse failed: ${e}`),
	})

	// JSON.parse returns any, catch returns Error
	expectTypeOf(prog).toMatchTypeOf<Program<any, Error, never>>()
})

test("Shell.try({ try, catch }) with typed error", () => {
	const shell = new Shell()

	const prog = shell.try({
		try: () => "result" as const,
		catch: () => new NotFoundError({ resource: "config" }),
	})

	expectTypeOf(prog).toEqualTypeOf<Program<"result", NotFoundError, never>>()
})

test("Shell.try({ try, catch }) with requirements", () => {
	const shell = new Shell().require(FooService)

	const prog = shell.try({
		try: (ctx) => ctx.get(FooService).foo,
		catch: () => new TimeoutError({ ms: 1000 }),
	})

	expectTypeOf(prog).toEqualTypeOf<Program<string, TimeoutError, FooInstance>>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Shell.fail()
// ─────────────────────────────────────────────────────────────────────────────

test("Shell.fail() returns Program<never, E, never>", () => {
	const shell = new Shell()

	const prog = shell.fail(new NotFoundError({ resource: "user" }))
	expectTypeOf(prog).toEqualTypeOf<Program<never, NotFoundError, never>>()
})

test("Shell.fail() with string error", () => {
	const shell = new Shell()

	const prog = shell.fail("something went wrong")
	expectTypeOf(prog).toEqualTypeOf<Program<never, string, never>>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Shell.all()
// ─────────────────────────────────────────────────────────────────────────────

test("Shell.all() produces tuple of values", () => {
	const shell = new Shell()

	const p1 = {} as Program<string, never, never>
	const p2 = {} as Program<number, never, never>
	const p3 = {} as Program<boolean, never, never>

	const combined = shell.all([p1, p2, p3])
	expectTypeOf(combined).toEqualTypeOf<
		Program<[string, number, boolean], never, never>
	>()
})

test("Shell.all() combines errors into union", () => {
	const shell = new Shell()

	const p1 = {} as Program<string, NotFoundError, never>
	const p2 = {} as Program<number, TimeoutError, never>

	const combined = shell.all([p1, p2])
	expectTypeOf(combined).toEqualTypeOf<
		Program<[string, number], NotFoundError | TimeoutError, never>
	>()
})

test("Shell.all() with runnable programs produces tuple", () => {
	const shell = new Shell()

	const p1 = {} as Program<string, Error, never>
	const p2 = {} as Program<number, TypeError, never>

	const combined = shell.all([p1, p2])
	// Shell.all() produces a tuple of values
	expectTypeOf(combined).toMatchTypeOf<
		Program<[string, number], Error | TypeError, never>
	>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Shell.any() and Shell.race()
// ─────────────────────────────────────────────────────────────────────────────

test("Shell.any() returns union of values", () => {
	const shell = new Shell()

	const p1 = {} as Program<string, NotFoundError, never>
	const p2 = {} as Program<number, TimeoutError, never>

	const combined = shell.any([p1, p2])
	expectTypeOf(combined).toEqualTypeOf<
		Program<string | number, NotFoundError | TimeoutError, never>
	>()
})

test("Shell.race() returns union of values", () => {
	const shell = new Shell()

	const p1 = {} as Program<string, NotFoundError, never>
	const p2 = {} as Program<number, TimeoutError, never>

	const combined = shell.race([p1, p2])
	expectTypeOf(combined).toEqualTypeOf<
		Program<string | number, NotFoundError | TimeoutError, never>
	>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Shell.run()
// ─────────────────────────────────────────────────────────────────────────────

test("Shell.run() only accepts Program with never requirements", () => {
	const shell = new Shell()

	const runnable = {} as Program<string, Error, never>
	const notRunnable = {} as Program<string, Error, FooInstance>

	// This should work
	shell.run(runnable)

	// This should be a type error
	// @ts-expect-error - Program has unfulfilled requirements
	shell.run(notRunnable)
})

test("Shell.run() returns Promise<Result<T, E>> by default", () => {
	const shell = new Shell()
	const prog = {} as Program<string, Error, never>

	const result = shell.run(prog)
	expectTypeOf(result).toEqualTypeOf<Promise<Result<string, Error>>>()
})

test("Shell.run() with mode: unwrap returns Promise<T>", () => {
	const shell = new Shell()
	const prog = {} as Program<string, Error, never>

	const result = shell.run(prog, { mode: "unwrap" })
	expectTypeOf(result).toEqualTypeOf<Promise<string>>()
})

test("Shell.run() with mode: result returns Promise<Result<T, E>>", () => {
	const shell = new Shell()
	const prog = {} as Program<string, Error, never>

	const result = shell.run(prog, { mode: "result" })
	expectTypeOf(result).toEqualTypeOf<Promise<Result<string, Error>>>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Shell.provide()
// ─────────────────────────────────────────────────────────────────────────────

test("Shell.provide() creates Provider with token", () => {
	const shell = new Shell()

	const provider = shell.provide(FooService, { foo: "hello" })
	expectTypeOf(provider).toMatchTypeOf<{ provide: Function }>()
})
