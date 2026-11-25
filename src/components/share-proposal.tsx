"use client";

import { ArrowUpRight, Copy, MessageCircle } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { PickupProposal } from "../domain/share";
import type { Messages } from "../i18n/messages";

type Props = { proposal: PickupProposal; text: Messages["share"] };
type CopyStatus = "idle" | "pending" | "copied" | "select";

export function ShareProposal({ proposal, text }: Props) {
  const previewId = useId();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const preview = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<CopyStatus>("idle");

  async function copyMessage() {
    const field = preview.current;
    if (!field) return;
    setStatus("pending");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(proposal.message);
        if (preview.current === field) setStatus("copied");
        return;
      }
    } catch {
      // The preview stays selectable when clipboard permission is unavailable.
    }
    if (preview.current === field) {
      if (disclosure.current?.open) {
        field.focus();
        field.select();
      }
      setStatus("select");
    }
  }

  return (
    <details className="share-proposal" ref={disclosure}>
      <summary>
        <MessageCircle size={17} aria-hidden /> {text.title}
      </summary>
      <div className="share-body">
        <label htmlFor={previewId}>{text.preview}</label>
        <textarea
          id={previewId}
          ref={preview}
          value={proposal.message}
          readOnly
          rows={6}
        />
        <p className="subtle">{text.handoffNote}</p>
        <div className="share-actions">
          <a
            className="button primary"
            href={proposal.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {text.open} <ArrowUpRight size={16} aria-hidden />
          </a>
          <button
            className="button secondary"
            type="button"
            disabled={status === "pending"}
            onClick={() => {
              void copyMessage();
            }}
          >
            <Copy size={16} aria-hidden /> {text.copy}
          </button>
        </div>
        <p role="status" aria-live="polite" className="share-status">
          {status === "copied"
            ? text.copied
            : status === "select"
              ? text.manualCopy
              : ""}
        </p>
      </div>
    </details>
  );
}
