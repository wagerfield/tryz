# Thunx Specification

Thunx provides type-safe error handling and dependency injection through a familiar Promise-like interface called a Thunk.

Thunks differ from Promises in two key ways:

**1. Richer types** — `Promise<T>` only tracks the success type. `Thunk<T, E, R>` tracks three channels:

- `T` — success type
- `E` — error type
- `R` — required dependency type (must be `never` to run)

```typescript
Thunk<User, FetchError, UserService>
//    ↑     ↑           ↑
//    T     E           R
```

**2. Lazy execution** — Promises execute eagerly. Thunks are nullary functions that defer computation until explicitly run.

```typescript
// Promise — executes immediately
const promise = fetch(url) // already running

// Thunk — defers execution
const thunk = Thunk.try(() => fetch(url)) // not running yet
await Thunk.run(thunk) // executes now
```

Lazy execution enables composition, observation, and resilience through retryability.

## Design Principles

| Principle               | Description                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| **Errors as values**    | Return `TypedError` instances to fail — no `throw` statements           |
| **Polymorphic inputs**  | Methods accept and unwrap `T \| Promise<T> \| Thunk<T, E, R>` uniformly |
| **Minimal API surface** | 8 static methods, 9 chainable instance methods                          |

---

## 1. `Thunk`

### 1.1 Static Methods

