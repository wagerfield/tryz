# Thunx Specification

Thunx provides type-safe error handling and dependency injection through a familiar Promise-like interface called a Thunk.

Thunks differ from Promises in two key ways:

**1. Richer types** — `Promise<T>` only tracks the success type. `Thunk<T, E, D>` tracks three channels:

- `T` — success types
- `E` — error types
- `D` — dependency types (must be `never` to run)

```typescript
Thunk<User, FetchError, UserService>
//    ↑     ↑           ↑
//    T     E           D
```

**2. Lazy execution** — Promises execute eagerly. Thunks are nullary (zero-argument) functions that defer computation until explicitly run.

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
| **Polymorphic inputs**  | Methods accept and unwrap `T \| Promise<T> \| Thunk<T, E, D>` uniformly |
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
Thunk.from(existingThunk) // Thunk<T, E, D>
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

Composes `Thunks` using generator syntax. Yield `Thunks` and `Tokens`. Return `TypedErrors` to fail.

```typescript
Thunk.gen(function* () {
  const auth = yield* AuthService // D += AuthService
  const user = yield* fetchUser(auth.userId) // E += FetchError
  if (!user.active) return new InactiveError() // E += InactiveError
  return user // T += User
})
// Thunk<User, FetchError | InactiveError, AuthService>
```

#### `Thunk.all`

Runs `Thunks` concurrently and collects all results.

```typescript
Thunk.all([fetchUser(id), fetchPosts(id)]) // array
// Thunk<[User, Post[]], UserError | PostError, never>

Thunk.all({ user: UserService, auth: ConfigService }) // object
// Thunk<{ user: ..., config: ... }, never, UserService | ConfigService>

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
Thunk.race([fetchData(), timeout(5000)])
// Thunk<Data, FetchError | TimeoutError, never>
```

#### `Thunk.run`

Executes `Thunk<T, E, D>` and returns `Promise<Result<T, E>>`. Requires `D = never`.

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

Transforms the success value. Return a `TypedError` to fail.

```typescript
thunk.then((value) => value.name)
// Thunk<string, E, D>

thunk.then((value) => {
  if (!value) return new NotFoundError()
  return value.name
})
// Thunk<string, E | NotFoundError, D>
```

#### `thunk.catch`

Handles errors. Return a `TypedError` to re-throw.

```typescript
thunk.catch((error) => fallback)
// Thunk<T | Fallback, never, D>

thunk.catch("NotFoundError", (error) => null)
// Thunk<T | null, Exclude<E, NotFoundError>, D>

thunk.catch({
  NotFoundError: (error) => null,
  TimeoutError: (error) => new RetryError(),
})
// Thunk<T | null, Exclude<E, NotFoundError | TimeoutError> | RetryError, D>
```

#### `thunk.finally`

Runs regardless of outcome.

```typescript
thunk.finally(() => console.log("done"))
```

#### `thunk.pipe`

Applies a transformation function.

```typescript
const withRetry = <T, E, D>(t: Thunk<T, E, D>) => t.retry(3)
const orNull = <T, E, D>(t: Thunk<T, E, D>) => t.catch((error) => null)

thunk.pipe(withRetry).pipe(orNull) // Thunk<T | null, never, D>
```

#### `thunk.tap`

Executes side effects, passing `T` through unchanged. Callbacks may return `Thunks`, merging their `E` and `D` channels.

```typescript
thunk.tap((value) => console.log(value))

thunk.tap({
  value: (value) => logToAnalytics(value), // Thunk<void, AnalyticsError, AnalyticsService>
  error: (error) => logToSentry(error), // Thunk<void, SentryError, SentryService>
})
// Thunk<T, E | AnalyticsError | SentryError, D | AnalyticsService | SentryService>
```

#### `thunk.span`

Adds a tracing span. Requires a `Tracer` token to be provided before running.

```typescript
thunk.span("fetchUser", { userId: id })
// Thunk<T, E, D | Tracer>
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
// Thunk<T, E | TimeoutError, D>
```

#### `thunk.provide`

Satisfies dependencies with a `Provider`.

```typescript
thunk.provide(appProvider)
// Thunk<T, E, Exclude<D, ProvidedTokens>>
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

Tokens define injectable dependencies with type `Thunk<Shape, never, Token>`.

Using a `Token` (via `.then()` or `yield*`) returns its `Shape` and adds `Token` to `D`.

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
  const service = yield* UserService // D += UserService
  const user = service.getUser(userId) // E += FetchError
  return user // T += User
}) // Thunk<User, FetchError, UserService>
```

