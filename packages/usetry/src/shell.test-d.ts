import { describe, expectTypeOf, test } from "vitest"
import { TypedError } from "./errors"
import type { Program } from "./program"
import type { Provider } from "./provider"
import type { Result } from "./result"
import { Shell } from "./shell"
import { Token } from "./token"

// Test Services

class FooService extends Token("FooService")<{
	readonly foo: string
}> {}

class BarService extends Token("BarService")<{
	readonly bar: number
}> {}

class BazService extends Token("BazService")<{
	readonly baz: boolean
}> {}

// Test Errors

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
		expectTypeOf(withFoo).toEqualTypeOf<Shell<FooService>>()

		const withFooBar = withFoo.require(BarService)
		expectTypeOf(withFooBar).toEqualTypeOf<Shell<FooService | BarService>>()
	})

	test("with multiple tokens at once", () => {
		const shell = new Shell().require(FooService, BarService, BazService)
		expectTypeOf(shell).toEqualTypeOf<
			Shell<FooService | BarService | BazService>
		>()
	})
})

describe("Shell.provide()", () => {
	test("creates Provider with static value", () => {
		const shell = new Shell()
		const provider = shell.provide(FooService, { foo: "hello" })

		expectTypeOf(provider).toEqualTypeOf<Provider<FooService>>()
	})

	test("creates Provider with factory function", () => {
		const shell = new Shell()
		const provider = shell.provide(FooService, () => ({ foo: "hello" }))

		expectTypeOf(provider).toEqualTypeOf<Provider<FooService>>()
	})
})

describe("Shell.use()", () => {
	test("returns Shell with same requirements", () => {
		const shell = new Shell().require(FooService, BarService)
		const withMiddleware = shell.use(async (ctx) => {
			// Can access services directly via ctx.get()
			expectTypeOf(ctx.get(FooService).foo).toEqualTypeOf<string>()
			expectTypeOf(ctx.get(BarService).bar).toEqualTypeOf<number>()

			// @ts-expect-error - BazService is not required by the shell
			ctx.get(BazService)

			// Can access signal directly
			expectTypeOf(ctx.signal).toEqualTypeOf<AbortSignal>()

			// Call next() to continue execution
			return ctx.next()
		})

		expectTypeOf(withMiddleware).toEqualTypeOf<Shell<FooService | BarService>>()
	})
})

