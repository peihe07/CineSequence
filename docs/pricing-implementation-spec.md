# Pricing Implementation Spec

> Last updated: 2026-03-29
> Scope: implement paid retests and paid sequencing extensions on top of the current session model.

## Goal

Turn the pricing rules from [pricing-and-entitlement.md](/Users/peihe/Personal_Projects/movie-dna/docs/pricing-and-entitlement.md) into an implementation-ready spec.

This spec assumes:

- first sequencing session stays free
- each user gets one free retest
- every later retest is paid
- every extension batch is paid
- retest and extension both consume one shared sequencing credit

## Existing System Fit

Current sequencing flow already has the right separation:

- `start_retest(...)` creates a new `SequencingSession`
- `start_extension(...)` modifies the current session and increases `total_rounds`

This means monetization should be added as an entitlement gate before those actions.

Do not redesign sequencing itself.

## New Data Model

### 1. User Fields

Add lightweight counters to `users`.

Recommended fields:

- `free_retest_credits: int = 1`
- `paid_sequencing_credits: int = 0`
- `beta_override: bool = false`

Purpose:

- fast reads for profile UI
- simple authorization checks in sequencing endpoints

### 2. Entitlement Ledger Table

Add a new table:

- `sequencing_entitlements`

Recommended columns:

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
- `updated_at`
- `expires_at` optional

Purpose:

- support audit
- support refunds or manual grants
- avoid losing history when counters change

### 3. Optional Purchase Table

If payment integration arrives later, keep purchase records separate.

Recommended table:

- `sequencing_purchases`

Suggested fields:

- `id`
- `user_id`
- `provider`
- `provider_session_id`
- `provider_payment_intent_id`
- `product_code`
- `credits_granted`
- `amount`
- `currency`
- `status`
- `created_at`

This table is not required to implement entitlements first.

## Migration Plan

### Migration 1: user counters

Add to `users`:

- `free_retest_credits`
- `paid_sequencing_credits`
- `beta_override`

Defaults:

- `free_retest_credits = 1`
- `paid_sequencing_credits = 0`
- `beta_override = false`

### Migration 2: entitlement ledger

Create `sequencing_entitlements`.

Backfill strategy:

- for every existing user, insert one `free_retest` grant with source `launch_grant`
- for internal testers, optionally set `beta_override = true` or create `beta_grant` rows

Do not infer consumed credits from old sessions during the first rollout unless you explicitly want to charge retroactively. For launch, use forward-looking enforcement only.

## Backend Service Layer

Add a dedicated service, for example:

- `backend/app/services/sequencing_entitlements.py`

Recommended functions:

- `get_entitlement_snapshot(db, user_id) -> EntitlementSnapshot`
- `can_start_retest(db, user) -> RetestGateResult`
- `can_start_extension(db, user) -> ExtensionGateResult`
- `consume_retest_credit(db, user) -> ConsumptionResult`
- `consume_extension_credit(db, user) -> ConsumptionResult`
- `grant_paid_credits(db, user_id, quantity, source, notes)`

Recommended return fields for gate result:

- `allowed`
- `reason`
- `free_retests_remaining`
- `paid_credits_remaining`
- `credits_required`

## Enforcement Points

### 1. Retest endpoint

Current endpoint:

- `POST /sequencing/retest`

Before calling `start_retest(...)`:

1. allow if `beta_override == true`
2. else allow if `free_retest_credits > 0`
3. else allow if `paid_sequencing_credits > 0`
4. else reject

Consumption order:

1. free retest credit
2. paid sequencing credit

Suggested denial response:

```json
{
  "detail": "payment_required",
  "action": "retest",
  "credits_required": 1,
  "free_retests_remaining": 0,
  "paid_credits_remaining": 0
}
```

### 2. Extend endpoint

Current endpoint:

- `POST /sequencing/extend`

Before calling `start_extension(...)`:

1. allow if `beta_override == true`
2. else allow if `paid_sequencing_credits > 0`
3. else reject

Extension should never consume the free retest credit.

Suggested denial response:

```json
{
  "detail": "payment_required",
  "action": "extend",
  "credits_required": 1,
  "paid_credits_remaining": 0
}
```

