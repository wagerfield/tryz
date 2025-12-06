/**
 * Phantom brand symbol for type-level token name discrimination.
 * This symbol is never used at runtime — it exists purely for TypeScript
 * to distinguish between token instances with different names.
 */
declare const TokenNameBrand: unique symbol

/**
 * Creates a Token class with a typed `name` for dependency injection.
 *
 * The token name is stored as a static property on the class for runtime
 * lookups. Instances use a phantom type for type-level discrimination,
 * keeping the runtime instance clean and conflict-free.
 *
 * @example
 * ```ts
 * class EnvService extends Token("EnvService")<{
 *   readonly BASE_URL: string
 *   readonly API_KEY: string
 * }> {}
 *
 * const instance = new EnvService({
 *   BASE_URL: "https://api.example.com",
 *   API_KEY: "super-secret-key"
 * })
 *
 * EnvService.name // "EnvService" (class access for runtime)
 * // instance has no 'name' property — shape is uncontaminated
 * ```
 */
export const Token = <const Name extends string>(name: Name) =>
	class Token {
		static readonly name = name

		constructor(shape: Record<string, unknown>) {
			Object.assign(this, shape)
		}
	} as TokenConstructor<Name>

export interface TokenConstructor<Name extends string> {
	readonly name: Name
	new <Shape extends Record<string, unknown>>(
		shape: Shape,
	): TokenInstance<Name, Shape>
}

export interface TokenClass {
	readonly name: string
	new (shape: never): object
}

/**
 * Token instance type with phantom brand for type-level name discrimination.
 * The `TokenNameBrand` property doesn't exist at runtime — it's purely
 * a type-level marker that TypeScript uses to track which token an instance
 * belongs to.
 */
export type TokenInstance<
	Name extends string,
	Shape extends Record<string, unknown>,
> = Readonly<Shape> & { readonly [TokenNameBrand]: Name }

export type TokenType<T> = T extends new (shape: never) => infer I ? I : never

/**
 * Extracts the token name from an instance type via the phantom brand.
 */
export type TokenName<I> = I extends { readonly [TokenNameBrand]: infer N }
	? N
	: never

/**
 * Extracts the "shape" of a token (the instance type without the phantom brand).
 * Used by `.provide()` to allow passing just the shape instead of a full instance.
 *
 * @example
 * ```ts
 * type Shape = TokenShape<typeof FooService>
 * // { readonly foo: string }
 * ```
 */
export type TokenShape<T extends TokenClass> = Omit<
	TokenType<T>,
	typeof TokenNameBrand
>
