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

Five principles shape the API:

| Principle               | Description                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Errors as values**    | Type-safe error handling. Return `TypedError` instances to fail — no `throw` statements. |
| **Lazy execution**      | Thunks defer computation until run. Enables composition, observation, and retryability.  |
| **Minimal API surface** | Only 4 classes with just 22 methods combined. Quick to learn, easy to remember.          |
| **Polymorphic inputs**  | Methods accept and unwrap `T \| Promise<T> \| Thunk<T, E, R>` seamlessly.                |
| **Immutability**        | Methods return new instances. No mutation, no side effects, predictable behavior.        |

---

## 1. `Thunk`

### 1.1 Static Methods

| Method                           | Description                  |
| -------------------------------- | ---------------------------- |
| [`Thunk.of`](#thunkof)           | Create from value            |
| [`Thunk.try`](#thunktry)         | Create from factory          |
| [`Thunk.gen`](#thunkgen)         | Compose via generators       |
| [`Thunk.delay`](#thunkdelay)     | Delay execution              |
| [`Thunk.all`](#thunkall)         | Concurrent — collect all     |
| [`Thunk.any`](#thunkany)         | Concurrent — first success   |
| [`Thunk.race`](#thunkrace)       | Concurrent — first to settle |
| [`Thunk.bracket`](#thunkbracket) | Resource management          |
| [`Thunk.run`](#thunkrun)         | Execute thunk                |

#### `Thunk.of`

Creates a `Thunk` from a synchronous value. For async or fallible operations, use [`Thunk.try`](#thunktry).

```typescript
Thunk.of(123)
// Thunk<number, never, never>

Thunk.of(user)
// Thunk<User, never, never>
```

#### `Thunk.try`

Creates a `Thunk` from a factory with optional error handling.

The factory receives an `AbortSignal` (from `Thunk.run`) and can return `T`, `Promise<T>`, or `Thunk<T, E, R>` — all unwrapped.

```typescript
// Simple — signal available
Thunk.try((signal) => fetch(url, { signal }))
// Thunk<Response, never, never>

// With error handling
Thunk.try({
  try: (signal) => fetch(url, { signal }),
  catch: (error) => new FetchError({ cause: error }),
})
// Thunk<Response, FetchError, never>
```

Without `catch`, thrown errors become defects (wrapped in `UnexpectedError`, not added to `E`).

#### `Thunk.gen`

Composes `Thunks` using generator syntax. Yield `Thunks` and `Tokens`. Return `TypedErrors` to fail.

The generator receives an `AbortSignal` (from `Thunk.run`) for cancellation.

```typescript
Thunk.gen(function* (signal) {
  const auth = yield* AuthService // R += AuthService
  const user = yield* fetchUser(auth.userId, { signal }) // E += FetchError
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

Runs `Thunks` concurrently and collects all results. Accepts arrays or objects.

```typescript
Thunk.all([fetchUser(id), fetchPosts(id)])
// Thunk<[User, Post[]], UserError | PostError, UserService | PostService>

Thunk.all({ user: fetchUser(id), posts: fetchPosts(id) })
// Thunk<{ user: User, posts: Post[] }, UserError | PostError, UserService | PostService>

Thunk.all(thunks, { concurrency: 5 })
```

#### `Thunk.any`

Returns first successful result. If all fail, returns an `AggregateError` containing all errors.

```typescript
Thunk.any([fetchFromCache(id), fetchFromDatabase(id)])
// Thunk<User, AggregateError<CacheError | DatabaseError>, CacheService | DatabaseService>
```

#### `Thunk.race`

Returns first to settle (success or failure).

```typescript
Thunk.race([fetchFromPrimary(id), fetchFromReplica(id)])
// Thunk<User, DatabaseError, DatabaseService>
```

#### `Thunk.bracket`

Manages resource lifecycle: `acquire`, `use`, `release`. Guarantees `release` runs regardless of success or failure.

```typescript
Thunk.bracket({
  acquire: () => openConnection(),
  use: (conn) => conn.query(sql),
  release: (conn) => conn.close(),
})
// Thunk<QueryResult, ConnectionError | QueryError, never>

// With signal for cancellation
Thunk.bracket({
  acquire: (signal) => openConnection({ signal }),
  use: (conn, signal) => conn.query(sql, { signal }),
  release: (conn) => conn.close(),
})
```

`release` always runs with the acquired resource. Release errors are defects, not tracked in `E`.

#### `Thunk.run`

Executes `Thunk<T, E, R>` and returns `Promise<Result<T, E>>`. Requires `R = never`.

```typescript
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }
```

`Result` is a discriminated union — check `ok` to access `value` or `error`:

```typescript
const result = await Thunk.run(thunk)

if (result.ok) {
  console.log(result.value) // T
} else {
  console.error(result.error) // E
}

// With options
await Thunk.run(thunk, { signal }) // pass AbortSignal
await Thunk.run(thunk, { unwrap: true }) // returns T or throws
```

---

### 1.2 Instance Methods

| Method                           | Description             |
| -------------------------------- | ----------------------- |
| [`thunk.then`](#thunkthen)       | Transform success value |
| [`thunk.catch`](#thunkcatch)     | Handle errors           |
| [`thunk.pipe`](#thunkpipe)       | Apply transformation    |
| [`thunk.tap`](#thunktap)         | Side effects            |
| [`thunk.span`](#thunkspan)       | Add tracing span        |
| [`thunk.retry`](#thunkretry)     | Retry on failure        |
| [`thunk.timeout`](#thunktimeout) | Add timeout             |
| [`thunk.provide`](#thunkprovide) | Satisfy requirements    |

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

Adds a tracing span. Requires a [`Tracer`](#5-tracer) token to be provided before running.

```typescript
thunk.span("fetchUser", { userId: id })
// Thunk<T, E, R | Tracer>
```

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

thunk.provide(p1, p2, p3)
// Thunk<T, Et | E1 | E2 | E3, Exclude<Rt, P1 | P2 | P3> | R1 | R2 | R3>
```

When multiple providers are passed, dependencies between them are wired automatically.

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

### Expected vs Unexpected Errors

Thunx distinguishes two error categories:

- **Expected errors** — Tracked in `E`. Returned via `Result`. Handle with `.catch`.
- **Defects** — Untracked (`UnexpectedError`). Thrown as exceptions. Indicate bugs.

`Thunk.run` returns `Result<T, E>` for expected errors. Defects reject the Promise.

```typescript
// Expected — tracked in E, handled gracefully
Thunk.try({
  try: () => fetch(url),
  catch: (error) => new FetchError({ cause: error }),
})
// Thunk<Response, FetchError, never>

// Defect — not tracked, indicates a bug
Thunk.try(() => {
  throw new Error("unexpected")
})
// Thunk<T, never, never> — but will reject with UnexpectedError
```

---

## 3. `Token`

Tokens define injectable dependencies. The `declare` keyword defines the `Shape` without generating runtime code.

```typescript
class UserService extends Token("UserService") {
  declare readonly baseUrl: string
  declare readonly getUser: (id: string) => Thunk<User, FetchError, never>
}
```

### Using Tokens

Using a Token (via `.then()` or `yield*`) returns its `Shape` and adds `Token` to `R`.

```typescript
UserService.then((service) => service.getUser(id))
// Thunk<User, FetchError, UserService>

Thunk.gen(function* () {
  const service = yield* UserService // R += UserService
  const user = yield* service.getUser(userId) // E += FetchError
  return user // T += User
})
// Thunk<User, FetchError, UserService>
```

### Implementing Tokens

| Method                   | Description                    |
| ------------------------ | ------------------------------ |
| [`Token.of`](#tokenof)   | Create provider from object    |
| [`Token.gen`](#tokengen) | Create provider from generator |

#### `Token.of`

Creates a [`Provider`](#4-provider) from an object. Validates the `Shape` at compile time.

```typescript
ConfigService.of({ databaseUrl: "postgres://...", timeout: 5000 })
// Provider<ConfigService, never, never>

ConfigService.of({ databaseUrl: "postgres://..." })
// Property 'timeout' is missing...
```

#### `Token.gen`

Creates a [`Provider`](#4-provider) from a generator. Return type must match `Shape`. `E` and `R` flow from yielded Thunks and returned TypedErrors.

The generator receives an `AbortSignal` (from `Thunk.run`) for cancellation.

```typescript
DatabaseService.gen(function* (signal) {
  const config = yield* ConfigService // R += ConfigService
  if (!config.databaseUrl) return new DatabaseError() // E += DatabaseError
  return createDatabase(config.databaseUrl, { signal })
})
// Provider<DatabaseService, DatabaseError, ConfigService>
```

---

## 4. `Provider`

Providers supply `Token` implementations with type `Provider<P, E, R>` where:

- `P` — provided token(s) type
- `E` — error(s) type
- `R` — required token(s) type

Created via [`Token.of`](#tokenof) or [`Token.gen`](#tokengen). Immutable — methods return new instances.

Provider generators run fresh each time the provider is resolved. For singleton behavior, construct the instance externally and capture it:

```typescript
// Transient — createConnection() runs on each resolution
const databaseProvider = DatabaseService.gen(function* () {
  return createConnection()
})

// Singleton — connection created once, shared across resolutions
const connection = createConnection()
const databaseProvider = DatabaseService.gen(function* () {
  return connection
})
```

Alternatively, [`Token.of`](#tokenof) is inherently singleton since it receives an already-constructed object:

```typescript
const connection = createConnection()
const databaseProvider = DatabaseService.of(connection)
```

### Instance Methods

| Method                                 | Description          |
| -------------------------------------- | -------------------- |
| [`provider.provide`](#providerprovide) | Satisfy requirements |
| [`provider.combine`](#providercombine) | Combine providers    |
| [`provider.span`](#providerspan)       | Add tracing span     |

#### `provider.provide`

Satisfies requirements with other providers. Variadic with auto-wiring. Encapsulates — only `this.P` in output.

```typescript
// databaseProvider: Provider<DatabaseService, E, ConfigService | LoggerService>

databaseProvider.provide(configProvider)
// Provider<DatabaseService, E, LoggerService>

databaseProvider.provide(configProvider, loggerProvider)
// Provider<DatabaseService, E, never>
```

#### `provider.combine`

Combines providers. Variadic with auto-wiring. Exposes all — `P` channels unioned.

```typescript
// configProvider: Provider<ConfigService, never, never>
// loggerProvider: Provider<LoggerService, never, ConfigService>

configProvider.combine(loggerProvider)
// Provider<ConfigService | LoggerService, never, never>
// ↑ ConfigService in loggerProvider.R satisfied by configProvider.P

configProvider.combine(loggerProvider, cacheProvider)
// Provider<ConfigService | LoggerService | CacheService, E, R>
```

#### `provider.span`

Adds a tracing span to construction. Requires [`Tracer`](#5-tracer) to be provided.

```typescript
provider.span("createDatabase", { url })
// Provider<P, E, R | Tracer>
```

### Usage

```typescript
// Create providers via Token methods
const configProvider = ConfigService.of({
  databaseUrl: "postgres://user:password@host:5432/database",
})
// Provider<ConfigService, never, never>

const loggerProvider = LoggerService.of({ level: "info" })
// Provider<LoggerService, never, never>

const databaseProvider = DatabaseService.gen(function* () {
  const config = yield* ConfigService
  const logger = yield* LoggerService
  return createDatabase(config.databaseUrl, logger)
})
// Provider<DatabaseService, never, ConfigService | LoggerService>

// Combine — expose all, auto-wire
const coreProvider = configProvider.combine(loggerProvider)
// Provider<ConfigService | LoggerService, never, never>

// Provide — encapsulate, satisfy requirements
const dataProvider = databaseProvider.provide(coreProvider)
// Provider<DatabaseService, never, never>

// Provide to thunk
thunk.provide(dataProvider)
// Thunk<T, E, Exclude<R, DatabaseService>>
```

---

## 5. `Tracer`

`Tracer` is a built-in `Token` that enables observability via `thunk.span()` and `provider.span()`.

```typescript
// Tracer Token definition
class Tracer extends Token("Tracer") {
  declare readonly span: <T, E>(
    name: string,
    attributes: Record<string, unknown>,
    fn: () => Promise<Result<T, E>>,
  ) => Promise<Result<T, E>>
}

// Add span to thunk or provider
fetchUser(id).span("fetchUser", { userId: id })
// Thunk<User, FetchError, Tracer>

// Provide a Tracer implementation
const tracerProvider = Tracer.of({
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

## 6. Cancellation

Thunks support cooperative cancellation via `AbortSignal`.

```typescript
const controller = new AbortController()

// Pass signal to Thunk.run
Thunk.run(thunk, { signal: controller.signal })

// Signal is available in Thunk.try factories
Thunk.try((signal) => fetch(url, { signal }))

// Abort cancels the operation
controller.abort()
```

When aborted:

- In-flight operations receive the signal and should abort
- `Thunk.run` rejects with `AbortError`
- `.retry` stops retrying on abort
- `.timeout` uses `AbortSignal.timeout()` internally

---

## Type Inference

### Yieldables

| Type    | Returns | Adds to E | Adds to R |
| ------- | ------- | --------- | --------- |
| `Thunk` | `T`     | `E`       | `R`       |
| `Token` | `Shape` | `never`   | `Token`   |

### Returnables

Values returned from `Thunk.try`, `Thunk.gen`, `thunk.then`, `thunk.catch`, or `thunk.tap`:

| Type         | Adds to T | Adds to E | Adds to R |
| ------------ | --------- | --------- | --------- |
| `T`          | `T`       | `never`   | `never`   |
| `Thunk`      | `T`       | `E`       | `R`       |
| `TypedError` | `never`   | `Error`   | `never`   |

### Unwrapping

Values returned from `then` or `catch`:

| Input        | Value (`T`) | Error (`E`) | Requirements (`R`) |
| ------------ | ----------- | ----------- | ------------------ |
| `T`          | `T`         | `never`     | `never`            |
| `Promise<T>` | `T`         | `never`     | `never`            |
| `Thunk`      | `T`         | `E`         | `R`                |
| `Token`      | `Shape`     | `never`     | `Token`            |
| `TypedError` | `never`     | `Error`     | `never`            |

### Channel Accumulation

```typescript
a.then(() => b)
// Thunk<Tb, Ea | Eb, Ra | Rb>
```

### Providing

```typescript
thunk.provide(provider)
// Thunk<T, E | Ep, Exclude<R, P> | Rp>

thunk.provide(p1, p2) // variadic, auto-wired
// Thunk<T, E | E1 | E2, Exclude<R, P1 | P2> | R1 | R2>

provider.provide(other) // encapsulates — only this.P in output
// Provider<P, E | Eo, Exclude<R, Po> | Ro>

provider.combine(other) // exposes all — P channels unioned
// Provider<P | Po, E | Eo, Exclude<R | Ro, P | Po>>
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

// Thunk — uses the token
const getUser = (id: string) =>
  UserService.then((service) => service.getUser(id))
// Thunk<User, NotFoundError, UserService>

// Provider — implements the token
const userProvider = UserService.of({
  getUser: (id) =>
    Thunk.try({
      try: () => fetchUser(id),
      catch: (error) => new NotFoundError({ resource: "user", id }),
    }),
})
// Provider<UserService, never, never>

// Execute
const result = await Thunk.run(getUser("123").provide(userProvider))

if (result.ok) {
  console.log(result.value) // User
} else {
  console.error(result.error.name) // "NotFoundError"
}
```

---

## Appendix: Comparison with Effect

| Concept            | Effect               | Thunx                     |
| ------------------ | -------------------- | ------------------------- |
| Core type          | `Effect<A, E, R>`    | `Thunk<T, E, R>`          |
| Dependency type    | `Layer<Out, E, In>`  | `Provider<P, E, R>`       |
| Lift value         | `Effect.succeed`     | `Thunk.of`                |
| Create from thunk  | `Effect.try`         | `Thunk.try`               |
| Delay              | `Effect.sleep`       | `Thunk.delay`             |
| Fail               | `Effect.fail`        | `return new TypedError()` |
| Transform          | `Effect.andThen`     | `thunk.then`              |
| Handle errors      | `Effect.catchTag`    | `thunk.catch`             |
| Side effects       | `Effect.tap`         | `thunk.tap`               |
| Run                | `Effect.runPromise`  | `Thunk.run`               |
| Generator syntax   | `Effect.gen`         | `Thunk.gen`               |
| Service access     | `yield* Tag`         | `yield* Token`            |
| Service definition | `Tag` class          | `Token` class             |
| Create layer       | `Layer.succeed`      | `Token.of`                |
| Layer from thunk   | `Layer.effect`       | `Token.gen`               |
| Combine layers     | `Layer.provideMerge` | `provider.combine`        |
| Wire layers        | `Layer.provide`      | `provider.provide`        |
