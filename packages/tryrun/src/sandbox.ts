import { TypedError } from "./errors"
import { x } from "./index"
import { Token } from "./token"

// ==============================================================
// Define tokens (services)
// ==============================================================

class Foo extends Token("Foo")<{
	readonly foo: "FOO"
}> {}

class Bar extends Token("Bar")<{
	readonly bar: "BAR"
}> {}

class Baz extends Token("Baz")<{
	readonly baz: "BAZ"
}> {}

// ==============================================================
// Define typed errors
// ==============================================================

class NotFoundError extends TypedError("NotFound")<{
	readonly resource: string
	readonly id: number
}> {}

class TimeoutError extends TypedError("Timeout")<{
	readonly ms: number
}> {}

// ==============================================================
// Create providers (composable recipe for implementations)
// ==============================================================

const fooProvider = x.provide(Foo, () => ({ foo: "FOO" as const }))
// fooProvider: Provider<Foo>

const baseProvider = fooProvider
	.provide(Bar, () => ({ bar: "BAR" as const }))
	.provide(Baz, (ctx) => {
		// Providers can access previously provided tokens via ctx
		ctx.get(Foo) // ✅ Foo is available
		ctx.get(Bar) // ✅ Bar is available

		// @ts-expect-error - Intentional: Baz is not yet provided
		ctx.get(Baz) // ❌ Type error: Baz is not yet provided

		return { baz: "BAZ" as const }
	})
// baseProvider: Provider<Foo | Bar | Baz>

// ==============================================================
// Declare requirements and create a program
// ==============================================================

const shell = x.require(Foo, Bar, Baz)
// shell: Shell<Foo | Bar | Baz>

// ==============================================================
// Optimistic semantics: values succeed, x.fail() fails
// ==============================================================

// Simple program - returning a value puts it on the success channel
const simple = x.try(() =>
	Math.random() > 0.5 ? ("yay" as const) : x.fail("nay" as const),
)
// simple: Program<"yay", "nay", never>

// Run simple program (no requirements to satisfy)
x.run(simple).then((r) => {
	if (r.success) {
		console.log(r.value) // "yay"
	} else {
		console.error(r.error) // "nay"
	}
})

// ==============================================================
// try with { try, catch } options for exception catching
// ==============================================================

// try with exception catching returns a typed error
x.try({
	try: () => JSON.parse('{"valid": true}'),
	catch: (e) => new Error(`Parse failed: ${e}`),
})
// → Program<any, Error, never>

// ==============================================================
// Program with requirements using then (formerly map)
// ==============================================================

const prog = shell
	.try((ctx) => {
		// ctx.get() is type-safe
		const { foo } = ctx.get(Foo)
		const { bar } = ctx.get(Bar)
		const { baz } = ctx.get(Baz)
		return { foo, bar, baz }
	})
	// then: can return value, Promise, or Program
	.then(({ foo, bar, baz }) => `${foo}:${bar}:${baz}` as const)
// prog: Program<"FOO:BAR:BAZ", never, Foo | Bar | Baz>

// ❌ Type Error: Cannot run - requirements (R) is not `never`
// @ts-expect-error - Intentional: prog has unfulfilled requirements
x.run(prog)

// ✅ Satisfy requirements with a Provider
const runnable = prog.provide(baseProvider).then((val) => {
	if (Math.random() > 0.5) return val
	return x.fail("failed" as const)
})
// runnable: Program<"FOO:BAR:BAZ", "failed", never>

// ✅ Now runnable - requirements (R) is `never`
const promise = x.run(runnable)

promise.then((result) => {
	if (result.success) {
		console.log(result.value) // "FOO:BAR:BAZ"
	} else {
		console.error(result.error)
	}
})

// ==============================================================
// Unified then examples (formerly map)
// ==============================================================

// then with sync value
const s1 = simple.then((val) => `s1:${val}` as const)
// → Program<"s1:yay", "nay", never>

// then with Promise (async transform)
const s2 = simple.then((val) => Promise.resolve(`s2:${val}` as const))
// → Program<"s2:yay", "nay", never>

// then with Program (composition)
const s3 = simple.then((val) =>
	shell.try((ctx) => {
		const { foo } = ctx.get(Foo)
		return `s3:${val}:${foo}` as const
	}),
)
// → Program<"s3:yay:FOO", "nay", Foo | Bar | Baz>

x.run(x.all([s1, s2, s3.provide(baseProvider)])).then((result) => {
	if (result.success) {
		console.log(result.value)
	} else {
		console.error(result.error)
	}
})

// ==============================================================
// catch with overloads
// ==============================================================

// Program with typed errors
const errorProg = x.try(() =>
	Math.random() > 0.5
		? ("success" as const)
		: Math.random() > 0.5
			? x.fail(new NotFoundError({ resource: "user", id: 123 }))
			: x.fail(new TimeoutError({ ms: 5000 })),
)
// errorProg: Program<"success", NotFoundError | TimeoutError, never>

// Catch all errors
const e1 = errorProg.catch((e) => {
	switch (e.name) {
		case "NotFound":
			return `not found resource: ${e.resource} id: ${e.id}` as const
	}
	return x.fail(e)
})
// → Program<"success" | string, never, never>

// Catch by name (name is type-safe: "NotFound" | "Timeout")
const e2 = errorProg
	.catch("NotFound", (err) => {
		// err is typed as NotFoundError
		console.log(`Resource not found: ${err.resource}`)
		return null // value recovers to success channel
	})
	.catch("Timeout", (err) => err.ms)
// → Program<"success" | null, TimeoutError, never>

// Catch multiple by name (keys are type-safe, handlers receive typed errors)
const e3 = errorProg.catch({
	NotFound: (err) => err.resource,
	Timeout: (err) => err.ms,
	// NotFound: (err) => `not found: ${err.resource}` as const,
	// Timeout: (err) => `timed out after ${err.ms}ms` as const,
})
// → Program<"success" | string, never, never>

x.all([e1, e2, e3])

// ==============================================================
// tap with function or observer
// ==============================================================

// tap with function (success only)
simple.tap((value) => console.log("Got value:", value))
// → Program<"yay", "nay", never>

// tap with observer (both success and error)
simple.tap({
	value: (v) => console.log("Success:", v),
	error: (e) => console.error("Error:", e),
})
// → Program<"yay", "nay", never>

// ==============================================================
// finally for cleanup
// ==============================================================

simple.finally(() => {
	console.log("Cleanup complete")
})
// → Program<"yay", "nay", never>

// ==============================================================
// Direct provide with Token + Factory (shorthand)
// ==============================================================

const partialProg = x.require(Foo, Bar).try((ctx) => ctx.get(Foo).foo)
// partialProg: Program<"FOO", never, Foo | Bar>

// Direct Token + Factory provision (shorthand)
const withFoo = partialProg.provide(Foo, { foo: "FOO" })
// withFoo: Program<"FOO", never, Bar>

// Can also use Provider
const withBar = withFoo.provide(x.provide(Bar, { bar: "BAR" }))
// withBar: Program<"FOO", never, never>

x.run(withBar)