describe("Shell.from()", () => {
	describe("with synchronous values", () => {
		test("creates Program from number", () => {
			const shell = new Shell()
			const program = shell.from(123)

			expectTypeOf(program).toEqualTypeOf<Program<number, never, never>>()
		})

		test("creates Program from string", () => {
			const shell = new Shell()
			const program = shell.from("hello")

			expectTypeOf(program).toEqualTypeOf<Program<string, never, never>>()
		})

		test("creates Program from object", () => {
			const shell = new Shell()
			const user = { id: 1, name: "Alice" }
			const program = shell.from(user)

			expectTypeOf(program).toEqualTypeOf<
				Program<{ id: number; name: string }, never, never>
			>()
		})

		test("creates Program from Date", () => {
			const shell = new Shell()
			const program = shell.from(new Date())

			expectTypeOf(program).toEqualTypeOf<Program<Date, never, never>>()
		})

		test("adds shell requirements to sync value", () => {
			const shell = new Shell().require(FooService, BarService)
			const program = shell.from(42)

			expectTypeOf(program).toEqualTypeOf<
				Program<number, never, FooService | BarService>
			>()
		})
	})

	describe("with Promises", () => {
		test("creates Program from Promise", () => {
			const shell = new Shell()
			const promise = Promise.resolve(123)
			const program = shell.from(promise)

			expectTypeOf(program).toEqualTypeOf<Program<number, never, never>>()
		})

		test("creates Program from Promise with object", () => {
			const shell = new Shell()
			const promise = Promise.resolve({ id: 1, name: "Alice" })
			const program = shell.from(promise)

			expectTypeOf(program).toEqualTypeOf<
				Program<{ id: number; name: string }, never, never>
			>()
		})

		test("adds shell requirements to Promise", () => {
			const shell = new Shell().require(FooService)
			const promise = Promise.resolve("hello")
			const program = shell.from(promise)

			expectTypeOf(program).toEqualTypeOf<Program<string, never, FooService>>()
		})
	})

	describe("with Programs", () => {
		test("preserves program types", () => {
			const shell = new Shell()
			const program = {} as Program<string, NotFoundError, never>
			const wrapped = shell.from(program)

			expectTypeOf(wrapped).toEqualTypeOf<
				Program<string, NotFoundError, never>
			>()
		})

		test("combines shell requirements with program requirements", () => {
			const shell = new Shell().require(FooService)
			const program = {} as Program<string, NotFoundError, BarService>
			const wrapped = shell.from(program)

			expectTypeOf(wrapped).toEqualTypeOf<
				Program<string, NotFoundError, FooService | BarService>
			>()
		})

		test("adds shell requirements to program with no requirements", () => {
			const shell = new Shell().require(FooService, BarService)
			const program = {} as Program<number, TimeoutError, never>
			const wrapped = shell.from(program)

			expectTypeOf(wrapped).toEqualTypeOf<
				Program<number, TimeoutError, FooService | BarService>
			>()
		})

		test("works with shell that has no requirements", () => {
			const shell = new Shell()
			const program = {} as Program<string, NotFoundError, FooService>
			const wrapped = shell.from(program)

			expectTypeOf(wrapped).toEqualTypeOf<
				Program<string, NotFoundError, FooService>
			>()
		})
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
				Program<string, never, FooService | BarService>
			>()
		})

		test("with Promise return unwraps Promise", () => {
			const shell = new Shell()
			const program = shell.try(() => Promise.resolve(42))

			expectTypeOf(program).toEqualTypeOf<Program<number, never, never>>()
		})

		test("with Program return accumulates types", () => {
			const shell = new Shell().require(FooService)
			const inner = {} as Program<number, NotFoundError, BarService>
			const program = shell.try(() => inner)

			expectTypeOf(program).toEqualTypeOf<
				Program<number, NotFoundError, FooService | BarService>
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
				Program<string, TimeoutError, FooService>
			>()
		})

		test("with Program return accumulates types", () => {
			const shell = new Shell().require(FooService)
			const inner = {} as Program<number, NotFoundError, BarService>
			const program = shell.try({
				try: () => inner,
				catch: () => new TimeoutError({ ms: 1000 }),
			})

			expectTypeOf(program).toEqualTypeOf<
				Program<number, TimeoutError | NotFoundError, FooService | BarService>
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

		const p1 = {} as Program<string, NotFoundError, FooService>
		const p2 = {} as Program<number, TimeoutError, BarService>
		const p3 = {} as Program<boolean, never, BazService>

		const combined = shell.all([p1, p2, p3])

		expectTypeOf(combined).toEqualTypeOf<
			Program<
				[string, number, boolean],
				NotFoundError | TimeoutError,
				FooService | BarService | BazService
			>
		>()
	})

	test("accepts mixed programs with and without requirements", () => {
		const shell = new Shell()

		const p1 = {} as Program<string, never, never>
		const p2 = {} as Program<number, NotFoundError, FooService>

		const combined = shell.all([p1, p2])

		expectTypeOf(combined).toEqualTypeOf<
			Program<[string, number], NotFoundError, FooService>
		>()
	})

	test("combines shell requirements with program requirements", () => {
		const shell = new Shell().require(FooService)

		const p1 = {} as Program<string, NotFoundError, BarService>
		const p2 = {} as Program<number, TimeoutError, never>

		const combined = shell.all([p1, p2])

		expectTypeOf(combined).toEqualTypeOf<
			Program<
				[string, number],
				NotFoundError | TimeoutError,
				FooService | BarService
			>
		>()
	})

	test("with ConcurrencyOptions preserves types", () => {
		const shell = new Shell()

		const p1 = {} as Program<string, NotFoundError, FooService>
		const p2 = {} as Program<number, TimeoutError, BarService>

		const combined = shell.all([p1, p2], { concurrency: 5 })

		expectTypeOf(combined).toEqualTypeOf<
			Program<
				[string, number],
				NotFoundError | TimeoutError,
				FooService | BarService
			>
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

		const p1 = {} as Program<string, NotFoundError, FooService>
		const p2 = {} as Program<number, TimeoutError, BarService>

		const combined = shell.any([p1, p2])

		expectTypeOf(combined).toEqualTypeOf<
			Program<
				string | number,
				NotFoundError | TimeoutError,
				FooService | BarService
			>
		>()
	})

	test("combines shell requirements with program requirements", () => {
		const shell = new Shell().require(FooService)

		const p1 = {} as Program<string, NotFoundError, BarService>
		const p2 = {} as Program<number, TimeoutError, never>

		const combined = shell.any([p1, p2])

		expectTypeOf(combined).toEqualTypeOf<
			Program<
				string | number,
				NotFoundError | TimeoutError,
				FooService | BarService
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

		const p1 = {} as Program<string, NotFoundError, FooService>
		const p2 = {} as Program<number, TimeoutError, BarService>

		const combined = shell.race([p1, p2])

		expectTypeOf(combined).toEqualTypeOf<
			Program<
				string | number,
				NotFoundError | TimeoutError,
				FooService | BarService
			>
		>()
	})

	test("combines shell requirements with program requirements", () => {
		const shell = new Shell().require(FooService)

		const p1 = {} as Program<string, NotFoundError, BarService>
		const p2 = {} as Program<number, TimeoutError, never>

		const combined = shell.race([p1, p2])

		expectTypeOf(combined).toEqualTypeOf<
			Program<
				string | number,
				NotFoundError | TimeoutError,
				FooService | BarService
			>
		>()
	})
})

