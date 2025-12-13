import { describe, expectTypeOf, test } from "vitest"
import { TypedError } from "./errors"
import type { Program } from "./program"
import { Provider } from "./provider"
import { Token } from "./token"
import type { Tracer } from "./tracer"

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

describe("Program.provide()", () => {
	describe("with Provider", () => {
		test("removes tokens from requirements", () => {
			const program = {} as Program<string, Error, FooService | BarService>
			const fooProvider = new Provider().provide(FooService, { foo: "hello" })
			const provided = program.provide(fooProvider)

			expectTypeOf(provided).toEqualTypeOf<Program<string, Error, BarService>>()
		})

		test("with all tokens results in never requirements", () => {
			const program = {} as Program<string, Error, FooService>
			const fooProvider = new Provider().provide(FooService, { foo: "hello" })
			const provided = program.provide(fooProvider)

			expectTypeOf(provided).toEqualTypeOf<Program<string, Error, never>>()
		})

		test("preserves value and error types", () => {
			const program = {} as Program<number, TypeError, FooService>
			const fooProvider = new Provider().provide(FooService, { foo: "hello" })
			const provided = program.provide(fooProvider)

			expectTypeOf(provided).toEqualTypeOf<Program<number, TypeError, never>>()
		})
	})

	describe("with Token and factory", () => {
		test("removes token from requirements with static value", () => {
			const program = {} as Program<string, Error, FooService | BarService>
			const provided = program.provide(FooService, { foo: "hello" })

			expectTypeOf(provided).toEqualTypeOf<Program<string, Error, BarService>>()
		})

		test("removes token from requirements with factory function", () => {
			const program = {} as Program<string, Error, FooService | BarService>
			const provided = program.provide(FooService, () => ({ foo: "hello" }))

			expectTypeOf(provided).toEqualTypeOf<Program<string, Error, BarService>>()
		})

		test("with all tokens results in never requirements", () => {
			const program = {} as Program<string, Error, FooService>
			const provided = program.provide(FooService, { foo: "hello" })

			expectTypeOf(provided).toEqualTypeOf<Program<string, Error, never>>()
		})

		test("preserves value and error types", () => {
			const program = {} as Program<number, TypeError, FooService>
			const provided = program.provide(FooService, { foo: "hello" })

			expectTypeOf(provided).toEqualTypeOf<Program<number, TypeError, never>>()
		})
	})
})

describe("Program.tap()", () => {
	describe("with (value) => T function", () => {
		test("preserves all type parameters with void return", () => {
			const program = {} as Program<string, Error, FooService>
			const tapped = program.tap((value) => {
				expectTypeOf(value).toEqualTypeOf<string>()
			})

			expectTypeOf(tapped).toEqualTypeOf<Program<string, Error, FooService>>()
		})

		test("preserves value type but accumulates errors from Program return", () => {
			const program = {} as Program<string, Error, FooService>
			const inner = {} as Program<void, NotFoundError, BarService>
			const tapped = program.tap(() => inner)

			expectTypeOf(tapped).toEqualTypeOf<
				Program<string, Error | NotFoundError, FooService | BarService>
			>()
		})
	})

	describe("with TapOptions", () => {
		test("preserves all type parameters", () => {
			const program = {} as Program<string, Error, FooService>
			const tapped = program.tap({
				value: (_v) => {},
				error: (_e) => {},
			})

			expectTypeOf(tapped).toEqualTypeOf<Program<string, Error, FooService>>()
		})

		test("accumulates errors from value handler", () => {
			const program = {} as Program<string, Error, FooService>
			const inner = {} as Program<void, NotFoundError, BarService>
			const tapped = program.tap({
				value: () => inner,
			})

			expectTypeOf(tapped).toEqualTypeOf<
				Program<string, Error | NotFoundError, FooService | BarService>
			>()
		})

		test("accumulates errors from error handler", () => {
			const program = {} as Program<string, Error, FooService>
			const inner = {} as Program<void, TimeoutError, BazService>
			const tapped = program.tap({
				error: () => inner,
			})

			expectTypeOf(tapped).toEqualTypeOf<
				Program<string, Error | TimeoutError, FooService | BazService>
			>()
		})

		test("accumulates errors and requirements from both handlers", () => {
			const program = {} as Program<string, Error, FooService>
			const valueInner = {} as Program<void, NotFoundError, BarService>
			const errorInner = {} as Program<void, TimeoutError, BazService>
			const tapped = program.tap({
				value: () => valueInner,
				error: () => errorInner,
			})

			expectTypeOf(tapped).toEqualTypeOf<
				Program<
					string,
					Error | NotFoundError | TimeoutError,
					FooService | BarService | BazService
				>
			>()
		})
	})
})