Tokens are provided via [`Provider`](#5-provider).

---

## 4. `Context`

Context is passed to `Thunk.try` and `Provider.provide` factories:

```typescript
// Thunk.try and Provider.provide static methods
interface Context {
  readonly signal: AbortSignal
}

// Provider .provide instance method
interface ProviderContext<C> extends Context {
  get<T extends C>(token: TokenClass<T>): TokenInstance<T>
}
```

The `signal` originates from `Thunk.run` options. The `get` method is available when prior Tokens exist in the `Provider` chain.

---

## 5. `Provider`

Providers bundle `Token` implementations with type `Provider<C, E>` where `C = Context` and `E = Errors`.

Chained `.provide` calls accumulate tokens in `C`, errors in `E`, and can access prior tokens via `ctx.get(Token)`.

Like Thunks, Providers are immutable; each method returns a new `Provider` instance.

### Static Methods

| Method             | Description                    |
| ------------------ | ------------------------------ |
| `Provider.provide` | Create provider with token     |
| `Provider.merge`   | Create from multiple providers |

### Instance Methods

| Method     | Description                           |
| ---------- | ------------------------------------- |
| `.provide` | Chain token (can access prior tokens) |
| `.merge`   | Combine with another provider         |
| `.pick`    | Subset with selected tokens           |
| `.omit`    | Subset excluding tokens               |

### Usage

```typescript
// Create with static method
const configProvider = Provider.provide(ConfigService, () => ({
  apiUrl: "https://api.example.com",
  apiToken: "super_secret_token",
}))
// Provider<ConfigService, never>

// Chain with instance method
const databaseProvider = configProvider.provide(DatabaseService, (ctx) =>
  createDatabaseService(ctx.get(ConfigService)),
)
// Provider<ConfigService | DatabaseService, DatabaseError>

// Provide to thunk — subtracts C from D, merges E
thunk.provide(databaseProvider)
// Thunk<T, E | ConnectionError, Exclude<D, ConfigService | DatabaseService>>

// Combine providers
const combined = Provider.merge(authProvider, userProvider)

// Subset providers
const selected = combined.pick(ConfigService, UserService)
const excluded = combined.omit(AuthService)
```

---

## 6. `Result`

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

## 7. `Tracer`

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
const tracerProvider = Provider.provide(Tracer, () => ({
  span: async (name, attributes, fn) => {
    console.log(`[${name}] start`, attributes)
    const result = await fn()
    console.log(`[${name}] ${result.ok ? "ok" : "error"}`)
    return result
  },
}))

// Provide Tracer — subtracts from D
thunk.provide(tracerProvider)
// Thunk<User, FetchError, never>
```

---

## Type Inference

### Yieldables

| Type    | Returns         | Adds to E | Adds to D |
| ------- | --------------- | --------- | --------- |
| `Thunk` | `T`             | `E`       | `D`       |
| `Token` | `TokenInstance` | `never`   | `Token`   |

### Returnables

| Type         | Adds to T | Adds to E |
| ------------ | --------- | --------- |
| `T`          | `T`       | `never`   |
| `TypedError` | `never`   | `Error`   |

### Unwrapping

Values returned from `then` or `catch`:

| Input        | Value (`T`)     | Error (`E`) | Dependencies (`D`) |
| ------------ | --------------- | ----------- | ------------------ |
| `T`          | `T`             | `never`     | `never`            |
| `Promise<T>` | `T`             | `never`     | `never`            |
| `Thunk`      | `T`             | `E`         | `D`                |
| `Token`      | `TokenInstance` | `never`     | `Token`            |
| `TypedError` | `never`         | `Error`     | `never`            |

### Channel Accumulation

```typescript
a.then(() => b)
// Thunk<Tb, Ea | Eb, Da | Db>
```

### Providing Removes from D

```typescript
thunk.provide(partialProvider) // D -= provided tokens
thunk.provide(fullProvider) // D = never → runnable
```

---

## Example

```typescript
// Token
class UserService extends Token("UserService") {
  declare readonly getUser: (id: string) => Thunk<User, NotFoundError, never>
}

// Error
class NotFoundError extends TypedError("NotFoundError")<{
  readonly resource: string
  readonly id: string
}> {}

// Thunk
const getUser = (id: string) =>
  UserService.then((service) => service.getUser(id))
// Thunk<User, NotFoundError, UserService>

// Provider
const provider = Provider.provide(UserService, () => ({
  getUser: (id) =>
    Thunk.try({
      try: () => fetchUser(id),
      catch: (error) => new NotFoundError({ resource: "user", id }),
    }),
}))

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

| Concept           | Effect              | Thunx                     |
| ----------------- | ------------------- | ------------------------- |
| Core type         | `Effect<A, E, R>`   | `Thunk<T, E, D>`          |
| Lift value        | `Effect.succeed`    | `Thunk.from`              |
| Create from thunk | `Effect.try`        | `Thunk.try`               |
| Fail              | `Effect.fail`       | `return new TypedError()` |
| Transform         | `Effect.andThen`    | `thunk.then`              |
| Handle errors     | `Effect.catchTag`   | `thunk.catch`             |
| Side effects      | `Effect.tap`        | `thunk.tap`               |
| Run               | `Effect.runPromise` | `Thunk.run`               |
| Generator syntax  | `Effect.gen`        | `Thunk.gen`               |
| Service access    | `yield* Tag`        | `yield* Token`            |
