# Theaters Improvement Plan

> Last updated: 2026-03-30
> Scope: keep all active theaters follow-up work in one place, grouped by backend, frontend, and product experience.

## Purpose

This file replaces the older split between issue audit and separate theater-only UI notes.

Use it for:

- open engineering follow-ups in the theaters system
- frontend/UI improvements that are specific to theaters
- product or UX questions that still need decisions

Do not use this file for site-wide styling work. Keep that in the broader UI/design documents.

## Current State

Already completed:

- auto-assign no longer wipes existing memberships
- `/groups` payload assembly is batched instead of per-group fan-out
- `get_group` no longer loads all groups
- theater detail uses a dynamic route
- list CRUD, item CRUD, reorder, notes, replies, and activity feed are in place
- list item metadata now includes `title_zh`, `poster_url`, `genres`, and `runtime_minutes`
- theater detail already renders movie-card style list items instead of plain text only

Still open:

- movie search / TMDB-assisted list building is missing
- real-time updates are missing
- a few backend query/loading details still need cleanup
- the theater writing surface still needs a clearer product shape

## Backend Improvements

### High Priority

- [ ] Add movie search and metadata enrichment support to theater list creation and append flows.
  Reason: the backend already stores movie metadata well, but the authoring flow still depends on manual title entry too often.

- [ ] Revisit `TheaterListItem` relationship loading to remove circular eager-loading and unnecessary sibling fetches.
  Reason: `theater_list.py` still risks extra load by pulling parent + sibling item state when item-level work should stay narrow.

- [ ] Clean up `_recent_messages` query shape so ordering is handled in SQL instead of `desc + Python reversed`.
  Reason: current behavior works, but the query path is harder to reason about than it needs to be.

### Medium Priority

- [ ] Decide whether theaters need polling, WebSocket, or explicit refresh-only behavior.
  Reason: right now comments, replies, and list changes do not update live.

- [ ] Recheck all theater detail mutation paths for missing early guard behavior when `groupId` is absent.
  Reason: initial malformed fetches were fixed, but this should remain a hard invariant across all callbacks.

### Completed Backend Work

- [x] Additive auto-assign behavior
- [x] Batched `/groups` payload assembly
- [x] Single-group visibility lookup for detail
- [x] Ownership validation for list item deletion
- [x] Request schema length limits
- [x] Item reorder endpoint
- [x] Lower activation threshold

## Frontend Improvements

### High Priority

- [ ] Build movie search into theater list authoring.
  Target:
  - list creation
  - append item flow
  - optional TMDB result selection with auto-filled metadata

- [ ] Improve theater detail composition so list authoring does not dominate the reading experience.
  Suggested direction:
  - move create/add flows into modal or slide-over surfaces
  - keep the page itself focused on reading, browsing, and lightweight interaction

- [ ] Make recommended/watchlist sections feel more like a cinematic browsing surface than a vertical utility list.
  Suggested direction:
  - horizontal carousels
  - better poster emphasis
  - clearer resonance/support signals

### Medium Priority

- [ ] Review `joinGroup` / `leaveGroup` callback stability and avoid avoidable rerenders.

- [ ] Tighten theater visual hierarchy.
  Suggested direction:
  - larger minimum type scale
  - less flat black background treatment
  - clearer card elevation
  - more legible muted text

- [ ] Reassess how much metadata is always visible on list cards versus revealed on interaction.
  Reason: current detail cards are functional, but still dense.

### Completed Frontend Work

- [x] Dynamic theater detail route
- [x] Counter-based mutation tracking
- [x] Shared theater type definitions
- [x] Trim before posting messages
- [x] Use auto-assign response directly instead of immediate refetch
- [x] Render richer list item metadata in theater detail
- [x] Phase 3 scan-cost reduction pass (2026-03-30): tabbed library detail panels, overview shelf tabs + carousel controls, collapsible list detail, collapsible replies, summary chips

## Product And UX Follow-Ups

### Open Questions

- [ ] What is the primary writing surface in a theater?
  Current tension:
  - list-scoped replies now exist
  - broader room/message-board behavior also exists
  - the distinction is still not fully intuitive

- [ ] Should theaters optimize for curation, conversation, or both equally?
  Reason: this affects how prominent lists, replies, and room-level messages should be in the layout.

- [ ] What should “recommended” mean inside a theater?
  Options that need alignment:
  - highest overlap across members
  - curator-picked
  - newest additions
  - strongest DNA fit for the current viewer

### Near-Term Product Follow-Up

- [ ] Clarify the theater information architecture in the UI:
  - overview
  - curated lists
  - discussion / activity

- [ ] Decide whether list-scoped replies should eventually replace part of the general message-board behavior.

## Priority Order

1. Add movie search + metadata enrichment to theater list authoring.
2. Clean up backend loading/query hotspots that affect theaters at scale.
3. Clarify the theater writing model and information architecture.
4. Polish the theater browsing surface after the interaction model is clearer.

## Related Files

- `backend/app/routers/groups.py`
- `backend/app/models/theater_list.py`
- `backend/app/services/theater_list_items.py`
- `frontend/app/(main)/theaters/[id]/page.tsx`
- `frontend/app/(main)/theaters/detail/useTheaterDetail.ts`
- `frontend/app/(main)/theaters/detail/page.module.css`