describe("Program.span()", () => {
	test("adds Tracer requirement", () => {
		const program = {} as Program<string, Error, never>
		const traced = program.span("mySpan")

		expectTypeOf(traced).toEqualTypeOf<Program<string, Error, Tracer>>()
	})

	test("preserves value and error types", () => {
		const program = {} as Program<number, NotFoundError, never>
		const traced = program.span("operation", { userId: 123 })

		expectTypeOf(traced).toEqualTypeOf<Program<number, NotFoundError, Tracer>>()
	})

	test("combines with existing requirements", () => {
		const program = {} as Program<string, TimeoutError, FooService>
		const traced = program.span("fetch")

		expectTypeOf(traced).toEqualTypeOf<
			Program<string, TimeoutError, FooService | Tracer>
		>()
	})

	test("chains multiple span calls", () => {
		const program = {} as Program<string, Error, never>
		const traced = program.span("step1").span("step2").span("step3")

		expectTypeOf(traced).toEqualTypeOf<Program<string, Error, Tracer>>()
	})
})

describe("Program.pipe()", () => {
	test("transforms program with function", () => {
		const program = {} as Program<string, Error, FooService>
		const piped = program.pipe(
			(_p) => ({}) as Program<number, TypeError, BarService>,
		)

		expectTypeOf(piped).toEqualTypeOf<Program<number, TypeError, BarService>>()
	})

	test("preserves types when function returns same types", () => {
		const program = {} as Program<string, NotFoundError, FooService>
		const piped = program.pipe((p) => p)

		expectTypeOf(piped).toEqualTypeOf<
			Program<string, NotFoundError, FooService>
		>()
	})

	test("chains multiple pipe calls", () => {
		const program = {} as Program<string, Error, never>

		const transform1 = (_p: Program<string, Error, never>) =>
			({}) as Program<number, Error, FooService>

		const transform2 = (_p: Program<number, Error, FooService>) =>
			({}) as Program<boolean, TypeError, BarService>

		const piped = program.pipe(transform1).pipe(transform2)

		expectTypeOf(piped).toEqualTypeOf<Program<boolean, TypeError, BarService>>()
	})
})

describe("Program.then()", () => {
	test("transforms value type with sync function", () => {
		const program = {} as Program<string, Error, never>
		const mapped = program.then((s) => s.length)

		expectTypeOf(mapped).toEqualTypeOf<Program<number, Error, never>>()
	})

	test("unwraps Promise return", () => {
		const program = {} as Program<string, Error, never>
		const mapped = program.then((s) => Promise.resolve(s.length))

		expectTypeOf(mapped).toEqualTypeOf<Program<number, Error, never>>()
	})

	test("accumulates errors from returned Program", () => {
		const program = {} as Program<string, Error, never>
		const inner = {} as Program<number, TypeError, never>
		const mapped = program.then(() => inner)

		expectTypeOf(mapped).toEqualTypeOf<
			Program<number, Error | TypeError, never>
		>()
	})

	test("accumulates requirements from returned Program", () => {
		const program = {} as Program<string, Error, never>
		const inner = {} as Program<number, TypeError, FooService>
		const mapped = program.then(() => inner)

		expectTypeOf(mapped).toEqualTypeOf<
			Program<number, Error | TypeError, FooService>
		>()
	})
})

