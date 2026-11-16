# Honey guarantee

The promise: if anything is wrong with the honey, the customer gets a full refund of everything they paid, delivery
included. The claim must be made within 30 days of delivery, with a photo or video of the problem. We do not ask for
the jar to be returned.

The wording is in one place, so the site and the claim form always agree:

- Window and claim length: `src/constants/guarantee.ts` (`HONEY_GUARANTEE.claimWindowDays`).
- Public page: `/guarantee`. Claim form: `/guarantee/claim`.
- Product pages and checkout show a one-line note that links to the page.

## How a claim arrives

1. The customer fills in the claim form. The server checks every field, and a bot that fills the hidden field is
   answered as if the claim were sent, with nothing sent.
2. The claim is emailed to the owner address (`INQUIRY_TO_EMAIL`), using the same mail setup as orders. Replies go to
   the customer's email when they gave one.
3. The owner asks the customer for a photo or video on WhatsApp or email, checks the order date against the 30-day
   window, and decides the claim.
4. The owner agrees the refund method with the customer and refunds the full amount paid, including delivery. Refunds
   are made outside the site.

## What is not built yet

- Claims are not stored in the database or shown in the admin area. They live in the owner's inbox.
- Delivery dates are not recorded, so the 30 days are counted from the order date in the owner's check.
- The refund method is agreed per claim.
- How a membership discount is handled on a refunded honey order is not decided.

## Checkout tick box

Customers can tick "Show my first name on the Honey Hive honeycomb" at checkout. It is off by default. A ticked order
is shown on the honeycomb straight away, and the time of agreement is saved in `honeycomb_consent_at`. Apply
`supabase/migrations/20261117120000_honeycomb_consent.sql` before relying on this. Until it is applied, a ticked order is
saved but not shown on the honeycomb, and no agreement time is recorded.
