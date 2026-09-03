// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  shouldPromptForNotificationPermission,
  markNotificationPermissionPrompted
} from "@/components/garderobe/wardrobe/notification-permission";

// jsdom in this project's vitest setup does not implement window.localStorage,
// so provide a minimal in-memory stand-in, matching the pattern used in
// app/wardrobe/batch/new/__tests__/page.test.tsx.
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: localStorageMock
});

function setNotificationPermission(permission: "default" | "granted" | "denied" | undefined) {
  if (permission === undefined) {
    // Simulate a browser with no Notification API at all (e.g. some mobile
    // browsers and older Safari versions).
    // @ts-expect-error deliberately deleting a global for the test
    delete window.Notification;
    return;
  }

  Object.defineProperty(window, "Notification", {
    configurable: true,
    writable: true,
    value: { permission }
  });
}

describe("notification permission gating", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setNotificationPermission("default");
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("prompts when never asked before, Notification exists, and permission is still default", () => {
    expect(shouldPromptForNotificationPermission()).toBe(true);
  });

  it("does not prompt once the flag has been set, regardless of how the user answered", () => {
    markNotificationPermissionPrompted();
    expect(shouldPromptForNotificationPermission()).toBe(false);
  });

  it("marks the flag on 'turn on'", () => {
    expect(window.localStorage.getItem("gw.notificationPermissionPrompted")).toBeNull();
    markNotificationPermissionPrompted();
    expect(window.localStorage.getItem("gw.notificationPermissionPrompted")).toBe("1");
  });

  it("marks the flag on 'not now' too, so the ask-once-ever contract holds for a decline", () => {
    // Unlike the photo-library permission dialog (which only records an
    // allow), this dialog is asked exactly once ever, whichever way the
    // user answers — declining still sets the flag.
    markNotificationPermissionPrompted();
    expect(window.localStorage.getItem("gw.notificationPermissionPrompted")).toBe("1");
    expect(shouldPromptForNotificationPermission()).toBe(false);
  });

  it("does not prompt when the Notification API does not exist", () => {
    setNotificationPermission(undefined);
    expect(shouldPromptForNotificationPermission()).toBe(false);
  });

  it("does not prompt when permission has already been granted", () => {
    setNotificationPermission("granted");
    expect(shouldPromptForNotificationPermission()).toBe(false);
  });

  it("does not prompt when permission has already been denied", () => {
    setNotificationPermission("denied");
    expect(shouldPromptForNotificationPermission()).toBe(false);
  });
});
