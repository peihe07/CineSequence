# Theaters Curation Roadmap

> Status: planning
> Last updated: 2026-03-27

## Goal

Shift `/theaters` from a passive group directory into the main shared curation surface after DNA completion.

Core product framing:

- DNA answers "who am I?"
- Theaters answer "what should we watch together?"
- Conversation should attach to lists and movies, not exist as an empty standalone chat room

## Product Decisions

- Theaters remain the primary home for shared watch intent
- System-generated lists stay as the cold-start layer
- User-created lists become the main social interaction layer
- General chat is deferred; list-scoped replies come first
- DNA completion should become the main entry into theaters

## Experience Structure

### DNA Result Page

Keep:

- archetype
- radar + tag cloud
- AI reading

Add:

- clear theater assignment CTA
- short explanation that DNA unlocks theater-based curation

Do not add:

- a separate full personal watchlist page in the first iteration

### Theaters Index

Reprioritize content in this order:

1. `Why This Hall`
2. `Hall Picks`
3. `Shared Watchlist`
4. `User-Curated Lists`
5. `Recent Activity`
6. member preview
7. low-priority messaging surface

### Theater Detail

Focus on:

- system lists
- user-created lists
- list detail and movie detail
- list-scoped replies

Leave current freeform message board as secondary or transitional UI.

## Delivery Phases

### Phase A: Activation Path

Objective: make theaters part of the actual DNA flow.

- [x] Auto-assign theaters immediately after DNA build succeeds
- [x] Add DNA result CTA that routes users into `/theaters`
- [x] Adjust theater copy so the page reads like a next step, not an optional side feature
- [x] Verify no theater rules are changed beyond assignment timing

Definition of done:

- DNA completion reliably leads to visible theater membership when eligible
- Theater entry feels like a continuation of the main flow

### Phase B: Theater Information Architecture

Objective: turn theaters into a curation-first surface.

- [x] Reorder `/theaters` so system picks and shared watchlist come before membership chrome
- [x] Add a dedicated `Why This Hall` block using existing `shared_tags`
- [x] Promote `recommended_movies` into `Hall Picks`
- [x] Promote `shared_watchlist` into a first-class section with clearer framing
- [x] Reduce emphasis on generic join/leave card controls in the default reading path

Definition of done:

- The page explains why the user is here and what to watch next within one screenful

### Phase C: User-Curated Lists MVP

Objective: let members create actual curation artifacts inside a theater.

- [x] Add backend model for theater user lists
- [x] Add backend model for theater list items
- [~] Add create/read/update/delete APIs for lists owned by theater members
- [x] Add create/remove/reorder APIs for list items
- [x] Add frontend list creation UI inside theater detail
- [x] Add frontend list detail view with movie entries and creator attribution
- [x] Support seeding new lists with initial movie titles in the quick-create flow
- [x] Add frontend item append/remove controls inside theater detail
- [x] Add frontend item reorder controls inside theater detail
- [x] Add frontend item note editing inside theater detail
- [x] Add frontend list metadata editing inside theater detail
- [x] Add frontend list delete flow inside theater detail
- [x] Reduce always-on list edit density with explicit edit mode
- [x] Define simple visibility rules for lists inside the current theater

Definition of done:

- A theater member can create a named list, add movies, and others in the theater can view it

### Phase D: Replies Attached To Lists

Objective: make conversation contextual instead of empty-room chat.

- [x] Add backend model for list replies
- [x] Add create/list/delete APIs for replies
- [x] Render replies below each user-created list
- [x] Allow theater members to respond to a list without entering a separate chat page
- [ ] Keep reply model flat; defer threaded replies

Definition of done:

- Every meaningful conversation can happen under a list with clear context

### Phase E: Activity + Signals

Objective: make theaters feel alive without building a full real-time system yet.

- [x] Add recent theater activity feed entries for list creation and replies
- [x] Add lightweight in-app notifications for theater assignment and new list activity
- [x] Decide whether the legacy theater message board should remain, be minimized, or be removed

Definition of done:

- Theaters show visible motion even before real-time transport exists

## Suggested Data Model

### `theater_lists`

- `id`
- `group_id`
- `creator_id`
- `title`
- `description`
- `visibility`
- `created_at`
- `updated_at`

### `theater_list_items`

- `id`
- `list_id`
- `tmdb_id`
- `title_en`
- `title_zh` or resolved display title
- `note`
- `position`
- `added_by`
- `created_at`

### `theater_list_replies`

- `id`
- `list_id`
- `user_id`
- `body`
- `created_at`

## Current Reusable Inputs

Already available today:

- `shared_tags`
- `recommended_movies`
- `shared_watchlist`
- `member_preview`
- `recent_messages`
- group membership and DNA-based auto-assignment infrastructure

Implication:

- Phase A and most of Phase B should require little or no backend schema change
- New backend schema should begin in Phase C

## Risks

- If user-created lists ship before enough theater traffic exists, interaction may still feel sparse
- A separate generic chat surface will likely dilute list-based interaction if both are emphasized equally

## Progress Log

- [x] Product direction chosen: theaters become the shared curation hub
- [x] Scope constraint confirmed: existing theater rules are not being changed yet
- [x] Phase A started
- [x] Phase A completed
- [x] Phase B started
- [x] Phase C started
- [x] Phase C item add/remove flow landed on theater detail
- [x] Phase D started
- [x] Phase E started
- [x] Post-MVP issue cleanup started from `theaters-issues.md`
- [x] Post-MVP fixes: additive auto-assign, direct group visibility lookup, list item delete ownership
- [x] Post-MVP fixes: detail mutation counter, stale error clearing, groupStore auto-assign reuse, group message trim
- [x] Post-MVP fixes: schema-level validation for theater message/list/reply payloads
- [x] Post-MVP fixes: theater detail mutation guards now short-circuit when `groupId` is missing
- [x] Post-MVP fixes: `/groups` theater payloads now use batched list assembly instead of per-group N+1 queries
- [x] Post-MVP fixes: shared frontend theater types consolidated into one source of truth
- [x] Post-MVP fixes: theater detail routing migrated to `/theaters/[id]` with legacy query-param compatibility
- [x] Post-MVP fixes: theater activation thresholds lowered to `3` across defaults, seed data, and migration path
- [x] Post-MVP improvements: theater list items now support poster/title/genre/runtime metadata in model, API, and detail rendering
