self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "YUNAMATCH",
    body: "新しい通知があります",
    url: "/",
    realtime: null,
  };
  try {
    const incoming = event.data?.json();
    if (incoming && typeof incoming === "object") data = { ...data, ...incoming };
  } catch (error) {
    void error;
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    const receiver =
      windows.find((client) => client.focused) ||
      windows.find((client) => client.visibilityState === "visible") ||
      windows[0];

    if (receiver) {
      receiver.postMessage({
        type: "yunamatch-push",
        notification: {
          title: data.title,
          body: data.body,
          url: data.url,
        },
        realtime: data.realtime,
      });
    }

    if (windows.some((client) => client.focused)) return;
    await self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/yunamatch-official-icon-v2.png",
      badge: "/yunamatch-official-icon-v2.png",
      tag: data.url,
      data: { url: data.url },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  }).then((windows) => {
    const target = new URL(
      event.notification.data?.url || "/",
      self.location.origin,
    ).href;
    const existing = windows.find((client) => client.url === target);
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
