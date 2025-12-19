import { Token } from "./token"

/**
 * Attributes to attach to a span for additional context.
 */
export type SpanAttributes = Record<string, unknown>

/**
 * Options for creating a span.
 */
export type SpanOptions = {
  name: string
  attributes?: SpanAttributes
}

/**
 * A tracer for creating spans to instrument program execution.
 * Implement this token to integrate with OTEL or other tracing systems.
 *
 * @example
 * ```ts
 * // Create a tracer provider
 * const tracerProvider = x.provide(Tracer, {
 *   span: (options, fn) => {
 *     const span = otel.startSpan(options.name, options.attributes)
 *     try {
 *       return fn()
 *     } finally {
 *       span.end()
 *     }
 *   }
 * })
 * ```
 */
export class Tracer extends Token("Tracer")<{
  span: <T>(options: SpanOptions, fn: () => T) => T
}> {}
