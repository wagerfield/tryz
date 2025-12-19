import { expectTypeOf, test } from "vitest"
import { Context, type ContextMap } from "./context"
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
// ContextMap
// ─────────────────────────────────────────────────────────────────────────────

test("ContextMap maps token names to instance types", () => {
  type Map = ContextMap<FooInstance | BarInstance>

  expectTypeOf<Map>().toEqualTypeOf<{
    FooService: FooInstance
    BarService: BarInstance
  }>()
})

test("ContextMap with single token", () => {
  type Map = ContextMap<FooInstance>

  expectTypeOf<Map>().toEqualTypeOf<{
    FooService: FooInstance
  }>()
})

test("ContextMap with never is empty object", () => {
  type Map = ContextMap<never>

  expectTypeOf<Map>().toEqualTypeOf<{}>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Context.get()
// ─────────────────────────────────────────────────────────────────────────────

test("Context.get() returns correct instance type", () => {
  const provider = new Provider()
    .provide(FooService, { foo: "hello" })
    .provide(BarService, { bar: 42 })

  const ctx = new Context(provider)

  const foo = ctx.get(FooService)
  expectTypeOf(foo).toEqualTypeOf<FooInstance>()
  expectTypeOf(foo.foo).toEqualTypeOf<string>()

  const bar = ctx.get(BarService)
  expectTypeOf(bar).toEqualTypeOf<BarInstance>()
  expectTypeOf(bar.bar).toEqualTypeOf<number>()
})

test("Context.get() only accepts tokens that are provided", () => {
  const provider = new Provider().provide(FooService, { foo: "hello" })

  const ctx = new Context(provider)

  // This should work
  ctx.get(FooService)

  // This should be a type error - BarService is not provided
  // @ts-expect-error - BarService is not in context
  ctx.get(BarService)
})

test("Context has signal property", () => {
  const provider = new Provider()
  const ctx = new Context(provider)

  expectTypeOf(ctx.signal).toEqualTypeOf<AbortSignal>()
})

// ─────────────────────────────────────────────────────────────────────────────
// Context with multiple tokens
// ─────────────────────────────────────────────────────────────────────────────

test("Context.get() works with all provided tokens", () => {
  const provider = new Provider()
    .provide(FooService, { foo: "hello" })
    .provide(BarService, { bar: 42 })
    .provide(BazService, { baz: true })

  const ctx = new Context(provider)

  expectTypeOf(ctx.get(FooService)).toEqualTypeOf<FooInstance>()
  expectTypeOf(ctx.get(BarService)).toEqualTypeOf<BarInstance>()
  expectTypeOf(ctx.get(BazService)).toEqualTypeOf<BazInstance>()
})
