import { afterEach, describe, expect, it, vi } from "vitest";
import { Emitter } from "../src/events";

type Events = { a: { n: number }; b: string };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Emitter", () => {
  it("calls handlers in registration order", () => {
    const e = new Emitter<Events>();
    const calls: string[] = [];
    e.on("a", () => calls.push("first"));
    e.on("a", () => calls.push("second"));
    e.on("a", () => calls.push("third"));
    e.emit("a", { n: 1 });
    expect(calls).toEqual(["first", "second", "third"]);
  });

  it("passes the payload and keeps events apart", () => {
    const e = new Emitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    e.on("a", a);
    e.on("b", b);
    e.emit("a", { n: 7 });
    expect(a).toHaveBeenCalledWith({ n: 7 });
    expect(b).not.toHaveBeenCalled();
  });

  it("once fires a single time", () => {
    const e = new Emitter<Events>();
    const fn = vi.fn();
    e.once("b", fn);
    e.emit("b", "x");
    e.emit("b", "y");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("x");
  });

  it("once handlers keep their place in the order", () => {
    const e = new Emitter<Events>();
    const calls: string[] = [];
    e.on("b", () => calls.push("on"));
    e.once("b", () => calls.push("once"));
    e.on("b", () => calls.push("last"));
    e.emit("b", "x");
    expect(calls).toEqual(["on", "once", "last"]);
  });

  it("the function returned by on removes only that subscription", () => {
    const e = new Emitter<Events>();
    const fn = vi.fn();
    const off = e.on("b", fn);
    e.on("b", fn);
    off();
    off();
    e.emit("b", "x");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("the function returned by once removes it before it fires", () => {
    const e = new Emitter<Events>();
    const fn = vi.fn();
    const off = e.once("b", fn);
    off();
    e.emit("b", "x");
    expect(fn).not.toHaveBeenCalled();
  });

  it("off(event, fn) removes every registration of that handler for that event", () => {
    const e = new Emitter<Events>();
    const fn = vi.fn();
    const other = vi.fn();
    e.on("b", fn);
    e.once("b", fn);
    e.on("b", other);
    e.on("a", fn as never);
    e.off("b", fn);
    e.emit("b", "x");
    e.emit("a", { n: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("off(event) removes every handler of the event only", () => {
    const e = new Emitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    e.on("a", a);
    e.on("b", b);
    e.off("a");
    e.emit("a", { n: 1 });
    e.emit("b", "x");
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("off() removes everything", () => {
    const e = new Emitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    e.on("a", a);
    e.once("b", b);
    e.off();
    e.emit("a", { n: 1 });
    e.emit("b", "x");
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it("binds ctx as this", () => {
    const e = new Emitter<Events>();
    const ctx = { name: "ctx" };
    let seen: unknown;
    e.on("b", function (this: unknown) {
      seen = this;
    }, ctx);
    e.emit("b", "x");
    expect(seen).toBe(ctx);
  });

  it("reports a throwing handler and still runs the others", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const e = new Emitter<Events>();
    const boom = new Error("boom");
    const after = vi.fn();
    e.on("b", () => {
      throw boom;
    });
    e.on("b", after);
    expect(() => e.emit("b", "x")).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[1]).toBe(boom);
  });

  it("a once handler that throws is not called again", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const e = new Emitter<Events>();
    const fn = vi.fn(() => {
      throw new Error("boom");
    });
    e.once("b", fn);
    e.emit("b", "x");
    e.emit("b", "y");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("a handler removed during emit by an earlier handler does not run", () => {
    const e = new Emitter<Events>();
    const late = vi.fn();
    e.on("b", () => e.off("b", late));
    e.on("b", late);
    e.emit("b", "x");
    expect(late).not.toHaveBeenCalled();
  });

  it("a handler added during emit waits for the next emit", () => {
    const e = new Emitter<Events>();
    const added = vi.fn();
    e.once("b", () => e.on("b", added));
    e.emit("b", "x");
    expect(added).not.toHaveBeenCalled();
    e.emit("b", "y");
    expect(added).toHaveBeenCalledTimes(1);
  });

  it("emit with no listeners is a no-op", () => {
    expect(() => new Emitter<Events>().emit("a", { n: 1 })).not.toThrow();
  });
});
