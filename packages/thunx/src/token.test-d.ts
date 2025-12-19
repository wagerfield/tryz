import { expectTypeOf, test } from "vitest"
import {
  Token,
  type TokenInstance,
  type TokenName,
  type TokenShape,
  type TokenType,
} from "./token"

// ─────────────────────────────────────────────────────────────────────────────
// Token Factory
// ─────────────────────────────────────────────────────────────────────────────

class FooService extends Token("FooService")<{
  readonly foo: string
  readonly count: number
}> {}

class BarService extends Token("BarService")<{
  readonly bar: boolean
}> {}

test("Token class has static name property with literal type", () => {
  expectTypeOf(FooService.name).toEqualTypeOf<"FooService">()
  expectTypeOf(BarService.name).toEqualTypeOf<"BarService">()
})

test("Token instance has shape properties", () => {
  const foo = new FooService({ foo: "hello", count: 42 })
  expectTypeOf(foo.foo).toEqualTypeOf<string>()
  expectTypeOf(foo.count).toEqualTypeOf<number>()

  const bar = new BarService({ bar: true })
  expectTypeOf(bar.bar).toEqualTypeOf<boolean>()
})

test("Token instance does not have runtime name property", () => {
  const foo = new FooService({ foo: "hello", count: 42 })
  // The instance should NOT have a 'name' property at the type level
  // (it uses a phantom brand instead)
  expectTypeOf(foo).not.toHaveProperty("name")
})

// ─────────────────────────────────────────────────────────────────────────────
// TokenInstance (phantom brand)
// ─────────────────────────────────────────────────────────────────────────────

test("TokenInstance includes shape and phantom brand", () => {
  type FooInstance = TokenInstance<"FooService", { readonly foo: string }>

  // Should have shape properties
  expectTypeOf<FooInstance["foo"]>().toEqualTypeOf<string>()
})

test("Different TokenInstances are not assignable to each other", () => {
  type FooInstance = TokenInstance<"Foo", { readonly value: string }>
  type BarInstance = TokenInstance<"Bar", { readonly value: string }>

  // Even with same shape, different names make them incompatible
  expectTypeOf<FooInstance>().not.toEqualTypeOf<BarInstance>()
})

// ─────────────────────────────────────────────────────────────────────────────
// TokenType
// ─────────────────────────────────────────────────────────────────────────────

test("TokenType extracts instance type from class", () => {
  type FooInstance = TokenType<typeof FooService>

  // Should have the shape properties
  expectTypeOf<FooInstance["foo"]>().toEqualTypeOf<string>()
  expectTypeOf<FooInstance["count"]>().toEqualTypeOf<number>()
})

test("TokenType returns never for non-token types", () => {
  expectTypeOf<TokenType<string>>().toEqualTypeOf<never>()
  expectTypeOf<TokenType<number>>().toEqualTypeOf<never>()
})

// ─────────────────────────────────────────────────────────────────────────────
// TokenName
// ─────────────────────────────────────────────────────────────────────────────

test("TokenName extracts name literal via phantom brand", () => {
  type FooInstance = TokenType<typeof FooService>
  type BarInstance = TokenType<typeof BarService>

  expectTypeOf<TokenName<FooInstance>>().toEqualTypeOf<"FooService">()
  expectTypeOf<TokenName<BarInstance>>().toEqualTypeOf<"BarService">()
})

test("TokenName returns never for non-token types", () => {
  expectTypeOf<TokenName<string>>().toEqualTypeOf<never>()
  expectTypeOf<TokenName<{ foo: string }>>().toEqualTypeOf<never>()
})

// ─────────────────────────────────────────────────────────────────────────────
// TokenShape
// ─────────────────────────────────────────────────────────────────────────────

test("TokenShape extracts shape without phantom brand", () => {
  type FooShape = TokenShape<typeof FooService>

  expectTypeOf<FooShape>().toEqualTypeOf<{
    readonly foo: string
    readonly count: number
  }>()
})

test("TokenShape can be used for providing token implementations", () => {
  type BarShape = TokenShape<typeof BarService>

  // Should be assignable from a plain object with matching shape
  const shape: BarShape = { bar: true }
  expectTypeOf(shape).toEqualTypeOf<{ readonly bar: boolean }>()
})
