"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PillButton } from "@/components/garderobe";
import {
  blockUserAction,
  confirmHandoverAction,
  proposeHandoverAction,
  reportListingAction,
  respondToHandoverAction,
  sendMessageAction
} from "@/app/local/actions";
import type { Thread, ThreadHandover, ThreadMessage } from "@/lib/domain/local-threads/threads-service";

const PAYMENT_METHODS = ["cash", "payid", "bank transfer"] as const;

export function ThreadView({
  viewerId,
  thread,
  initialMessages,
  initialHandover,
  counterpartName
}: {
  viewerId: string;
  thread: Thread;
  initialMessages: ThreadMessage[];
  initialHandover: ThreadHandover | null;
  counterpartName: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [handover, setHandover] = useState(initialHandover);
  const [body, setBody] = useState("");
  const [showHandoverForm, setShowHandoverForm] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`thread:${thread.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${thread.id}` },
        (payload) => {
          const incoming = payload.new as ThreadMessage;
          setMessages((current) =>
            current.some((message) => message.id === incoming.id) ? current : [...current, incoming]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [thread.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(offerCents?: number) {
    if (!body.trim() && offerCents === undefined) return;
    setIsBusy(true);
    await sendMessageAction(thread.id, offerCents !== undefined ? { offerCents, body } : { body });
    setBody("");
    setIsBusy(false);
    router.refresh();
  }

  const iAmBuyer = viewerId === thread.buyer_id;
  const myConfirmed = handover ? (iAmBuyer ? handover.buyer_confirmed : handover.seller_confirmed) : false;

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto rounded-[4px] bg-[var(--paper)] p-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={[
              "max-w-[80%] rounded-[14px] px-3 py-2 text-[12.5px]",
              message.sender_id === viewerId
                ? "self-end bg-[var(--oxblood)] text-[var(--cream)]"
                : "self-start bg-[var(--cream)] text-[var(--ink)]"
            ].join(" ")}
          >
            {message.kind === "offer" ? (
              <span className="font-semibold">offered A${((message.offer_cents ?? 0) / 100).toFixed(0)}</span>
            ) : null}
            {message.body ? <p>{message.body}</p> : null}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="write a message"
          className="flex-1 rounded-[100px] border border-[rgba(30,26,23,.22)] bg-transparent px-4 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
        />
        <PillButton fullWidth={false} disabled={isBusy} onClick={() => send()}>
          send
        </PillButton>
      </div>

      {thread.state !== "blocked" ? (
        <section className="border-t border-[rgba(30,26,23,.14)] pt-4">
          {!handover ? (
            showHandoverForm ? (
              <HandoverForm
                threadId={thread.id}
                onDone={() => {
                  setShowHandoverForm(false);
                  router.refresh();
                }}
              />
            ) : (
              <PillButton fullWidth={false} variant="secondary" onClick={() => setShowHandoverForm(true)}>
                propose a handover
              </PillButton>
            )
          ) : (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
                handover · {handover.state}
              </p>
              <p className="pt-2 text-[13px] text-[var(--ink)]">
                {handover.place_name}, {handover.place_suburb}
              </p>
              <p className="text-[11px] text-[var(--stone)]">
                {new Date(handover.at).toLocaleString("en-AU")}
              </p>

              {handover.state === "proposed" && handover.proposed_by !== viewerId ? (
                <div className="mt-3 flex gap-2">
                  <PillButton
                    fullWidth={false}
                    onClick={async () => {
                      await respondToHandoverAction(handover.id, thread.id, "agree");
                      setHandover({ ...handover, state: "agreed" });
                    }}
                  >
                    agree
                  </PillButton>
                  <PillButton
                    fullWidth={false}
                    variant="secondary"
                    onClick={async () => {
                      await respondToHandoverAction(handover.id, thread.id, "decline");
                      router.refresh();
                    }}
                  >
                    decline
                  </PillButton>
                </div>
              ) : null}

              {handover.state === "agreed" ? (
                <ConfirmHandoverBlock
                  handoverId={handover.id}
                  threadId={thread.id}
                  alreadyConfirmed={myConfirmed}
                  onConfirmed={() => router.refresh()}
                />
              ) : null}

              {handover.state === "completed" ? (
                <p className="pt-3 text-[12.5px] text-[var(--sage,var(--slate))]">
                  handover completed — the piece has left the seller&apos;s wardrobe
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : (
        <p className="text-[12.5px] text-[var(--stone)]">this thread is blocked</p>
      )}

      <section className="border-t border-[rgba(30,26,23,.14)] pt-4">
        <div className="flex gap-4 text-[11px] text-[var(--stone)]">
          <button
            type="button"
            className="underline"
            onClick={async () => {
              if (!confirm(`block ${counterpartName}? this closes the thread for both of you.`)) return;
              const counterpartId = iAmBuyer ? thread.seller_id : thread.buyer_id;
              await blockUserAction(counterpartId, thread.id);
              router.refresh();
            }}
          >
            block
          </button>
          <button
            type="button"
            className="underline"
            onClick={async () => {
              const reason = prompt("what's wrong with this listing?");
              if (!reason) return;
              await reportListingAction(thread.listing_id, reason);
              alert("reported — thanks for letting us know.");
            }}
          >
            report
          </button>
        </div>
      </section>
    </div>
  );
}

function HandoverForm({ threadId, onDone }: { threadId: string; onDone: () => void }) {
  const [placeName, setPlaceName] = useState("");
  const [placeSuburb, setPlaceSuburb] = useState("");
  const [at, setAt] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setIsBusy(true);
        await proposeHandoverAction(threadId, {
          placeName,
          placeSuburb,
          at: new Date(at).toISOString()
        });
        setIsBusy(false);
        onDone();
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-[11px] text-[var(--stone)]">public places only</p>
      <input
        required
        value={placeName}
        onChange={(event) => setPlaceName(event.target.value)}
        placeholder="e.g. the food court, Rundle Mall"
        className="rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
      />
      <input
        required
        value={placeSuburb}
        onChange={(event) => setPlaceSuburb(event.target.value)}
        placeholder="suburb"
        className="rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
      />
      <input
        required
        type="datetime-local"
        value={at}
        onChange={(event) => setAt(event.target.value)}
        className="rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[13px] text-[var(--ink)] outline-none"
      />
      <PillButton type="submit" fullWidth={false} disabled={isBusy}>
        {isBusy ? "sending…" : "propose"}
      </PillButton>
    </form>
  );
}

function ConfirmHandoverBlock({
  handoverId,
  threadId,
  alreadyConfirmed,
  onConfirmed
}: {
  handoverId: string;
  threadId: string;
  alreadyConfirmed: boolean;
  onConfirmed: () => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number] | "">("");
  const [isBusy, setIsBusy] = useState(false);

  if (alreadyConfirmed) {
    return <p className="pt-3 text-[12.5px] text-[var(--stone)]">waiting on the other person to confirm</p>;
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-[11px] text-[var(--stone)]">
        confirm once the handover has happened. how did payment happen? (recorded as a note only —
        Garderobe never processes it)
      </p>
      <select
        value={paymentMethod}
        onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}
        className="rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[13px] text-[var(--ink)] outline-none"
      >
        <option value="">choose one</option>
        {PAYMENT_METHODS.map((method) => (
          <option key={method} value={method}>
            {method}
          </option>
        ))}
      </select>
      <PillButton
        fullWidth={false}
        disabled={isBusy || !paymentMethod}
        onClick={async () => {
          setIsBusy(true);
          await confirmHandoverAction(handoverId, threadId, paymentMethod || undefined);
          setIsBusy(false);
          onConfirmed();
        }}
      >
        confirm handover done
      </PillButton>
    </div>
  );
}
