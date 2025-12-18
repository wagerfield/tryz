# tryz Specification

> Lean, type-safe error handling and dependency injection with a `Promise`-like API.

---

## Introduction

`tryz` provides type-safe error handling and dependency injection through a familiar `Promise`-like interface called a `Program`. Programs are lazy computations that track:

- `T` — the success value type
- `E` — possible error type
- `R` — required dependency type (must be `never` to run)

```ts
Program<User | null, FetchError, UserService>
//      ↑            ↑           ↑
//      T            E           R
```

Unlike `Promises` which are _eagerly_ executed, `Programs` are thunks (zero-argument functions) that are _lazily_ executed.

Thunks defer execution, enabling composition, observation, instrumentation, and resilience through retryability.

### Design Principles

| Principle               | Description                                                               |
| ----------------------- | ------------------------------------------------------------------------- |
| **Errors as values**    | Return `TypedError` instances to fail — no `throw` statements             |
| **Polymorphic inputs**  | Methods accept and unwrap `T \| Promise<T> \| Program<T, E, R>` uniformly |
| **Minimal API surface** | 7 static methods; everything else chains from instances                   |

---

## 1. `Program`

### 2.1 Static Methods

| Method                         | Description                     |
| ------------------------------ | ------------------------------- |
| [`Program.from`](#programfrom) | Lift value, promise, or program |
| [`Program.try`](#programtry)   | Create from thunk               |
| [`Program.gen`](#programgen)   | Compose via generators          |
| [`Program.all`](#programall)   | Concurrent — collect all        |
| [`Program.any`](#programany)   | Concurrent — first success      |
| [`Program.race`](#programrace) | Concurrent — first to settle    |
| [`Program.run`](#programrun)   | Execute program                 |

#### `Program.from`

Lifts a value, `Promise`, or `Program` into a new `Program`.

```ts
Program.from(42) // Program<number, never, never>
Program.from(fetch(url)) // Program<Response, never, never>
Program.from(existingProgram) // Program<T, E, R>
```

#### `Program.try`

Creates a `Program` from a thunk with optional error handling.

```ts
Program.try(() => 42)
// Program<number, never, never>

Program.try({
	try: () => fetch(url),
	catch: (error) => new FetchError({ cause: error }),
})
// Program<Response, FetchError, never>

Program.try((ctx) => fetch(url, { signal: ctx.signal }))
// Program<Response, never, never>
```

> Without `catch`, thrown errors are wrapped in an `UnexpectedError`.

#### `Program.gen`

Composes `Programs` using generator syntax. Yield `Programs`, `Tokens`, or `TypedErrors`.

```ts
Program.gen(function* () {
	const auth = yield* AuthService // R += AuthService
	const user = yield* fetchUser(auth.userId) // E += FetchError
	if (!user.active) yield* new InactiveError() // E += InactiveError
	return user // T += User
})
// Program<User, FetchError | InactiveError, AuthService>
```

#### `Program.all`

Runs `Programs` concurrently and collects all results.

```ts
Program.all([fetchUser(id), fetchPosts(id)])
// Program<[User, Post[]], UserError | PostError, never>

Program.all({ user: UserService, config: ConfigService })
// Program<{ user: ..., config: ... }, never, UserService | ConfigService>

Program.all(programs, { concurrency: 5 })
```

#### `Program.any`

Returns first successful result.

```ts
Program.any([fetchFromCache(id), fetchFromDb(id)])
// Program<User, CacheError | DbError, ...>
```

#### `Program.race`

Returns first to settle (success or failure).

```ts
Program.race([fetchData(), timeout(5000)])
// Program<Data, FetchError | TimeoutError, never>
```

#### `Program.run`

Executes a `Program`. Requires `R = never`.

```ts
const result = await Program.run(program) // Result<T, E>

if (result.ok) console.log(result.value)
else console.error(result.error)

// With options
await Program.run(program, { signal }) // pass AbortSignal
await Program.run(program, { unwrap: true }) // throws on error, returns T
```

---

### 2.2 Instance Methods

| Method                               | Description                   |
| ------------------------------------ | ----------------------------- |
| [`program.then`](#programthen)       | Transform success value       |
| [`program.catch`](#programcatch)     | Handle errors                 |
| [`program.finally`](#programfinally) | Cleanup regardless of outcome |
| [`program.pipe`](#programpipe)       | Apply transformation          |
| [`program.tap`](#programtap)         | Side effects                  |
| [`program.span`](#programspan)       | Add tracing span              |
| [`program.retry`](#programretry)     | Retry on failure              |
| [`program.timeout`](#programtimeout) | Add timeout                   |
| [`program.provide`](#programprovide) | Satisfy requirements          |

#### `program.then`

Transforms the success value. Return a `TypedError` to fail.

```ts
program.then((v) => v.name)
// Program<string, E, R>

program.then((v) => {
	if (!v) return new NotFoundError()
	return v.name
})
// Program<string, E | NotFoundError, R>
```

#### `program.catch`

Handles errors. Return a `TypedError` to re-throw.

```ts
program.catch((e) => fallback)
// Program<T | Fallback, never, R>

program.catch("NotFoundError", (e) => null)
// Program<T | null, Exclude<E, NotFoundError>, R>

program.catch({
	NotFoundError: (e) => null,
	TimeoutError: (e) => new RetryError(),
})
// Program<T | null, Exclude<E, ...> | RetryError, R>
```

#### `program.finally`

Runs cleanup regardless of outcome.

```ts
program.finally(() => cleanup())
```

#### `program.pipe`

Applies a transformation function.

```ts
const withRetry = <T, E, R>(p: Program<T, E, R>) => p.retry(3)
program.pipe(withRetry)
```

#### `program.tap`

Runs side effects without changing the value.

```ts
program.tap((v) => console.log(v))

program.tap({
	value: (v) => console.log(v),
	error: (e) => console.error(e),
})
```

#### `program.span`

Adds a tracing span.

```ts
program.span("fetchUser", { userId: id })
// Program<T, E, R | Tracer>
```

#### `program.retry`

Retries on failure.

```ts
program.retry(3)
program.retry({ times: 3, delay: 1000, backoff: "exponential" })
```

#### `program.timeout`

Adds a timeout.

```ts
program.timeout(5000)
// Program<T, E | TimeoutError, R>
```

#### `program.provide`

Satisfies requirements with a `Provider`.

```ts
program.provide(appProvider)
// Program<T, E, Exclude<R, ProvidedTokens>>
```

---

## 2. `TypedError`

All errors in `E` are `TypedError` instances with a typed `name` for discrimination.

### Definition

```ts
class NotFoundError extends TypedError("NotFoundError")<{
	readonly resource: string
}> {}
```

### Usage

Return or yield to fail — no `throw` needed:

```ts
program.then((v) => {
	if (!v) return new NotFoundError({ resource: "user" })
	return v
})

Program.gen(function* () {
	const user = yield* fetchUser(id)
	if (!user) yield* new NotFoundError({ resource: "user" })
	return user
})
```

### Built-in Errors

| Error             | Purpose             |
| ----------------- | ------------------- |
| `UnexpectedError` | Unexpected errors   |
| `TimeoutError`    | Timeout exceeded    |
| `AbortError`      | Cancelled operation |

---

## 3. `Token`

`Tokens` define injectable dependencies. A `Token` class **is a `Program`** — yielding it returns the service instance and adds the `Token` to `R`.

### Definition

```ts
class UserService extends Token("UserService")<{
	readonly getUser: (id: string) => Program<User, FetchError, never>
}> {}
```

### Usage

```ts
// In generators
const svc = yield * UserService

// Chain directly
UserService.then((svc) => svc.getUser(id))
// Program<User, FetchError, UserService>

// In Program.all
Program.all({ user: UserService, config: ConfigService })
```

### Providing

`Tokens` are provided via `Provider` instances:

```ts
const provider = Provider.provide(ConfigService, () => ({
	apiUrl: "https://...",
})).provide(UserService, (ctx) => ({
	getUser: (id) =>
		Program.try({
			try: () => fetch(`${ctx.get(ConfigService).apiUrl}/users/${id}`),
			catch: (e) => new FetchError({ cause: e }),
		}),
}))

program.provide(provider)
```

---

## 4. `Context`

Execution context passed to factories. Two variants exist:

```ts
// Base context (Program.try, Provider.provide static)
interface Context {
	readonly signal: AbortSignal
}

// Extended context (Provider .provide instance method)
interface ProviderContext<C> extends Context {
	get<T extends C>(token: TokenClass<T>): TokenInstance<T>
}
```

The `signal` originates from `Program.run` options (or an internal default). The `get` method is only available when prior `Tokens` exist in the `Provider` chain.

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

```ts
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

program.provide(appProvider)
// Program<T, E, Exclude<R, ConfigService | DbService | UserService>>
```

---

## 6. `Result`

The return type of `Program.run`.

```ts
type Result<T, E> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: E }
```

---

## Type Inference

### Yieldables

| Type         | Returns         | Adds to E | Adds to R |
| ------------ | --------------- | --------- | --------- |
| `Program`    | `T`             | `E`       | `R`       |
| `Token`      | `TokenInstance` | —         | `Token`   |
| `TypedError` | (fails)         | `Error`   | —         |

### Unwrapping

Values returned from `then`, `catch`, or yielded in `gen`:

| Input        | Value           | Error   | Requirements |
| ------------ | --------------- | ------- | ------------ |
| `T`          | `T`             | `never` | `never`      |
| `Promise<T>` | `T`             | `never` | `never`      |
| `Program`    | `T`             | `E`     | `R`          |
| `Token`      | `TokenInstance` | `never` | `Token`      |
| `TypedError` | `never`         | `Error` | `never`      |

### Channel Accumulation

```ts
a.then(() => b)
// Program<Tb, Ea | Eb, Ra | Rb>
```

### Providing Removes from R

```ts
program.provide(partialProvider) // R -= provided tokens
program.provide(fullProvider) // R = never → runnable
```

---

## Example

```ts
// Tokens
class ConfigService extends Token("ConfigService")<{
	readonly apiUrl: string
	readonly timeout: number
}> {}

class UserService extends Token("UserService")<{
	readonly getUser: (id: string) => Program<User, FetchError, never>
}> {}

// Errors
class UnauthorizedError extends TypedError("UnauthorizedError") {}

// Program
const getUserProfile = (id: string) =>
	Program.gen(function* () {
		const config = yield* ConfigService
		const userService = yield* UserService
		const user = yield* userService.getUser(id).timeout(config.timeout)
		if (!user.active) yield* new UnauthorizedError()
		return { id: user.id, name: user.name, email: user.email }
	})
// Program<UserProfile, FetchError | TimeoutError | UnauthorizedError, ConfigService | UserService>

// Provider
const appProvider = Provider.provide(ConfigService, () => ({
	apiUrl: "https://api.example.com",
	timeout: 5000,
})).provide(UserService, (ctx) => ({
	getUser: (id) =>
		Program.try({
			try: () =>
				fetch(`${ctx.get(ConfigService).apiUrl}/users/${id}`).then((r) =>
					r.json(),
				),
			catch: (e) => new FetchError({ cause: e }),
		}),
}))

// Execute
const result = await Program.run(getUserProfile("123").provide(appProvider))

if (result.ok) console.log(result.value)
else console.error(result.error)
```

---

## Appendix: Comparison with Effect

| Concept           | Effect                          | tryz                      |
| ----------------- | ------------------------------- | ------------------------- |
| Core type         | `Effect<A, E, R>`               | `Program<T, E, R>`        |
| Lift value        | `Effect.succeed`                | `Program.from`            |
| Create from thunk | `Effect.try`                    | `Program.try`             |
| Fail              | `Effect.fail`                   | `return new TypedError()` |
| Transform         | `Effect.map` / `Effect.flatMap` | `program.then`            |
| Handle errors     | `Effect.catchTag`               | `program.catch`           |
| Side effects      | `Effect.tap`                    | `program.tap`             |
| Run               | `Effect.runPromise`             | `Program.run`             |
| Generator syntax  | `Effect.gen`                    | `Program.gen`             |
| Service access    | `yield* Tag`                    | `yield* Token`            |
