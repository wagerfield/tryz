import { describe, expectTypeOf, test } from "vitest"
import { TypedError } from "./errors"
import type { Program } from "./program"
import type { Provider } from "./provider"
import type { Result } from "./result"
import { Shell } from "./shell"
import { Token, type TokenType } from "./token"

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

describe("Shell.require()", () => {
	test("accumulates token requirements", () => {
		const shell = new Shell()
		expectTypeOf(shell).toEqualTypeOf<Shell<never>>()

		const withFoo = shell.require(FooService)
		expectTypeOf(withFoo).toEqualTypeOf<Shell<FooInstance>>()

		const withFooBar = withFoo.require(BarService)
		expectTypeOf(withFooBar).toEqualTypeOf<Shell<FooInstance | BarInstance>>()
	})

	test("with multiple tokens at once", () => {
		const shell = new Shell().require(FooService, BarService, BazService)
		expectTypeOf(shell).toEqualTypeOf<
			Shell<FooInstance | BarInstance | BazInstance>
		>()
	})
})

describe("Shell.try()", () => {
	describe("with (ctx) => T function", () => {
		test("infers Program types from callback return", () => {
			const shell = new Shell()
			const program = shell.try(() => "hello")

			expectTypeOf(program).toEqualTypeOf<Program<string, never, never>>()
		})

		test("infers requirements from shell", () => {
			const shell = new Shell().require(FooService, BarService)
			const program = shell.try((ctx) => {
				expectTypeOf(ctx.get(FooService).foo).toEqualTypeOf<string>()
				return "hello"
			})

			expectTypeOf(program).toEqualTypeOf<
				Program<string, never, FooInstance | BarInstance>
			>()
		})

		test("with Promise return unwraps Promise", () => {
			const shell = new Shell()
			const program = shell.try(() => Promise.resolve(42))

			expectTypeOf(program).toEqualTypeOf<Program<number, never, never>>()
		})

		test("with Program return accumulates types", () => {
			const shell = new Shell().require(FooService)
			const inner = {} as Program<number, NotFoundError, BarInstance>
			const program = shell.try(() => inner)

			expectTypeOf(program).toEqualTypeOf<
				Program<number, NotFoundError, FooInstance | BarInstance>
			>()
		})
	})

	describe("with { try, catch } options", () => {
		test("infers error from catch handler", () => {
			const shell = new Shell()
			const program = shell.try({
				try: () => JSON.parse("{}"),
				catch: (e) => new Error(`Parse failed: ${e}`),
			})

			// JSON.parse returns any, catch returns Error
			expectTypeOf(program).toEqualTypeOf<Program<any, Error, never>>()
		})

		test("with typed error", () => {
			const shell = new Shell()
			const program = shell.try({
				try: () => "result" as const,
				catch: () => new NotFoundError({ resource: "config" }),
			})

			expectTypeOf(program).toEqualTypeOf<
				Program<"result", NotFoundError, never>
			>()
		})

		test("with requirements", () => {
			const shell = new Shell().require(FooService)
			const program = shell.try({
				try: (ctx) => ctx.get(FooService).foo,
				catch: () => new TimeoutError({ ms: 1000 }),
			})

			expectTypeOf(program).toEqualTypeOf<
				Program<string, TimeoutError, FooInstance>
			>()
		})
	})
})

describe("Shell.fail()", () => {
	test("returns Program<never, E, never>", () => {
		const shell = new Shell()
		const program = shell.fail(new NotFoundError({ resource: "user" }))

		expectTypeOf(program).toEqualTypeOf<Program<never, NotFoundError, never>>()
	})

	test("with string error", () => {
		const shell = new Shell()
		const program = shell.fail("something went wrong")

		expectTypeOf(program).toEqualTypeOf<Program<never, string, never>>()
	})
})