describe("Program.catch()", () => {
	describe("with (error) => T function", () => {
		test("recovers all errors", () => {
			const program = {} as Program<string, NotFoundError | TimeoutError, never>
			const caught = program.catch((err) => {
				expectTypeOf(err).toEqualTypeOf<NotFoundError | TimeoutError>()
				return "default"
			})

			expectTypeOf(caught).toEqualTypeOf<
				Program<string | "default", never, never>
			>()
		})

		test("accumulates errors and requirements from returned Program", () => {
			const program = {} as Program<string, NotFoundError, FooService>
			const inner = {} as Program<string, TimeoutError, BarService>
			const caught = program.catch(() => inner)

			expectTypeOf(caught).toEqualTypeOf<
				Program<string, TimeoutError, FooService | BarService>
			>()
		})
	})

	describe("with (name, handler) arguments", () => {
		test("removes specific error by name", () => {
			const program = {} as Program<string, NotFoundError | TimeoutError, never>
			const caught = program.catch("NotFound", (err) => {
				expectTypeOf(err).toEqualTypeOf<NotFoundError>()
				return null
			})

			expectTypeOf(caught).toEqualTypeOf<
				Program<string | null, TimeoutError, never>
			>()
		})

		test("accumulates errors and requirements from returned Program", () => {
			const program = {} as Program<
				string,
				NotFoundError | TimeoutError,
				FooService
			>
			const inner = {} as Program<string, Error, BarService>
			const caught = program.catch("NotFound", () => inner)

			expectTypeOf(caught).toEqualTypeOf<
				Program<string, TimeoutError | Error, FooService | BarService>
			>()
		})
	})

	describe("with ErrorHandlers object", () => {
		test("handles all errors with handlers", () => {
			const program = {} as Program<string, NotFoundError | TimeoutError, never>
			const caught = program.catch({
				NotFound: (err) => {
					expectTypeOf(err).toEqualTypeOf<NotFoundError>()
					return "not-found"
				},
				Timeout: (err) => {
					expectTypeOf(err).toEqualTypeOf<TimeoutError>()
					return "timed-out"
				},
			})

			expectTypeOf(caught).toEqualTypeOf<
				Program<string | "not-found" | "timed-out", never, never>
			>()
		})

		test("handles partial errors leaving remaining in union", () => {
			const program = {} as Program<string, NotFoundError | TimeoutError, never>
			const caught = program.catch({
				NotFound: (err) => {
					expectTypeOf(err).toEqualTypeOf<NotFoundError>()
					return "not-found"
				},
			})

			expectTypeOf(caught).toEqualTypeOf<
				Program<string | "not-found", TimeoutError, never>
			>()
		})

		test("preserves original requirements", () => {
			const program = {} as Program<
				string,
				NotFoundError | TimeoutError,
				FooService
			>

			const caught = program.catch({
				NotFound: () => "not-found",
				Timeout: () => "timed-out",
			})

			expectTypeOf(caught).toEqualTypeOf<
				Program<string | "not-found" | "timed-out", never, FooService>
			>()
		})
	})
})

describe("Program.finally()", () => {
	test("preserves all type parameters with void return", () => {
		const program = {} as Program<string, Error, FooService>
		const withFinally = program.finally(() => {
			// cleanup
		})

		expectTypeOf(withFinally).toEqualTypeOf<
			Program<string, Error, FooService>
		>()
	})

	test("preserves all type parameters with Promise return", () => {
		const program = {} as Program<string, Error, FooService>
		const withFinally = program.finally(async () => {
			// async cleanup
		})

		expectTypeOf(withFinally).toEqualTypeOf<
			Program<string, Error, FooService>
		>()
	})
})

describe("Program.timeout()", () => {
	test("preserves types without error factory", () => {
		const program = {} as Program<string, NotFoundError, never>
		const withTimeout = program.timeout(1000)

		expectTypeOf(withTimeout).toEqualTypeOf<
			Program<string, NotFoundError, never>
		>()
	})

	test("adds timeout error to union with error factory", () => {
		const program = {} as Program<string, NotFoundError, never>
		const withTimeout = program.timeout(
			1000,
			() => new TimeoutError({ ms: 1000 }),
		)

		expectTypeOf(withTimeout).toEqualTypeOf<
			Program<string, NotFoundError | TimeoutError, never>
		>()
	})
})

describe("Program.retry()", () => {
	test("with number preserves all type parameters", () => {
		const program = {} as Program<string, Error, FooService>
		const retried = program.retry(3)

		expectTypeOf(retried).toEqualTypeOf<Program<string, Error, FooService>>()
	})

	test("with RetryOptions preserves all type parameters", () => {
		const program = {} as Program<string, Error, never>
		const retried = program.retry({ times: 3, delay: 100 })

		expectTypeOf(retried).toEqualTypeOf<Program<string, Error, never>>()
	})
})