| Method                       | Description                  |
| ---------------------------- | ---------------------------- |
| [`Thunk.of`](#thunkof)       | Create from value            |
| [`Thunk.try`](#thunktry)     | Create from factory          |
| [`Thunk.gen`](#thunkgen)     | Compose via generators       |
| [`Thunk.delay`](#thunkdelay) | Delay execution              |
| [`Thunk.all`](#thunkall)     | Concurrent — collect all     |
| [`Thunk.any`](#thunkany)     | Concurrent — first success   |
| [`Thunk.race`](#thunkrace)   | Concurrent — first to settle |
| [`Thunk.run`](#thunkrun)     | Execute thunk                |

#### `Thunk.of`

Creates a `Thunk` from a synchronous value. For async or fallible operations, use [`Thunk.try`](#thunktry).

```typescript
Thunk.of(42)
// Thunk<number, never, never>

Thunk.of(user)
// Thunk<User, never, never>
```

#### `Thunk.try`

Creates a `Thunk` from a factory with optional error handling. The factory receives an `AbortSignal` for cancellation.

```typescript
Thunk.try(() => 42)
// Thunk<number, never, never>

Thunk.try({
  try: () => fetch(url),
  catch: (error) => new FetchError({ cause: error }),
})
// Thunk<Response, FetchError, never>

Thunk.try((signal) => fetch(url, { signal }))
// Thunk<Response, never, never>
```

Without `catch`, thrown errors are wrapped in an `UnexpectedError` (not added to `E`).

#### `Thunk.gen`

Composes `Thunks` using generator syntax. Yield `Thunks` and `Tokens`. Return `TypedErrors` to fail.

```typescript
Thunk.gen(function* () {
  const auth = yield* AuthService // R += AuthService
  const user = yield* fetchUser(auth.userId) // E += FetchError
  if (!user.active) return new InactiveError() // E += InactiveError
  return user // T += User
})
// Thunk<User, FetchError | InactiveError, AuthService>
```

#### `Thunk.delay`

Creates a `Thunk` that resolves after a delay.

```typescript
Thunk.delay(1000)
// Thunk<void, never, never>

Thunk.delay(1000, value)
// Thunk<T, never, never>

Thunk.delay(1000, thunk)
// Thunk<T, E, R>
```

#### `Thunk.all`

Runs `Thunks` concurrently and collects all results.

```typescript
Thunk.all([fetchUser(id), fetchPosts(id)]) // array
// Thunk<[User, Post[]], UserError | PostError, never>

Thunk.all({ auth: AuthService, user: UserService }) // object
// Thunk<{ auth: ..., user: ... }, never, AuthService | UserService>

Thunk.all(thunks, { concurrency: 5 })
```

#### `Thunk.any`

Returns first successful result. If all thunks fail, returns an `AggregateError` containing all errors.

```typescript
Thunk.any([fetchFromCache(id), fetchFromDatabase(id)])
// Thunk<User, AggregateError<CacheError | DatabaseError>, ...>
```

#### `Thunk.race`

Returns first to settle (success or failure).

```typescript
Thunk.race([fetchFromPrimary(id), fetchFromReplica(id)])
// Thunk<User, PrimaryError | ReplicaError, never>
```

#### `Thunk.run`

Executes `Thunk<T, E, R>` and returns `Promise<Result<T, E>>`. Requires `R = never`.

```typescript
const result = await Thunk.run(thunk) // Result<T, E>

if (result.ok) console.log(result.value)
else console.error(result.error)

// With options
await Thunk.run(thunk, { signal }) // pass AbortSignal
await Thunk.run(thunk, { unwrap: true }) // returns T or throws
```

---

### 1.2 Instance Methods

| Method                           | Description               |
| -------------------------------- | ------------------------- |
| [`thunk.then`](#thunkthen)       | Transform success value   |
| [`thunk.catch`](#thunkcatch)     | Handle errors             |
| [`thunk.finally`](#thunkfinally) | Run regardless of outcome |
| [`thunk.pipe`](#thunkpipe)       | Apply transformation      |
| [`thunk.tap`](#thunktap)         | Side effects              |
| [`thunk.span`](#thunkspan)       | Add tracing span          |
| [`thunk.retry`](#thunkretry)     | Retry on failure          |
| [`thunk.timeout`](#thunktimeout) | Add timeout               |
| [`thunk.provide`](#thunkprovide) | Satisfy requirements      |

#### `thunk.then`

Transforms the success value. Return a `Thunk` to chain, or a `TypedError` to fail.

```typescript
thunk.then((value) => value.name)
// Thunk<string, E, R>

thunk.then((value) => {
  if (!value) return new NotFoundError()
  return value.name
})
// Thunk<string, E | NotFoundError, R>

thunk.then((value) => fetchDetails(value.id))
// Thunk<Details, E | FetchError, R | DetailsService>
```

#### `thunk.catch`

Handles errors. Return a `Thunk` to chain, or a `TypedError` to re-throw.

```typescript
thunk.catch((error) => fallback)
// Thunk<T | Fallback, never, R>

thunk.catch((error) => fetchFallback())
// Thunk<T | Fallback, FetchError, R | FallbackService>

thunk.catch("NotFoundError", (error) => null)
// Thunk<T | null, Exclude<E, NotFoundError>, R>

thunk.catch({
  NotFoundError: (error) => null,
  TimeoutError: (error) => new RetryError(),
})
// Thunk<T | null, Exclude<E, NotFoundError | TimeoutError> | RetryError, R>
```

#### `thunk.finally`

Runs regardless of outcome.

```typescript
thunk.finally(() => console.log("done"))
// Thunk<T, E, R>
```

#### `thunk.pipe`

Applies a transformation function.

```typescript
const withRetry = <T, E, R>(t: Thunk<T, E, R>) => t.retry(3)
const orNull = <T, E, R>(t: Thunk<T, E, R>) => t.catch((error) => null)

thunk.pipe(withRetry).pipe(orNull)
// Thunk<T | null, never, R>
```

#### `thunk.tap`

Executes side effects, passing `T` through unchanged. Callbacks may return `Thunks`, merging their `E` and `R` channels.

```typescript
thunk.tap((value) => console.log(value))

thunk.tap({
  value: (value) => logToAnalytics(value), // Thunk<void, AnalyticsError, AnalyticsService>
  error: (error) => logToSentry(error), // Thunk<void, SentryError, SentryService>
})
// Thunk<T, E | AnalyticsError | SentryError, R | AnalyticsService | SentryService>
```

#### `thunk.span`

Adds a tracing span. Requires a `Tracer` token to be provided before running.

```typescript
thunk.span("fetchUser", { userId: id })
// Thunk<T, E, R | Tracer>
```

> The `Tracer` token must be provided via a `Provider`. See [`Tracer`](#6-tracer) for implementation details.

#### `thunk.retry`

Retries on failure.

```typescript
// Simple — retry 3 times with no delay
thunk.retry(3)

// Fixed delay — 1 second between retries
thunk.retry({ times: 3, delay: 1000 })

// Exponential backoff — 1s, 2s, 4s
thunk.retry({
  times: 3,
  delay: (attempt) => 1000 * 2 ** attempt,
})

// Conditional — only retry network errors
thunk.retry({
  times: 3,
  while: (error) => error.name === "NetworkError",
})
```

#### `thunk.timeout`

Fails with `TimeoutError` if duration exceeded.

```typescript
thunk.timeout(5000)
// Thunk<T, E | TimeoutError, R>
```

#### `thunk.provide`

Satisfies requirements with a [`Provider`](#4-provider), merging `E` and `R` channels.

```typescript
// thunk: Thunk<T, Et, Rt>
// provider: Provider<P, Ep, Rp>
thunk.provide(provider)
// Thunk<T, Et | Ep, Exclude<Rt, P> | Rp>
```

---

## 2. `TypedError`

All errors in channel `E` are `TypedError` instances with a typed `name` for discrimination.

```typescript
// Error without custom properties
class UnauthorizedError extends TypedError("UnauthorizedError") {}

// Error with custom properties
class NotFoundError extends TypedError("NotFoundError")<{
  readonly resource: string
}> {}
```

All errors accept optional `message` and `cause` properties:

```typescript
new UnauthorizedError({
  message: "Access denied", // optional
  cause: error, // optional
})
new NotFoundError({
  resource: "users/123", // required
  message: "User 123 not found", // optional
})
```

### Built-in Errors

| Error               | Payload                | Purpose                     |
| ------------------- | ---------------------- | --------------------------- |
| `UnexpectedError`   | `{ cause: unknown }`   | Unexpected errors (defects) |
| `AggregateError<E>` | `{ errors: E[] }`      | Collection from `Thunk.any` |
| `TimeoutError`      | `{ duration: number }` | Timeout exceeded            |
| `AbortError`        | —                      | Cancelled operation         |

---

## 3. `Token`

Tokens define injectable dependencies with type `Thunk<Shape, never, Token>`.

Using a `Token` (via `.then()` or `yield*`) returns its `Shape` and adds `Token` to `R`.

```typescript
class UserService extends Token("UserService") {
  declare readonly baseUrl: string
  declare readonly getUser: (id: string) => Thunk<User, FetchError, never>
}

// Chain with .then()
UserService.then((service) => service.getUser(id))
// Thunk<User, FetchError, UserService>

// Yield in generators
Thunk.gen(function* () {
  const service = yield* UserService // R += UserService
  const user = yield* service.getUser(userId) // E += FetchError
  return user // T += User
}) // Thunk<User, FetchError, UserService>
```

The `declare` keyword defines the `Shape` without generating runtime code.

Implementations are supplied via a [`Provider`](#4-provider).

### `Token.of`

Creates a type-safe instance of a `Token`'s shape. Validates the object conforms to the declared shape at compile time.

```typescript
class ConfigService extends Token("ConfigService") {
  declare readonly baseUrl: string
  declare readonly timeout: number
}

ConfigService.of({ baseUrl: "http://api.example.com", timeout: 5000 })
// { baseUrl: string, timeout: number }

// Type error — missing 'timeout'
ConfigService.of({ baseUrl: "http://api.example.com" })
```

Useful for creating implementations in `Provider.create` or test mocks with compile-time validation.

---

## 4. `Provider`

Providers supply `Token` implementations with type `Provider<P, E, R>` where:

- `P` — provided dependency type
- `E` — error type
- `R` — required dependency type

Like Thunks, Providers are immutable: each method returns a new `Provider` instance.

### Static Methods

| Method                                 | Description                                |
| -------------------------------------- | ------------------------------------------ |
| [`Provider.create`](#providercreate)   | Create provider for a `Token`              |
| [`Provider.provide`](#providerprovide) | Compose providers — encapsulated (P = Pb)  |
| [`Provider.merge`](#providermerge)     | Compose providers — exposed (P = Pa \| Pb) |

Both `provide` and `merge` wire dependencies (`Pa` → `Rb`). The difference is whether `Pa` appears in the output `P` channel:

| Method    | Wires? | Output P   | Use Case                        |
| --------- | ------ | ---------- | ------------------------------- |
| `provide` | ✅     | `Pb`       | Encapsulation — hide internals  |
| `merge`   | ✅     | `Pa \| Pb` | Composition — expose everything |

### `Provider.create`

Creates a `Provider` for a `Token`. Accepts an object or `Thunk` providing the implementation. If a `Thunk` is passed, its `E` and `R` channels flow to the `Provider`.

```typescript
// Static object — no requirements
Provider.create(ConfigService, { databaseUrl: "postgres://..." })
// Provider<ConfigService, never, never>

// Thunk with dependencies — E and R flow from Thunk
Provider.create(
  DatabaseService,
  Thunk.gen(function* () {
    const config = yield* ConfigService // R += ConfigService
    return createDatabase(config.databaseUrl) // E += DatabaseError
  }),
)
// Provider<DatabaseService, DatabaseError, ConfigService>
```

### `Provider.provide`

Composes providers with encapsulation. Wires `Pa` into `Rb`, but only `Pb` appears in output `P`.

```typescript
Provider.provide(
  configProvider, // Provider<ConfigService, never, never>
  databaseProvider, // Provider<DatabaseService, DatabaseError, ConfigService>
)
// Provider<DatabaseService, DatabaseError, never>
//          ↑ only DatabaseService exposed — ConfigService is internal
```

Use `provide` when building layers where internal dependencies should be hidden from consumers.

### `Provider.merge`

Composes providers with full exposure. Wires `Pa` into `Rb`, and both `Pa` and `Pb` appear in output `P`.

```typescript
Provider.merge(
  configProvider, // Provider<ConfigService, never, never>
  databaseProvider, // Provider<DatabaseService, DatabaseError, ConfigService>
)
// Provider<ConfigService | DatabaseService, DatabaseError, never>
//          ↑ both exposed
```

Use `merge` when building application-level providers where all dependencies should be accessible.

### Usage

```typescript
// Create discrete providers
const configProvider = Provider.create(ConfigService, {
  databaseUrl: "postgres://user:password@host:5432/database",
})
// Provider<ConfigService, never, never>

const databaseProvider = Provider.create(
  DatabaseService,
  Thunk.gen(function* () {
    const config = yield* ConfigService
    return createDatabaseService(config.databaseUrl)
  }),
)
// Provider<DatabaseService, DatabaseError, ConfigService>

// Encapsulated — only DatabaseService exposed
const dbLayer = Provider.provide(configProvider, databaseProvider)
// Provider<DatabaseService, DatabaseError, never>

// Exposed — both ConfigService and DatabaseService accessible
const appProvider = Provider.merge(configProvider, databaseProvider)
// Provider<ConfigService | DatabaseService, DatabaseError, never>

// Provide to thunk
thunk.provide(dbLayer)
// Thunk<T, E | DatabaseError, Exclude<R, DatabaseService>>
```

---

## 5. `Result`

`Thunk.run` returns `Promise<Result<T, E>>`:

```typescript
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }
```

`Result` is a discriminated union — check `ok` to access `value` or `error`:

```typescript
if (result.ok) {
  result.value // T
} else {
  result.error // E
}
```

---

## 6. `Tracer`

`Tracer` is a built-in `Token` that enables observability via `thunk.span()`:

```typescript
// Tracer Token definition
class Tracer extends Token("Tracer") {
  declare readonly span: <T, E>(
    name: string,
    attributes: Record<string, unknown>,
    fn: () => Promise<Result<T, E>>,
  ) => Promise<Result<T, E>>
}

// Add span to a thunk
const thunk = fetchUser(id).span("fetchUser", { userId: id })
// Thunk<User, FetchError, Tracer>

// Provide a Tracer implementation
const tracerProvider = Provider.create(Tracer, {
  span: async (name, attributes, fn) => {
    console.log(`[${name}] start`, attributes)
    const result = await fn()
    console.log(`[${name}] ${result.ok ? "ok" : "error"}`)
    return result
  },
})
// Provider<Tracer, never, never>

// Provide Tracer — subtracts from R
thunk.provide(tracerProvider)
// Thunk<User, FetchError, never>
```

---

## Type Inference

### Yieldables

| Type    | Returns         | Adds to E | Adds to R |
| ------- | --------------- | --------- | --------- |
| `Thunk` | `T`             | `E`       | `R`       |
| `Token` | `TokenInstance` | `never`   | `Token`   |

### Returnables

Values returned from `Thunk.try`, `Thunk.gen`, `thunk.then`, `thunk.catch`, or `thunk.tap`:

| Type         | Adds to T | Adds to E | Adds to R |
| ------------ | --------- | --------- | --------- |
| `T`          | `T`       | `never`   | `never`   |
| `Thunk`      | `T`       | `E`       | `R`       |
| `TypedError` | `never`   | `Error`   | `never`   |

### Unwrapping

Values returned from `then` or `catch`:

| Input        | Value (`T`)     | Error (`E`) | Requirements (`R`) |
| ------------ | --------------- | ----------- | ------------------ |
| `T`          | `T`             | `never`     | `never`            |
| `Promise<T>` | `T`             | `never`     | `never`            |
| `Thunk`      | `T`             | `E`         | `R`                |
| `Token`      | `TokenInstance` | `never`     | `Token`            |
| `TypedError` | `never`         | `Error`     | `never`            |

### Channel Accumulation

```typescript
a.then(() => b)
// Thunk<Tb, Ea | Eb, Ra | Rb>
```

### Providing

```typescript
thunk.provide(provider)
// Thunk<T, E | Ep, Exclude<R, P> | Rp>
// where Provider<P, Ep, Rp>

thunk.provide(partialProvider) // R -= P, R += Rp
thunk.provide(fullProvider) // R = never → runnable
```

---

## Example

```typescript
// Error
class NotFoundError extends TypedError("NotFoundError")<{
  readonly resource: string
  readonly id: string
}> {}

// Token
class UserService extends Token("UserService") {
  declare readonly getUser: (id: string) => Thunk<User, NotFoundError, never>
}

// Thunk
const getUser = (id: string) =>
  UserService.then((service) => service.getUser(id))
// Thunk<User, NotFoundError, UserService>

// Provider
const provider = Provider.create(UserService, {
  getUser: (id) =>
    Thunk.try({
      try: () => fetchUser(id),
      catch: (error) => new NotFoundError({ resource: "user", id }),
    }),
})

// Execute
const result = await Thunk.run(getUser("123").provide(provider))

if (result.ok) {
  console.log(result.value) // User
} else {
  console.error(result.error.name) // "NotFoundError"
}
```

---

## Appendix: Comparison with Effect

| Concept               | Effect               | Thunx                     |
| --------------------- | -------------------- | ------------------------- |
| Core type             | `Effect<A, E, R>`    | `Thunk<T, E, R>`          |
| Dependency type       | `Layer<Out, E, In>`  | `Provider<P, E, R>`       |
| Lift value            | `Effect.succeed`     | `Thunk.of`                |
| Create from thunk     | `Effect.try`         | `Thunk.try`               |
| Delay                 | `Effect.sleep`       | `Thunk.delay`             |
| Fail                  | `Effect.fail`        | `return new TypedError()` |
| Transform             | `Effect.andThen`     | `thunk.then`              |
| Handle errors         | `Effect.catchTag`    | `thunk.catch`             |
| Side effects          | `Effect.tap`         | `thunk.tap`               |
| Run                   | `Effect.runPromise`  | `Thunk.run`               |
| Generator syntax      | `Effect.gen`         | `Thunk.gen`               |
| Service access        | `yield* Tag`         | `yield* Token`            |
| Create layer          | `Layer.succeed`      | `Provider.create`         |
| Compose (expose)      | `Layer.provideMerge` | `Provider.merge`          |
| Compose (encapsulate) | `Layer.provide`      | `Provider.provide`        |
