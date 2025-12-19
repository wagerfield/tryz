import { describe, expect, test } from "vitest"
import { Shell } from "./shell"

describe("Shell", () => {
  test("Shell class is defined", () => {
    expect(Shell).toBeDefined()
  })

  test("Shell has use method", () => {
    expect(Shell.prototype.use).toBeDefined()
    expect(typeof Shell.prototype.use).toBe("function")
  })

  test("Shell has require method", () => {
    expect(Shell.prototype.require).toBeDefined()
    expect(typeof Shell.prototype.require).toBe("function")
  })

  test("Shell has provide method", () => {
    expect(Shell.prototype.provide).toBeDefined()
    expect(typeof Shell.prototype.provide).toBe("function")
  })

  test("Shell has try method", () => {
    expect(Shell.prototype.try).toBeDefined()
    expect(typeof Shell.prototype.try).toBe("function")
  })

  test("Shell has fail factory method", () => {
    expect(Shell.prototype.fail).toBeDefined()
    expect(typeof Shell.prototype.fail).toBe("function")
  })

  test("Shell has all combinator", () => {
    expect(Shell.prototype.all).toBeDefined()
    expect(typeof Shell.prototype.all).toBe("function")
  })

  test("Shell has any combinator", () => {
    expect(Shell.prototype.any).toBeDefined()
    expect(typeof Shell.prototype.any).toBe("function")
  })

  test("Shell has race combinator", () => {
    expect(Shell.prototype.race).toBeDefined()
    expect(typeof Shell.prototype.race).toBe("function")
  })

  test("Shell has run method", () => {
    expect(Shell.prototype.run).toBeDefined()
    expect(typeof Shell.prototype.run).toBe("function")
  })
})
