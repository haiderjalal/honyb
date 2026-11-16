import { escapeHtml, layout, type EmailContent } from "./templates";

import type { GuaranteeClaim } from "@/services/guarantee/guarantee.types";

const NEXT_STEP = "Ask the customer for a photo or video of the problem. The jar is not returned.";

/** The email the owner receives for each guarantee claim. Every customer-supplied value is escaped first. */
export function guaranteeClaimEmail(claim: GuaranteeClaim): EmailContent {
  const details: [string, string | null][] = [
    ["Order reference", claim.reference],
    ["Name", claim.name],
    ["Phone", claim.phone],
    ["Email", claim.email],
    ["What is wrong", claim.details],
  ];
  const rows = details
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#7a5a2a;vertical-align:top">${label}</td><td style="padding:4px 0">${escapeHtml(value ?? "").replace(/\n/g, "<br />")}</td></tr>`,
    )
    .join("");

  return {
    subject: `Honey guarantee claim ${claim.reference} — ${claim.name}`,
    html: layout(
      `Guarantee claim ${claim.reference}`,
      `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;margin-bottom:20px">${rows}</table>
<p style="font-size:13px;color:#7a5a2a">Submitted ${escapeHtml(claim.submittedAt)}. ${NEXT_STEP}</p>`,
    ),
    text: [
      `Honey guarantee claim ${claim.reference}`,
      "",
      ...details.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`),
      "",
      NEXT_STEP,
    ].join("\n"),
  };
}
