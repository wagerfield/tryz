import { describe, expect, test } from "vitest"
import { Program } from "./program"

describe("Program", () => {
	test("Program class is defined", () => {
		expect(Program).toBeDefined()
	})

	test("Program has then method", () => {
		expect(Program.prototype.then).toBeDefined()
		expect(typeof Program.prototype.then).toBe("function")
	})

	test("Program has catch method", () => {
		expect(Program.prototype.catch).toBeDefined()
		expect(typeof Program.prototype.catch).toBe("function")
	})

	test("Program has tap method", () => {
		expect(Program.prototype.tap).toBeDefined()
		expect(typeof Program.prototype.tap).toBe("function")
	})

	test("Program has provide method", () => {
		expect(Program.prototype.provide).toBeDefined()
		expect(typeof Program.prototype.provide).toBe("function")
	})

	test("Program has retry method", () => {
		expect(Program.prototype.retry).toBeDefined()
		expect(typeof Program.prototype.retry).toBe("function")
	})

	test("Program has timeout method", () => {
		expect(Program.prototype.timeout).toBeDefined()
		expect(typeof Program.prototype.timeout).toBe("function")
	})

	test("Program has finally method", () => {
		expect(Program.prototype.finally).toBeDefined()
		expect(typeof Program.prototype.finally).toBe("function")
	})
})
