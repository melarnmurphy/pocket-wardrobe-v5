"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import {
  listNotificationsAction,
  markAllNotificationsReadAction
} from "@/app/notifications-actions";
import type { AppNotification } from "@/lib/domain/notifications";

const SUBJECT_HREF: Record<string, (id: string) => string> = {
  thread: (id) => `/local/threads/${id}`,
  piece: (id) => `/wardrobe/${id}`,
  listing: (id) => `/local/${id}`,
  trend: (id) => `/trends/${id}`
};

/** 9f notifications. */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const unreadCount = items.filter((item) => !item.read_at).length;

  async function load() {
    const result = await listNotificationsAction();
    setItems(result);
    setLoaded(true);
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="notifications"
        onClick={async () => {
          setOpen((current) => !current);
          if (!loaded) await load();
        }}
        className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgba(30,26,23,.06)]"
      >
        <Bell size={16} strokeWidth={1.5} />
        {unreadCount > 0 ? (
          <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--oxblood,var(--accent))] text-[9px] text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+.5rem)] z-50 w-[300px] rounded-[14px] border border-[rgba(30,26,23,.11)] bg-[var(--cream,#fff)] p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
              notifications
            </span>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="text-[10px] underline text-[var(--stone)]"
                onClick={async () => {
                  await markAllNotificationsReadAction();
                  setItems((current) => current.map((item) => ({ ...item, read_at: new Date().toISOString() })));
                }}
              >
                mark all read
              </button>
            ) : null}
          </div>
          {items.length ? (
            <div className="mt-1 flex max-h-[320px] flex-col overflow-y-auto">
              {items.map((item) => {
                const href = item.subject_kind && item.subject_id ? SUBJECT_HREF[item.subject_kind]?.(item.subject_id) : null;
                const content = (
                  <div
                    className={[
                      "rounded-[8px] px-2 py-2 text-[12.5px]",
                      item.read_at ? "text-[var(--stone)]" : "text-[var(--ink)]"
                    ].join(" ")}
                  >
                    <p className="font-medium">{item.title}</p>
                    <p className="text-[11px] text-[var(--stone)]">{item.body}</p>
                  </div>
                );
                return href ? (
                  <Link key={item.id} href={href as never} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                );
              })}
            </div>
          ) : (
            <p className="px-2 py-4 text-center text-[11px] text-[var(--stone)]">
              nothing yet
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
