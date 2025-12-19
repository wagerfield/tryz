import { expectTypeOf, test } from "vitest"
import { Provider } from "./provider"
import { Token, type TokenType } from "./token"

// ─────────────────────────────────────────────────────────────────────────────
// Test Tokens
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

// ─────────────────────────────────────────────────────────────────────────────
// Provider.provide()
// ─────────────────────────────────────────────────────────────────────────────

test("Provider.provide() accumulates token types", () => {
  const p1 = new Provider().provide(FooService, { foo: "hello" })
  expectTypeOf(p1).toEqualTypeOf<Provider<FooInstance>>()

  const p2 = p1.provide(BarService, { bar: 42 })
  expectTypeOf(p2).toEqualTypeOf<Provider<FooInstance | BarInstance>>()

  const p3 = p2.provide(BazService, { baz: true })
  expectTypeOf(p3).toEqualTypeOf<
    Provider<FooInstance | BarInstance | BazInstance>
  >()
})

test("Provider.provide() accepts value factory", () => {
  const p = new Provider().provide(FooService, { foo: "hello" })
  expectTypeOf(p).toEqualTypeOf<Provider<FooInstance>>()
})

test("Provider.provide() accepts function factory with context", () => {
  const p = new Provider()
    .provide(FooService, { foo: "hello" })
    .provide(BarService, (ctx) => {
      // ctx should have access to previously provided tokens
      const foo = ctx.get(FooService)
      expectTypeOf(foo.foo).toEqualTypeOf<string>()
      return { bar: foo.foo.length }
    })

  expectTypeOf(p).toEqualTypeOf<Provider<FooInstance | BarInstance>>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Provider.get()
// ─────────────────────────────────────────────────────────────────────────────

test("Provider.get() only accepts tokens in C", () => {
  const p = new Provider()
    .provide(FooService, { foo: "hello" })
    .provide(BarService, { bar: 42 })

  // These should work
  p.get(FooService)
  p.get(BarService)

  // This should be a type error
  // @ts-expect-error - BazService is not provided
  p.get(BazService)
})

// ─────────────────────────────────────────────────────────────────────────────
// Provider.pick()
// ─────────────────────────────────────────────────────────────────────────────

test("Provider.pick() with single token", () => {
  const full = new Provider()
    .provide(FooService, { foo: "hello" })
    .provide(BarService, { bar: 42 })

  const picked = full.pick(FooService)
  expectTypeOf(picked).toEqualTypeOf<Provider<FooInstance>>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Provider.omit()
// ─────────────────────────────────────────────────────────────────────────────

test("Provider.omit() excludes specified token", () => {
  const full = new Provider()
    .provide(FooService, { foo: "hello" })
    .provide(BarService, { bar: 42 })

  const omitted = full.omit(BarService)
  expectTypeOf(omitted).toEqualTypeOf<Provider<FooInstance>>()
})

test("Provider.omit() all tokens results in Provider<never>", () => {
  const full = new Provider().provide(FooService, { foo: "hello" })

  const omitted = full.omit(FooService)
  expectTypeOf(omitted).toEqualTypeOf<Provider<never>>()
})