describe("Shell.run()", () => {
	test("only accepts Program with never requirements", () => {
		const shell = new Shell()
		const runnable = {} as Program<string, Error, never>
		const notRunnable = {} as Program<string, Error, FooService>

		// ✅ This should work
		shell.run(runnable)

		// @ts-expect-error ❌ Program has unfulfilled requirements
		shell.run(notRunnable)
	})

	test("returns Promise<Result<T, E>> by default", () => {
		const shell = new Shell()
		const program = {} as Program<string, Error, never>
		const result = shell.run(program)

		expectTypeOf(result).toEqualTypeOf<Promise<Result<string, Error>>>()
	})

	test("with unwrap: true returns Promise<T>", () => {
		const shell = new Shell()
		const program = {} as Program<string, Error, never>
		const result = shell.run(program, { unwrap: true })

		expectTypeOf(result).toEqualTypeOf<Promise<string>>()
	})

	test("with unwrap: false returns Promise<Result<T, E>>", () => {
		const shell = new Shell()
		const program = {} as Program<string, Error, never>
		const result = shell.run(program, { unwrap: false })

		expectTypeOf(result).toEqualTypeOf<Promise<Result<string, Error>>>()
	})

	test("with signal option returns Promise<Result<T, E>>", () => {
		const shell = new Shell()
		const program = {} as Program<string, Error, never>
		const controller = new AbortController()
		const result = shell.run(program, { signal: controller.signal })

		expectTypeOf(result).toEqualTypeOf<Promise<Result<string, Error>>>()
	})

	test("with signal and unwrap options", () => {
		const shell = new Shell()
		const program = {} as Program<string, Error, never>
		const controller = new AbortController()
		const result = shell.run(program, {
			signal: controller.signal,
			unwrap: true,
		})

		expectTypeOf(result).toEqualTypeOf<Promise<string>>()
	})
})