describe("Shell.all()", () => {
	test("produces tuple of values", () => {
		const shell = new Shell()

		const p1 = {} as Program<string, never, never>
		const p2 = {} as Program<number, never, never>
		const p3 = {} as Program<boolean, never, never>

		const combined = shell.all([p1, p2, p3])

		expectTypeOf(combined).toEqualTypeOf<
			Program<[string, number, boolean], never, never>
		>()
	})

	test("combines errors into union", () => {
		const shell = new Shell()

		const p1 = {} as Program<string, NotFoundError, never>
		const p2 = {} as Program<number, TimeoutError, never>

		const combined = shell.all([p1, p2])

		expectTypeOf(combined).toEqualTypeOf<
			Program<[string, number], NotFoundError | TimeoutError, never>
		>()
	})

	test("with runnable programs produces tuple", () => {
		const shell = new Shell()

		const p1 = {} as Program<string, Error, never>
		const p2 = {} as Program<number, TypeError, never>

		const combined = shell.all([p1, p2])

		// TypeError extends Error, so the union collapses to Error
		expectTypeOf(combined).toEqualTypeOf<
			Program<[string, number], Error, never>
		>()
	})

	test("accepts programs with requirements and combines them", () => {
		const shell = new Shell()

		const p1 = {} as Program<string, NotFoundError, FooInstance>
		const p2 = {} as Program<number, TimeoutError, BarInstance>
		const p3 = {} as Program<boolean, never, BazInstance>

		const combined = shell.all([p1, p2, p3])

		expectTypeOf(combined).toEqualTypeOf<
			Program<
				[string, number, boolean],
				NotFoundError | TimeoutError,
				FooInstance | BarInstance | BazInstance
			>
		>()
	})

	test("accepts mixed programs with and without requirements", () => {
		const shell = new Shell()

		const p1 = {} as Program<string, never, never>
		const p2 = {} as Program<number, NotFoundError, FooInstance>

		const combined = shell.all([p1, p2])

		expectTypeOf(combined).toEqualTypeOf<
			Program<[string, number], NotFoundError, FooInstance>
		>()
	})
})

describe("Shell.any()", () => {
	test("returns union of values", () => {
		const shell = new Shell()

		const p1 = {} as Program<string, NotFoundError, never>
		const p2 = {} as Program<number, TimeoutError, never>

		const combined = shell.any([p1, p2])

		expectTypeOf(combined).toEqualTypeOf<
			Program<string | number, NotFoundError | TimeoutError, never>
		>()
	})

	test("accepts programs with requirements and combines them", () => {
		const shell = new Shell()

		const p1 = {} as Program<string, NotFoundError, FooInstance>
		const p2 = {} as Program<number, TimeoutError, BarInstance>

		const combined = shell.any([p1, p2])

		expectTypeOf(combined).toEqualTypeOf<
			Program<
				string | number,
				NotFoundError | TimeoutError,
				FooInstance | BarInstance
			>
		>()
	})
})

describe("Shell.race()", () => {
	test("returns union of values", () => {
		const shell = new Shell()

		const p1 = {} as Program<string, NotFoundError, never>
		const p2 = {} as Program<number, TimeoutError, never>

		const combined = shell.race([p1, p2])

		expectTypeOf(combined).toEqualTypeOf<
			Program<string | number, NotFoundError | TimeoutError, never>
		>()
	})

	test("accepts programs with requirements and combines them", () => {
		const shell = new Shell()

		const p1 = {} as Program<string, NotFoundError, FooInstance>
		const p2 = {} as Program<number, TimeoutError, BarInstance>

		const combined = shell.race([p1, p2])

		expectTypeOf(combined).toEqualTypeOf<
			Program<
				string | number,
				NotFoundError | TimeoutError,
				FooInstance | BarInstance
			>
		>()
	})
})

describe("Shell.run()", () => {
	test("only accepts Program with never requirements", () => {
		const shell = new Shell()

		const runnable = {} as Program<string, Error, never>
		const notRunnable = {} as Program<string, Error, FooInstance>

		// This should work
		shell.run(runnable)

		// This should be a type error
		// @ts-expect-error - Program has unfulfilled requirements
		shell.run(notRunnable)
	})

	test("returns Promise<Result<T, E>> by default", () => {
		const shell = new Shell()
		const program = {} as Program<string, Error, never>
		const result = shell.run(program)

		expectTypeOf(result).toEqualTypeOf<Promise<Result<string, Error>>>()
	})

	test("with mode: unwrap returns Promise<T>", () => {
		const shell = new Shell()
		const program = {} as Program<string, Error, never>
		const result = shell.run(program, { mode: "unwrap" })

		expectTypeOf(result).toEqualTypeOf<Promise<string>>()
	})

	test("with mode: result returns Promise<Result<T, E>>", () => {
		const shell = new Shell()
		const program = {} as Program<string, Error, never>
		const result = shell.run(program, { mode: "result" })

		expectTypeOf(result).toEqualTypeOf<Promise<Result<string, Error>>>()
	})
})

describe("Shell.provide()", () => {
	test("creates Provider with token", () => {
		const shell = new Shell()
		const provider = shell.provide(FooService, { foo: "hello" })

		expectTypeOf(provider).toEqualTypeOf<Provider<FooInstance>>()
	})
})
