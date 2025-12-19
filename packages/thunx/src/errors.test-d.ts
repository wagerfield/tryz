import { expectTypeOf, test } from "vitest"
import {
  type ErrorHandlers,
  type ErrorHandlersReturnType,
  type ErrorName,
  TypedError,
  type TypedErrorInstance,
} from "./errors"

// ─────────────────────────────────────────────────────────────────────────────
// TypedError Factory
// ─────────────────────────────────────────────────────────────────────────────

class NotFoundError extends TypedError("NotFound")<{
  readonly resource: string
  readonly id: number
}> {}

class TimeoutError extends TypedError("Timeout")<{
  readonly ms: number
}> {}

class ValidationError extends TypedError("Validation")<{
  readonly field: string
  readonly reason: string
}> {}

test("TypedError class has static name property with literal type", () => {
  expectTypeOf(NotFoundError.name).toEqualTypeOf<"NotFound">()
  expectTypeOf(TimeoutError.name).toEqualTypeOf<"Timeout">()
  expectTypeOf(ValidationError.name).toEqualTypeOf<"Validation">()
})

test("TypedError instance has name property with literal type", () => {
  const err = new NotFoundError({ resource: "user", id: 123 })
  expectTypeOf(err.name).toEqualTypeOf<"NotFound">()
})

test("TypedError instance has shape properties", () => {
  const err = new NotFoundError({ resource: "user", id: 123 })
  expectTypeOf(err.resource).toEqualTypeOf<string>()
  expectTypeOf(err.id).toEqualTypeOf<number>()
})

test("TypedError instance has Error properties", () => {
  const err = new NotFoundError({
    resource: "user",
    id: 123,
    message: "Not found",
  })
  expectTypeOf(err.message).toEqualTypeOf<string>()
  expectTypeOf(err.cause).toEqualTypeOf<unknown>()
  expectTypeOf(err.stack).toEqualTypeOf<string | undefined>()
})

test("TypedError instance extends Error", () => {
  const err = new NotFoundError({ resource: "user", id: 123 })
  expectTypeOf(err).toExtend<Error>()
})

// ─────────────────────────────────────────────────────────────────────────────
// TypedErrorInstance
// ─────────────────────────────────────────────────────────────────────────────

test("TypedErrorInstance combines Error, name, and shape", () => {
  type Instance = TypedErrorInstance<"TestError", { readonly code: number }>

  expectTypeOf<Instance["name"]>().toEqualTypeOf<"TestError">()
  expectTypeOf<Instance["code"]>().toEqualTypeOf<number>()
  expectTypeOf<Instance["message"]>().toEqualTypeOf<string>()
})

// ─────────────────────────────────────────────────────────────────────────────
// ErrorName
// ─────────────────────────────────────────────────────────────────────────────

test("ErrorName extracts name literals from single error", () => {
  type Name = ErrorName<NotFoundError>
  expectTypeOf<Name>().toEqualTypeOf<"NotFound">()
})

test("ErrorName extracts name literals from error union", () => {
  type Names = ErrorName<NotFoundError | TimeoutError | ValidationError>
  expectTypeOf<Names>().toEqualTypeOf<"NotFound" | "Timeout" | "Validation">()
})

test("ErrorName returns never for non-error types", () => {
  expectTypeOf<ErrorName<string>>().toEqualTypeOf<never>()
  expectTypeOf<ErrorName<{ foo: string }>>().toEqualTypeOf<never>()
})

// ─────────────────────────────────────────────────────────────────────────────
// ErrorHandlers
// ─────────────────────────────────────────────────────────────────────────────

test("ErrorHandlers creates handler object keyed by error name", () => {
  type Handlers = ErrorHandlers<NotFoundError | TimeoutError>

  // Should have optional handlers for each error name
  expectTypeOf<Handlers>().toEqualTypeOf<{
    NotFound?: (error: NotFoundError) => unknown
    Timeout?: (error: TimeoutError) => unknown
  }>()
})

test("ErrorHandlers handler receives correctly typed error", () => {
  type Handlers = ErrorHandlers<NotFoundError | TimeoutError>

  // Verify handler parameter types inline
  expectTypeOf<Handlers>().toEqualTypeOf<{
    NotFound?: (error: NotFoundError) => unknown
    Timeout?: (error: TimeoutError) => unknown
  }>()
})

// ─────────────────────────────────────────────────────────────────────────────
// ErrorHandlersReturnType
// ─────────────────────────────────────────────────────────────────────────────

test("ErrorHandlersReturnType extracts union of return types", () => {
  type Handlers = {
    NotFound: (err: NotFoundError) => string
    Timeout: (err: TimeoutError) => number
  }

  type Returns = ErrorHandlersReturnType<Handlers>
  expectTypeOf<Returns>().toEqualTypeOf<string | number>()
})

test("ErrorHandlersReturnType handles single handler", () => {
  type Handlers = {
    NotFound: (err: NotFoundError) => boolean
  }

  type Returns = ErrorHandlersReturnType<Handlers>
  expectTypeOf<Returns>().toEqualTypeOf<boolean>()
})

test("ErrorHandlersReturnType handles empty object", () => {
  type Returns = ErrorHandlersReturnType<{}>
  expectTypeOf<Returns>().toEqualTypeOf<never>()
})
