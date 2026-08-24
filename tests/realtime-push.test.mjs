import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

function serviceWorkerHarness(windows) {
  const handlers = new Map();
  const notifications = [];
  const worker = {
    addEventListener(type, handler) {
      handlers.set(type, handler);
    },
    skipWaiting: async () => undefined,
    clients: {
      matchAll: async () => windows,
      openWindow: async () => undefined,
    },
    registration: {
      showNotification: async (title, options) => {
        notifications.push({ title, options });
      },
    },
    location: { origin: "https://yunamatch.com" },
  };
  vm.runInNewContext(source, { self: worker, URL });
  return { handlers, notifications };
}

async function dispatchPush(handler, payload) {
  let work;
  handler({
    data: { json: () => payload },
    waitUntil(promise) {
      work = promise;
    },
  });
  await work;
}

test("focused YUNAMATCH receives one realtime event without a duplicate OS notification", async () => {
  const received = [];
  const focused = {
    focused: true,
    visibilityState: "visible",
    postMessage: (message) => received.push({ tab: "focused", message }),
  };
  const background = {
    focused: false,
    visibilityState: "hidden",
    postMessage: (message) => received.push({ tab: "background", message }),
  };
  const { handlers, notifications } = serviceWorkerHarness([background, focused]);

  await dispatchPush(handlers.get("push"), {
    title: "メッセージ",
    body: "こんにちは",
    url: "/?chat=42",
    realtime: { type: "chat-message", connectionId: 42 },
  });

  assert.equal(received.length, 1);
  assert.equal(received[0].tab, "focused");
  assert.deepEqual(received[0].message.realtime, {
    type: "chat-message",
    connectionId: 42,
  });
  assert.equal(notifications.length, 0);
});

test("background YUNAMATCH keeps the OS notification and updates only one tab", async () => {
  const received = [];
  const hidden = {
    focused: false,
    visibilityState: "hidden",
    postMessage: () => received.push("hidden"),
  };
  const visible = {
    focused: false,
    visibilityState: "visible",
    postMessage: () => received.push("visible"),
  };
  const { handlers, notifications } = serviceWorkerHarness([hidden, visible]);

  await dispatchPush(handlers.get("push"), {
    title: "申請メッセージ",
    body: "ロールを相談したいです",
    realtime: { type: "application-message", applicationId: 7 },
  });

  assert.deepEqual(received, ["visible"]);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].title, "申請メッセージ");
});
