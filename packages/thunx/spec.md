# Thunx Specification

Thunx provides type-safe error handling and dependency injection through a familiar Promise-like interface called a Thunk.

Thunks differ from Promises in two key ways:

**1. Richer types** — `Promise<T>` only tracks the success type. `Thunk<T, E, R>` tracks three channels:

- `T` — success value type
- `E` — possible error type
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

### Design Principles

| Principle               | Description                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| **Errors as values**    | Return `TypedError` instances to fail — no `throw` statements           |
| **Polymorphic inputs**  | Methods accept and unwrap `T \| Promise<T> \| Thunk<T, E, R>` uniformly |
| **Minimal API surface** | 7 static methods; everything else chains from instances                 |

---

## 1. `Thunk`

### 1.1 Static Methods

| Method                     | Description                   |
| -------------------------- | ----------------------------- |
| [`Thunk.from`](#thunkfrom) | Lift value, promise, or thunk |
| [`Thunk.try`](#thunktry)   | Create from factory           |
| [`Thunk.gen`](#thunkgen)   | Compose via generators        |
| [`Thunk.all`](#thunkall)   | Concurrent — collect all      |
| [`Thunk.any`](#thunkany)   | Concurrent — first success    |
| [`Thunk.race`](#thunkrace) | Concurrent — first to settle  |
| [`Thunk.run`](#thunkrun)   | Execute thunk                 |

#### `Thunk.from`

Lifts a value, `Promise`, or `Thunk` into a new `Thunk`.

```typescript
Thunk.from(42) // Thunk<number, never, never>
Thunk.from(fetch(url)) // Thunk<Response, never, never>
Thunk.from(existingThunk) // Thunk<T, E, R>
```

#### `Thunk.try`

Creates a `Thunk` from a factory with optional error handling.

```typescript
Thunk.try(() => 42)
// Thunk<number, never, never>

Thunk.try({
  try: () => fetch(url),
  catch: (error) => new FetchError({ cause: error }),
})
// Thunk<Response, FetchError, never>

Thunk.try((ctx) => fetch(url, { signal: ctx.signal }))
// Thunk<Response, never, never>
```

> Without `catch`, thrown errors are wrapped in an `UnexpectedError`.

#### `Thunk.gen`

Composes `Thunks` using generator syntax. Yield `Thunks`, `Tokens` and `TypedErrors`.

```typescript
Thunk.gen(function* () {
  const auth = yield* AuthService // R += AuthService
  const user = yield* fetchUser(auth.userId) // E += FetchError
  if (!user.active) yield* new InactiveError() // E += InactiveError
  return user // T += User
})
// Thunk<User, FetchError | InactiveError, AuthService>
```

#### `Thunk.all`

Runs `Thunks` concurrently and collects all results.

```typescript
Thunk.all([fetchUser(id), fetchPosts(id)]) // array
// Thunk<[User, Post[]], UserError | PostError, never>

Thunk.all({ user: UserService, config: ConfigService }) // object
// Thunk<{ user: ..., config: ... }, never, UserService | ConfigService>

Thunk.all(thunks, { concurrency: 5 })
```

#### `Thunk.any`

Returns first successful result. If all thunks fail, returns an `AggregateError` containing all errors.

```typescript
Thunk.any([fetchFromCache(id), fetchFromDb(id)])
// Thunk<User, AggregateError<CacheError | DbError>, ...>
```

#### `Thunk.race`

Returns first to settle (success or failure).

```typescript
Thunk.race([fetchData(), timeout(5000)])
// Thunk<Data, FetchError | TimeoutError, never>
```

#### `Thunk.run`

Executes `Thunk<T, E, R>` and returns `Promise<Result<T, E>>`. Requires `R = never`.

```typescript
const result = await Thunk.run(thunk) // Result<T, E>

if (result.ok) console.log(result.value)
else console.error(result.error)

// With options
await Thunk.run(thunk, { signal }) // pass AbortSignal
await Thunk.run(thunk, { unwrap: true }) // throws on error, returns T
```

---

### 1.2 Instance Methods

| Method                           | Description                   |
| -------------------------------- | ----------------------------- |
| [`thunk.then`](#thunkthen)       | Transform success value       |
| [`thunk.catch`](#thunkcatch)     | Handle errors                 |
| [`thunk.finally`](#thunkfinally) | Cleanup regardless of outcome |
| [`thunk.pipe`](#thunkpipe)       | Apply transformation          |
| [`thunk.tap`](#thunktap)         | Side effects                  |
| [`thunk.span`](#thunkspan)       | Add tracing span              |
| [`thunk.retry`](#thunkretry)     | Retry on failure              |
| [`thunk.timeout`](#thunktimeout) | Add timeout                   |
| [`thunk.provide`](#thunkprovide) | Satisfy requirements          |

#### `thunk.then`

Transforms the success value. Return a `TypedError` to fail.

```typescript
thunk.then((value) => value.name)
// Thunk<string, E, R>

thunk.then((value) => {
  if (!value) return new NotFoundError()
  return value.name
})
// Thunk<string, E | NotFoundError, R>
```

#### `thunk.catch`

Handles errors. Return a `TypedError` to re-throw.

```typescript
thunk.catch((error) => fallback)
// Thunk<T | Fallback, never, R>

thunk.catch("NotFoundError", (error) => null)
// Thunk<T | null, Exclude<E, NotFoundError>, R>

thunk.catch({
  NotFoundError: (error) => null,
  TimeoutError: (error) => new RetryError(),
})
// Thunk<T | null, Exclude<E, NotFoundError | TimeoutError> | RetryError, R>
```

#### `thunk.finally`

Runs cleanup regardless of outcome.

```typescript
thunk.finally(() => cleanup())
```

#### `thunk.pipe`

Applies a transformation function.

```typescript
const withRetry = <T, E, R>(t: Thunk<T, E, R>) => t.retry(3)
const orNull = <T, E, R>(t: Thunk<T, E, R>) => t.catch((error) => null)

thunk.pipe(withRetry).pipe(orNull) // Thunk<T | null, never, R>
```

#### `thunk.tap`

Executes side effects, passing `T` through unchanged. Callbacks may return `Thunks`, merging their `E` and `R` channels.

```typescript
thunk.tap((value) => console.log(value))

thunk.tap({
  value: (value) => logToAnalytics(value), // Thunk<void, AnalyticsError, AnalyticsService>
  error: (error) => logToSentry(error), // Thunk<string, SentryError, SentryService>
})
// Thunk<T, E | AnalyticsError | SentryError, R | AnalyticsService | SentryService>
```

#### `thunk.span`

Adds a tracing span. Requires a `Tracer` token to be provided before running.

```typescript
thunk.span("fetchUser", { userId: id })
// Thunk<T, E, R | Tracer>
```

> The `Tracer` token must be provided via a `Provider`. See [`Tracer`](#7-tracer) for implementation details.

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

Adds a timeout.

```typescript
thunk.timeout(5000)
// Thunk<T, E | TimeoutError, R>
```

#### `thunk.provide`

Satisfies requirements with a `Provider`.

```typescript
thunk.provide(appProvider)
// Thunk<T, E, Exclude<R, ProvidedTokens>>
```

---

## 2. `TypedError`

All errors in channel `E` are `TypedError` instances with a typed `name` for discrimination.

```typescript
// Simple error (no payload)
class UnauthorizedError extends TypedError("UnauthorizedError") {}

// Error with payload
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

`Tokens` define injectable dependencies. A `Token` class is a `Thunk` — yielding it returns the service instance and adds the `Token` to `R`.

### Definition

Shape is defined via `declare` properties in the class body:

```typescript
class UserService extends Token("UserService") {
  declare readonly getUser: (id: string) => Thunk<User, FetchError, never>
  declare readonly listUsers: () => Thunk<User[], never, never>
}

// Simple tokens with primitive values
class ConfigService extends Token("ConfigService") {
  declare readonly apiUrl: string
  declare readonly timeout: number
}
```

### Usage

```typescript
// In generators
Thunk.gen(function* () {
  const service = yield* UserService
  return service.getUser(userId)
})
// Thunk<User, FetchError, UserService>

// Chain directly
UserService.then((service) => service.getUser(id))
// Thunk<User, FetchError, UserService>

// In Thunk.all
Thunk.all({
  user: UserService,
  config: ConfigService,
}).then(({ user, config }) => { ... })
```

### Providing

`Tokens` are provided via `Provider` instances. The factory must return the full shape matching the declared properties:

```typescript
const provider = Provider.provide(ConfigService, () => ({
  apiUrl: "https://...",
  timeout: 5000,
})).provide(UserService, (ctx) => ({
  getUser: (id) =>
    Thunk.try({
      try: () => fetch(`${ctx.get(ConfigService).apiUrl}/users/${id}`),
      catch: (error) => new FetchError({ cause: error }),
    }),
  listUsers: () =>
    Thunk.try({
      try: () => fetch(`${ctx.get(ConfigService).apiUrl}/users`),
      catch: (error) => new FetchError({ cause: error }),
    }),
}))

thunk.provide(provider)
```

---

## 4. `Context`

Execution context passed to factories. Two variants exist:

```typescript
// Base context (Thunk.try, Provider.provide static)
interface Context {
  readonly signal: AbortSignal
}

// Extended context (Provider .provide instance method)
interface ProviderContext<C> extends Context {
  get<T extends C>(token: TokenClass<T>): TokenInstance<T>
}
```

The `signal` originates from `Thunk.run` options (or an internal default). The `get` method is only available when prior `Tokens` exist in the `Provider` chain.

---

## 5. `Provider`

Bundles `Token` provisions with inter-token dependencies.

### Static Methods

| Method             | Description                    |
| ------------------ | ------------------------------ |
| `Provider.provide` | Create provider with one token |
| `Provider.merge`   | Combine multiple providers     |

### Instance Methods

| Method     | Description                         |
| ---------- | ----------------------------------- |
| `.provide` | Add token (can access prior tokens) |
| `.merge`   | Combine with another provider       |
| `.pick`    | Subset with selected tokens         |
| `.omit`    | Subset excluding specified tokens   |

### Usage

```typescript
// Create with static method (factory receives Context)
const configProvider = Provider.provide(ConfigService, (ctx) => ({
  apiUrl: "https://...",
}))

// Chain with instance method (factory receives ProviderContext<C>)
const appProvider = Provider.provide(ConfigService, () => ({
  apiUrl: "https://...",
}))
  .provide(DbService, (ctx) => createDb(ctx.get(ConfigService).apiUrl))
  .provide(UserService, (ctx) => createUserService(ctx.get(DbService)))

// Combine providers
const fullProvider = Provider.merge(authProvider, appProvider)

// Subset providers
const minimalProvider = fullProvider.pick(ConfigService, DbService)
const withoutAuth = fullProvider.omit(AuthService)

thunk.provide(appProvider)
// Thunk<T, E, Exclude<R, ConfigService | DbService | UserService>>
```

---

## 6. `Result`

The return type of `Thunk.run`.

```typescript
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }
```

---

## 7. `Tracer`

The `Tracer` token enables observability via the `thunk.span()` method. Provide an implementation to capture spans during execution.

### Definition

```typescript
class Tracer extends Token("Tracer") {
  declare readonly span: <T>(
    name: string,
    attributes: Record<string, unknown>,
    fn: () => Promise<T>,
  ) => Promise<T>
}
```

### Usage

```typescript
// Add a span to a thunk
fetchUser(id).span("fetchUser", { userId: id })
// Thunk<User, FetchError, Tracer>
```

### Providing

```typescript
// Simple console tracer
const consoleTracer = Provider.provide(Tracer, () => ({
  span: async (name, attributes, fn) => {
    console.log(`[${name}] start`, attributes)
    const result = await fn()
    console.log(`[${name}] end`)
    return result
  },
}))

// OpenTelemetry tracer
const otelTracer = Provider.provide(Tracer, () => ({
  span: (name, attributes, fn) =>
    tracer.startActiveSpan(name, { attributes }, (span) =>
      fn().finally(() => span.end()),
    ),
}))

thunk.provide(otelTracer)
```

---

## Type Inference

### Yieldables

| Type         | Returns         | Adds to E | Adds to R |
| ------------ | --------------- | --------- | --------- |
| `Thunk`      | `T`             | `E`       | `R`       |
| `Token`      | `TokenInstance` | —         | `Token`   |
| `TypedError` | (fails)         | `Error`   | —         |

### Unwrapping

Values returned from `then`, `catch`, or yielded in `gen`:

| Input        | Value           | Error   | Requirements |
| ------------ | --------------- | ------- | ------------ |
| `T`          | `T`             | `never` | `never`      |
| `Promise<T>` | `T`             | `never` | `never`      |
| `Thunk`      | `T`             | `E`     | `R`          |
| `Token`      | `TokenInstance` | `never` | `Token`      |
| `TypedError` | `never`         | `Error` | `never`      |

### Channel Accumulation

```typescript
a.then(() => b)
// Thunk<Tb, Ea | Eb, Ra | Rb>
```

### Providing Removes from R

```typescript
thunk.provide(partialProvider) // R -= provided tokens
thunk.provide(fullProvider) // R = never → runnable
```

---

## Example

```typescript
// Tokens (use declare for shape)
class ConfigService extends Token("ConfigService") {
  declare readonly apiUrl: string
  declare readonly timeout: number
}

class UserService extends Token("UserService") {
  declare readonly getUser: (id: string) => Thunk<User, FetchError, never>
}

// Errors (use generic for type-safe constructor)
class UnauthorizedError extends TypedError("UnauthorizedError") {}

class FetchError extends TypedError("FetchError")<{
  readonly cause: unknown
}> {}

// Thunk
const getUserProfile = (id: string) =>
  Thunk.gen(function* () {
    const config = yield* ConfigService
    const userService = yield* UserService
    const user = yield* userService.getUser(id).timeout(config.timeout)
    if (!user.active) yield* new UnauthorizedError()
    return { id: user.id, name: user.name, email: user.email }
  })
// Thunk<UserProfile, FetchError | TimeoutError | UnauthorizedError, ConfigService | UserService>

// Provider (must provide full shape matching declared properties)
const appProvider = Provider.provide(ConfigService, () => ({
  apiUrl: "https://api.example.com",
  timeout: 5000,
})).provide(UserService, (ctx) => ({
  getUser: (id) =>
    Thunk.try({
      try: () =>
        fetch(`${ctx.get(ConfigService).apiUrl}/users/${id}`).then((response) =>
          response.json(),
        ),
      catch: (error) => new FetchError({ cause: error }),
    }),
}))

// Execute
const result = await Thunk.run(getUserProfile("123").provide(appProvider))

if (result.ok) console.log(result.value)
else console.error(result.error)
```

---

## Appendix: Comparison with Effect

| Concept           | Effect                          | thunx                     |
| ----------------- | ------------------------------- | ------------------------- |
| Core type         | `Effect<A, E, R>`               | `Thunk<T, E, R>`          |
| Lift value        | `Effect.succeed`                | `Thunk.from`              |
| Create from thunk | `Effect.try`                    | `Thunk.try`               |
| Fail              | `Effect.fail`                   | `return new TypedError()` |
| Transform         | `Effect.map` / `Effect.flatMap` | `thunk.then`              |
| Handle errors     | `Effect.catchTag`               | `thunk.catch`             |
| Side effects      | `Effect.tap`                    | `thunk.tap`               |
| Run               | `Effect.runPromise`             | `Thunk.run`               |
| Generator syntax  | `Effect.gen`                    | `Thunk.gen`               |
| Service access    | `yield* Tag`                    | `yield* Token`            |
