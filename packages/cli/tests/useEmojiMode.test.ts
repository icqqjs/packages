import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FACE_MAP, useEmojiMode } from "../src/components/chat/useEmojiMode.js";

type EmojiModeApi = ReturnType<typeof useEmojiMode>;

function mountHook(): {
  getValue: () => EmojiModeApi;
  unmount: () => void;
} {
  let value: EmojiModeApi | undefined;
  let renderer: ReactTestRenderer | undefined;

  function Harness() {
    value = useEmojiMode();
    return null;
  }

  act(() => {
    renderer = create(React.createElement(Harness));
  });

  return {
    getValue: () => {
      if (!value) throw new Error("hook not mounted");
      return value;
    },
    unmount: () => {
      act(() => {
        renderer?.unmount();
      });
    },
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const message = args.join(" ");
    if (message.includes("react-test-renderer is deprecated")) return;
    console.warn(...(args as Parameters<typeof console.warn>));
  });
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("useEmojiMode", () => {
  it("exposes initial paging state", () => {
    const hook = mountHook();
    const value = hook.getValue();

    expect(value.query).toBe("");
    expect(value.index).toBe(0);
    expect(value.page).toBe(0);
    expect(value.filtered).toEqual(FACE_MAP);
    expect(value.pageItems).toEqual(FACE_MAP.slice(0, 10));
    expect(value.totalPages).toBe(Math.ceil(FACE_MAP.length / 10));

    hook.unmount();
  });

  it("filters by typed id and returns selected face tag", () => {
    const hook = mountHook();

    act(() => {
      expect(hook.getValue().handleKey("7", {})).toBeNull();
      expect(hook.getValue().handleKey("6", {})).toBeNull();
    });

    expect(hook.getValue().query).toBe("76");
    expect(hook.getValue().filtered).toEqual([[76, "👍 赞"]]);
    expect(hook.getValue().pageItems).toEqual([[76, "👍 赞"]]);

    let selected: string | null = null;
    act(() => {
      selected = hook.getValue().handleKey(undefined, { return: true });
    });

    expect(selected).toBe("[face:76]");
    hook.unmount();
  });

  it("supports navigation keys, delete, escape, and reset", () => {
    const hook = mountHook();

    act(() => {
      hook.getValue().handleKey(undefined, { rightArrow: true });
    });
    expect(hook.getValue().page).toBe(1);
    expect(hook.getValue().index).toBe(0);

    act(() => {
      hook.getValue().handleKey(undefined, { downArrow: true });
      hook.getValue().handleKey(undefined, { downArrow: true });
      hook.getValue().handleKey(undefined, { upArrow: true });
    });
    expect(hook.getValue().index).toBe(1);

    act(() => {
      hook.getValue().handleKey("赞", {});
    });
    expect(hook.getValue().query).toBe("赞");
    expect(hook.getValue().page).toBe(0);
    expect(hook.getValue().index).toBe(0);

    act(() => {
      hook.getValue().handleKey(undefined, { backspace: true });
    });
    expect(hook.getValue().query).toBe("");

    act(() => {
      hook.getValue().handleKey("x", {});
      hook.getValue().handleKey(undefined, { delete: true });
    });
    expect(hook.getValue().query).toBe("");

    expect(hook.getValue().handleKey(undefined, { escape: true })).toBe("exit");

    act(() => {
      hook.getValue().handleKey(undefined, { rightArrow: true });
      hook.getValue().handleKey(undefined, { downArrow: true });
      hook.getValue().reset();
    });
    expect(hook.getValue().query).toBe("");
    expect(hook.getValue().page).toBe(0);
    expect(hook.getValue().index).toBe(0);

    hook.unmount();
  });

  it("ignores ctrl/meta typing and clamps navigation within bounds", () => {
    const hook = mountHook();

    act(() => {
      hook.getValue().handleKey("a", { ctrl: true });
      hook.getValue().handleKey("b", { meta: true });
      hook.getValue().handleKey(undefined, { leftArrow: true });
      for (let i = 0; i < 20; i += 1) {
        hook.getValue().handleKey(undefined, { downArrow: true });
      }
    });

    expect(hook.getValue().query).toBe("");
    expect(hook.getValue().page).toBe(0);
    expect(hook.getValue().index).toBe(hook.getValue().pageItems.length - 1);

    hook.unmount();
  });
});