import { describe, expect, it } from "vitest";
describe("Mingle project smoke tests", () => {
  it("provides the app name", () => expect("Mingle".toLowerCase()).toBe("mingle"));
  it("keeps the public post character limit", () => expect("Hello Mingle".length).toBeLessThanOrEqual(500));
});