## API Schema Changes

### Progress / profile-level visibility

Users need to see entitlement state before pressing CTAs.

Recommended additions:

- `ProgressResponse`
  - `paid_sequencing_credits: int`
  - `free_retest_credits: int`
  - `extension_credit_required: int = 1`

- `RetestResponse`
  - `credits_remaining: int`
  - `free_retests_remaining: int`

- `ExtendResponse`
  - `credits_remaining: int`

### Dedicated entitlement endpoint

Optional but recommended:

- `GET /sequencing/entitlements`

Response:

```json
{
  "free_retest_credits": 1,
  "paid_sequencing_credits": 0,
  "beta_override": false,
  "can_retest_for_free": true,
  "can_extend_now": false
}
```

This keeps profile and completion pages simple.

## Frontend Surface Changes

### 1. Sequencing complete page

Current strings imply extension is freely available.

Update the complete page to:

- show credit cost next to extend CTA
- disable or redirect CTA when credit is missing
- distinguish between:
  - can extend now
  - extension locked pending purchase

Targets:

- `frontend/app/(main)/sequencing/complete/page.tsx`
- `frontend/stores/sequencingStore.ts`
- `frontend/lib/i18n.tsx`

### 2. DNA page

The DNA page currently also exposes extension.

Update it to:

- show `+3 rounds / 1 credit`
- reflect lock state from backend

Targets:

- `frontend/app/(main)/dna/page.tsx`

### 3. Profile page

Profile should show:

- free retests remaining
- paid sequencing credits remaining
- retest CTA state

Targets likely include profile page components and i18n labels.

## Copy Changes

Current copy still says:

- `延伸分析（+5 輪）`
- `追加 5 輪可提升分析精度`

This no longer matches the current backend, where:

- `EXTENSION_BATCH_SIZE = 3`

Update copy to reflect both the real round count and the pricing rule.

Recommended direction:

- `延伸分析（+3 輪）`
- `解鎖額外 3 輪，需使用 1 點額度`
- `你還有 1 次免費重新測試`
- `重新測試需使用 1 點額度`

## Admin / Support Requirements

Before public launch, add minimal grant tooling.

At minimum support:

- manual credit grant by user id
- enable or disable `beta_override`
- read current entitlement balances

This can start as a CLI or admin-only script before a dashboard exists.

## Rollout Sequence

### Phase A: internal entitlement scaffolding

- add fields and tables
- add service layer
- no user-facing payment yet
- use admin grants only

### Phase B: UI exposure

- show balances
- show locked paid actions
- keep admin override for closed testing

### Phase C: payment provider integration

- checkout session
- purchase confirmation
- ledger insert + credit grant

### Phase D: launch policy activation

- apply entitlement enforcement to all non-beta users
- preserve tester exceptions explicitly

## Test Plan

### Backend unit tests

Add tests for:

- user with free retest can retest without paid credits
- user with no free retest but one paid credit can retest
- user with no credits cannot retest
- user with one paid credit can extend once
- extension does not consume free retest credit
- beta override bypasses both restrictions

### Router tests

Update sequencing router tests for:

- success and denial on `/sequencing/extend`
- success and denial on `/sequencing/retest`
- response payload includes entitlement state where added

### Frontend tests

Add or update tests for:

- paid lock state on extend CTA
- free vs paid retest copy
- disabled CTA behavior when credits are missing

## Open Technical Decisions

1. Should counters on `users` be the source of truth, or only a cache of the ledger?
   Recommendation: ledger is source of truth, counters are fast-access mirrors.

2. Should denied monetized actions return `402 Payment Required` or `403 Forbidden`?
   Recommendation: use `403` with a stable business error payload unless you already use `402` conventions elsewhere.

3. Should retest consume a paid credit automatically if free retest is gone?
   Recommendation: yes, but only after explicit user action on a paid CTA.

## Recommended Immediate Next Step

Implement Phase A only:

1. migration for user counters
2. entitlement ledger model
3. backend service + tests
4. no payment provider yet

That gives you a safe foundation before touching checkout.
