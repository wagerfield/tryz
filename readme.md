# tryz

**Type-safe, composable programs with tracked errors and dependencies.**

[![npm version](https://img.shields.io/npm/v/tryz.svg)](https://www.npmjs.com/package/tryz)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

---

## Overview

`tryz` is a lightweight TypeScript library for building programs where **errors** and **dependencies** are tracked at the type level. No more runtime surprises from unhandled errors or missing services.

Inspired by functional effect systems, `tryz` provides a minimal API that integrates seamlessly with async/await while giving you:

- **Compile-time error tracking** — Know exactly what can fail
- **Compile-time dependency tracking** — Know exactly what's required to run
- **Type-safe dependency injection** — Services resolved at runtime, verified at compile time
- **Composable programs** — Chain, combine, and transform with full type inference

## Installation

```bash
npm install tryz
```

## Quick Example

```typescript
import { x, Token, TypedError } from "tryz"

// Define service tokens
class UserService extends Token("UserService")<{
	getUser: (id: string) => Promise<User>
}> {}

class Logger extends Token("Logger")<{
	log: (msg: string) => void
}> {}

// Define typed errors
class NotFoundError extends TypedError("NotFound")<{
	resource: string
	id: string
}> {}

// Create a program with tracked requirements
const getUser = x.require(UserService, Logger).try(async (ctx) => {
	const userService = ctx.get(UserService)
	const logger = ctx.get(Logger)

	logger.log("Fetching user...")
	const user = await userService.getUser("123")

	if (!user) {
		return x.fail(
			new NotFoundError({
				resource: "user",
				id: "123",
			}),
		)
	}

	return user
})
// Type: Program<User, NotFoundError, UserService | Logger>

// Provide dependencies
const runnable = getUser
	.provide(x.provide(UserService, { getUser: fetchUserFromApi }))
	.provide(x.provide(Logger, { log: console.log }))
// Type: Program<User, NotFoundError, never>

// Run when all requirements are satisfied
const result = await x.run(runnable)

if (result.success) {
	console.log(result.value) // User
} else {
	console.error(result.error) // NotFoundError
}
```

## Core Concepts

### Program<T, E, R>

A `Program` represents a computation that:

- Produces a value of type `T` on success
- May fail with an error of type `E`
- Requires dependencies of type `R` to be provided before running

```typescript
const program: Program<string, NetworkError, ApiService> = ...

// R must be `never` to run
const runnable: Program<string, NetworkError, never> = program.provide(apiProvider)
```

### Shell

The `Shell` is your entry point for creating programs. Use `x` (the default shell) or create your own.

```typescript
import { x } from "tryz"

// Create programs with .try()
const program = x.try(() => "hello")

// Declare requirements upfront
const shell = x.require(DatabaseService)
const dbProgram = shell.try((ctx) => ctx.get(DatabaseService).query("..."))
```

### Token

Tokens define injectable services with typed interfaces.

```typescript
class ConfigService extends Token("ConfigService")<{
	apiUrl: string
	timeout: number
}> {}

// Use in programs
const program = x.require(ConfigService).try((ctx) => {
	const config = ctx.get(ConfigService)
	return fetch(config.apiUrl)
})
```

### Provider

Providers supply implementations for tokens.

```typescript
const provider = x
	.provide(ConfigService, {
		apiUrl: "https://api.example.com",
		timeout: 5000,
	})
	.provide(Logger, (ctx) => ({
		// Can depend on other provided services
		log: (msg) => console.log(`[${ctx.get(ConfigService).apiUrl}] ${msg}`),
	}))
```

### Result<T, E>

Programs return a `Result` that's either a `Success<T>` or `Failure<E>`.

```typescript
const result = await x.run(program)

if (result.success) {
	console.log(result.value)
} else {
	console.error(result.error)
}
```

### TypedError

Create domain-specific errors with typed payloads.

```typescript
class ValidationError extends TypedError("Validation")<{
	field: string
	message: string
}> {}

throw new ValidationError({
	field: "email",
	message: "Invalid format",
})
```

## Program Methods

### Transformations

```typescript
program
	.then((value) => transform(value)) // Transform success value
	.tap((value) => console.log(value)) // Side effect on success
	.tap({
		value: (v) => console.log("Success:", v),
		error: (e) => console.error("Failed:", e),
	}) // Side effects for both
```

### Error Handling

```typescript
// Catch all errors
program.catch((error) => fallbackValue)

// Catch by error name
program.catch("NotFound", (error) => null)

// Catch multiple errors by name
program.catch({
	NotFound: (error) => null,
	Timeout: (error) => retryLater(),
})

// Handle thrown exceptions at creation
const program = x.try({
	try: (ctx) => JSON.parse(invalidJson),
	catch: (e) => new ParseError({ cause: e }),
})
// Type: Program<T, ParseError, never>
```

### Resilience

```typescript
program
	.retry(3) // Retry up to 3 times
	.retry({ times: 3, delay: 1000 }) // With delay between retries
	.retry({ times: 3, while: (e) => isRetryable(e) }) // Conditional retry
	.timeout(5000) // Timeout after 5 seconds
	.timeout(5000, () => new TimeoutError()) // Custom timeout error
```

### Dependencies

```typescript
program.provide(myProvider) // Satisfy requirements
```

### Cleanup

```typescript
program.finally(() => {
	// Runs regardless of success or failure
	cleanup()
	metrics.record()
})
```

## Combining Programs

```typescript
// Run all programs, collect all results
const all = x.all([programA, programB, programC])

// Run all, return first success
const any = x.any([primary, fallback1, fallback2])

// Run all, return first to complete
const race = x.race([fast, slow])
```

## Why tryz?

| Feature                | `tryz` | `Promise` | `effect` |
| ---------------------- | ------ | --------- | -------- |
| Typed errors           | ✅     | ❌        | ✅       |
| Typed dependencies     | ✅     | ❌        | ✅       |
| Bundle size            | ~2KB   | 0         | ~25KB+   |
| Learning curve         | Low    | None      | High     |
| Async/await compatible | ✅     | ✅        | ✅       |

`tryz` sits in the sweet spot: **more safety than promises, less complexity than full effect systems**.

## Documentation

📖 [Full Documentation](https://tryz.run)

## License

[MIT](./packages/tryz/license) © [Matthew Wagerfield](https://github.com/wagerfield)
