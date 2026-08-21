"use client";

import { useEffect, useRef } from "react";

export default function VisitTracker() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch("/api/analytics/visit", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {
      // 集計失敗で利用者の操作を止めない。
    });
  }, []);

  return null;
}
