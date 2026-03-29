# Pricing And Entitlement Plan

> Last updated: 2026-03-29
> Scope: sequencing retest and extension monetization for launch after closed beta.

## Product Goal

Closed beta can stay flexible, but public launch needs clear rules for two actions:

- starting a fresh retest
- unlocking more sequencing rounds after completion

The launch policy should feel generous enough to encourage re-engagement, while making higher-precision or repeated use a paid action.

## Proposed Launch Rule

### 1. Initial sequencing stays free

Every user can complete their first full sequencing session for free.

This remains the core acquisition funnel and should not require payment.

### 2. One free retest after launch

Each user gets:

- `1` free retest

Meaning:

- they can start one brand-new sequencing session after already completing a prior one
- session history and prior DNA versions remain preserved
- after that free retest is used, all additional retests become paid

### 3. Every extension batch is paid

Each extension unlock should require payment.

Current system behavior:

- extension happens on the same session
- `EXTENSION_BATCH_SIZE = 3`

So the commercial unit should be:

- `1 paid extension = +3 rounds`

Do not charge per single round. The UX and billing overhead would be too fragmented.

## Commercial Unit

Use a shared entitlement model instead of hard-coding separate payment products into session logic.

Recommended unit:

- `1 sequencing credit`

How credits are consumed:

- `1 retest` = `1 credit`
- `1 extension batch (+3 rounds)` = `1 credit`

This keeps pricing flexible without forcing the backend to understand storefront-level SKU complexity.

## Recommended User Offer

At public launch:

- first sequencing session: free
- first retest: free
- every later retest: 1 credit
- every extension batch: 1 credit

Optional starter bundles:

- single credit
- three-credit bundle

That is enough for initial launch. More complex packaging can wait until there is actual usage data.

## Why This Model Fits The Current System

The current sequencing architecture already separates:

- `retest`: creates a new `SequencingSession`
- `extension`: increases rounds on the existing session

That means monetization can be inserted as authorization checks before:

- `start_retest(...)`
- `start_extension(...)`

No core sequencing redesign is required.

## Entitlement Model

Do not store all billing logic only on `users`.

Use two layers:

### Layer 1: fast user-level counters

Possible user fields:

- `free_retest_credits`
- `paid_sequencing_credits`
- `beta_override`

Recommended launch defaults:

- `free_retest_credits = 1`
- `paid_sequencing_credits = 0`
- `beta_override = false`

This makes permission checks cheap and simple.

### Layer 2: ledger for auditability

Add a ledger table such as:

- `sequencing_entitlements`

Recommended fields:

- `id`
- `user_id`
- `kind`
  - `free_retest`
  - `paid_credit`
  - `admin_grant`
  - `beta_grant`
- `quantity`
- `used_quantity`
- `source`
  - `launch_grant`
  - `purchase`
  - `admin`
  - `migration`
- `notes`
- `created_at`
- `expires_at` optional

The user-level counters are for fast reads. The ledger is for correctness, support, and reconciliation.

## Authorization Rules

### Retest

Before `start_retest(...)`, backend should check in this order:

1. `beta_override == true`
2. `free_retest_credits > 0`
3. `paid_sequencing_credits > 0`

If none are true:

- reject the action with a business error
- frontend should route the user to purchase flow

Consumption order:

1. free retest credit first
2. paid credit second

### Extension

Before `start_extension(...)`, backend should check:

1. `beta_override == true`
2. `paid_sequencing_credits > 0`

Extension should not consume the free retest credit.

This keeps the “one free redo” promise separate from “pay for more precision”.

## Beta-To-Launch Migration

When moving from closed beta to public launch:

### Existing beta users

Recommended:

- keep their existing sessions and DNA history
- grant `beta_override = true` temporarily for internal testers only
- for real external beta users, decide one of:
  - give `1` free retest on launch anyway
  - or give `2` credits as thank-you compensation

Do not silently block old testers from retesting after launch without an explicit grant. That will feel punitive.

### New public users

Default:

- `free_retest_credits = 1`
- `paid_sequencing_credits = 0`

## API / UX Implications

### Backend

Add entitlement-aware guards around:

- `POST /sequencing/extend`
- `POST /sequencing/retest`

Suggested response shape on denial:

```json
{
  "detail": "payment_required",
  "action": "retest",
  "credits_required": 1,
  "credits_available": 0
}
```

Do not rely on frontend-only hiding. Backend must enforce this.

### Frontend

Current copy implies extension is simply available.
That should become explicit about cost.

Recommended copy direction:

- `重新測試`
  - `你還有 1 次免費重新測試`
  - or `重新測試需使用 1 點額度`

- `延伸分析`
  - `解鎖 +3 輪，使用 1 點額度`
  - if user has no credit: show purchase CTA instead of direct action

### Profile / DNA History

Profile page should expose:

- free retests remaining
- paid credits remaining
- DNA history remains available regardless of payment status

This is important because users should feel they are paying for new analysis actions, not paying to access past results.

## Pricing Principles

Keep the first launch pricing simple:

1. Do not charge for the first sequencing session.
2. Give one free retest to reduce hesitation.
3. Charge power-user behavior, not curiosity.
4. Use one shared sequencing credit for both retest and extension.
5. Preserve DNA history as part of the base product.

## Recommended Implementation Order

1. Add entitlement data model and migration.
2. Add backend guards for retest and extension.
3. Add API response states for blocked actions.
4. Update frontend copy and CTA states.
5. Add payment provider integration.
6. Add admin grant tooling for support and beta exceptions.

## Open Decisions

These still need a product call before implementation:

1. Should external beta users get only the standard 1 free retest, or extra launch credits?
2. Should a paid credit have an expiration date?
3. Should retest and extension always cost the same, or can extension later be cheaper?
4. Should bundle discounts exist at launch, or only after usage data accumulates?

## Recommendation

For launch, use:

- free initial sequencing
- one free retest
- one shared paid credit model
- extension charged per batch

This is the simplest structure that matches the current system and can scale into a fuller payment layer later.
