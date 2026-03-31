# Pricing Workstream

> Last updated: 2026-03-31
> Scope: sequencing retest and extension monetization, without payment-provider execution until platform approval is in place.

## Product Rule

### Launch Offer

- first sequencing session: free
- first retest: free
- later retests: paid
- every extension batch: paid

### Commercial Unit

Use one shared unit:

- `1 sequencing credit`

Consumption:

- `1 retest` = `1 credit`
- `1 extension batch (+3 rounds)` = `1 credit`

## Backend Improvements

### Next Backend Steps

- [ ] Run the pricing/entitlement test path against a working local test database.
  Reason: full backend verification is still blocked by missing local test DB setup.

- [ ] Decide whether to keep a dedicated entitlement snapshot endpoint.
  Candidate:
  - `GET /sequencing/entitlements`

- [ ] Add explicit grant helpers for admin/manual credit issuance.
  Reason: support and beta handling should not require direct database edits.

- [ ] Add purchase-side credit grant integration only after sponsor/payment approval is available.

## Frontend Improvements

### Near-Term

- [ ] Reflect entitlement state clearly on sequencing-complete and DNA-result surfaces.
  Needed UI states:
  - free retest still available
  - paid credit available
  - no credit available

- [ ] Make retest and extend CTA copy explicit about cost.
  Current intent:
  - retest should explain whether the free retry is still available
  - extend should say `+3 rounds` and mention credit usage

- [ ] Add a blocked-action UI path for users with no remaining entitlement.
  Reason: backend already knows how to deny; frontend now needs a clean post-denial experience.

### Deferred Until Approval

- [ ] Sponsor/payment entry surface
- [ ] payment success callback handling
- [ ] purchase history or receipt UI

## Product And Rollout Follow-Ups

- [ ] Decide how beta users convert into launch users.
  Options already discussed:
  - keep one free retest for everyone
  - or issue extra credits to selected early testers

- [ ] Decide whether retest and extension should stay under one shared credit forever, or split later.
  Current recommendation: keep one shared unit until usage data proves otherwise.

- [ ] Decide whether to sell:
  - single credit
  - three-credit bundle
  - nothing more at launch

## Priority Order

1. Keep pricing rules fixed and simple.
2. Finish backend verification once local DB support is available.
3. Add frontend entitlement states and blocked-action handling.
4. Only then connect sponsor/payment approval flows.

## Reference Docs

- `docs/archive/pricing-and-entitlement.md`
- `docs/archive/pricing-implementation-spec.md`
