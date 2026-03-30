# Character Mirror — Psychology x Movie Character Analysis

> Status: Design phase
> Last updated: 2026-03-29

## Concept

Sequencing result is not just an archetype label — it becomes a **character mirror**: the system tells users which movie characters resonate with their taste DNA, and why, through a psychological lens.

Core idea: use the existing 30-dim tag vector + quadrant scores to find character-level resonance, not just genre-level preference.

---

## Why This Feature

1. **Shareability**: "Your cinematic alter ego" is inherently shareable — stronger social hook than a tag vector
2. **Depth perception**: Moves the product from "taste quiz" to "personality insight tool"
3. **Retention**: Character results give users a reason to revisit (seasonal retest = new character mapping)
4. **Fits cinephile tone**: Not "which Disney princess are you" — it's projection, identification, shadow self

---

## Design: Two Modules

### Module 1 — Character Resonance (Post-Sequencing Result)

After DNA is built, the system maps the user's profile to 3 movie characters ranked by resonance.

**Data layer:**

A new dataset `character_profiles.json` with 60-100 entries:

```json
{
  "id": "travis_bickle",
  "name": "Travis Bickle",
  "movie": "Taxi Driver",
  "tmdb_id": 103,
  "tag_vector": [0.9, 0.1, 0.7, ...],
  "quadrant_profile": {
    "mainstream_independent": 3.8,
    "rational_emotional": 2.5,
    "light_dark": 1.2
  },
  "psych_labels": ["alienation", "moral_rigidity", "savior_complex"],
  "psych_framework": "shadow_self",
  "one_liner": "The city is an open sewer and someone has to clean it up."
}
```

Field notes:
- `tag_vector`: 30-dim vector, same taxonomy as user DNA — enables direct cosine similarity
- `psych_labels`: 2-3 psychological traits, drawn from a controlled vocabulary (see below)
- `psych_framework`: which psychological lens this character best illustrates
- `one_liner`: iconic quote for visual display

**Psychological frameworks (controlled vocabulary):**

| Framework | Description | Example Characters |
|-----------|-------------|-------------------|
| shadow_self | Jungian shadow — the repressed side | Travis Bickle, Tyler Durden, Anton Chigurh |
| persona_mask | Jungian persona — the social mask | Tom Ripley, Amy Dunne, Don Draper |
| attachment_style | Bowlby attachment — how they connect | Amelie (anxious-avoidant), Joel Barish (anxious) |
| individuation | Jung individuation journey | Chiron (Moonlight), Elio (CMBYN), Antoine Doinel |
| defense_mechanism | Freudian defense — how they cope | Royal Tenenbaum (denial), Llewyn Davis (displacement) |
| existential_crisis | Existential psych — meaning-seeking | The Narrator (Fight Club), Marcello (La Dolce Vita) |
| cognitive_style | How they process the world | Sherlock Holmes (analytical), Chihiro (intuitive) |

**Matching algorithm:**

```
character_score = (
    0.5 * cosine_similarity(user.tag_vector, character.tag_vector)
  + 0.3 * quadrant_proximity(user.quadrant_scores, character.quadrant_profile)
  + 0.2 * archetype_affinity(user.archetype, character.psych_framework)
)
```

- Top 3 characters returned
- At least 2 different `psych_framework` values in top 3 (diversity constraint)
- No two characters from the same movie

**AI layer:**

After top 3 are selected, Gemini generates a 2-3 sentence "mirror reading" per character:

> "Your affinity with Amelie isn't about whimsy — it's about the distance you keep.
> You engage with the world through carefully constructed interventions,
> preferring to observe from safety before committing to connection."

Prompt constraints:
- Reference at least 1 user top_tag and 1 character psych_label
- No flattery — insight over compliment
- Mature cinephile tone, Traditional Chinese output

### Module 2 — Character Dilemma Rounds (In-Sequencing)

Insert 2-3 character-perspective dilemma questions into Phase 3 (soul tag rounds).

**Format:**

Instead of "Movie A vs Movie B", the round presents:

> Round context: a scene/situation from a film the user has already encountered
> Choice A: one character response (maps to tag dimension X)
> Choice B: another character response (maps to tag dimension Y)

**Example:**

> You're in the position of Chihiro in Spirited Away.
> Your parents have transformed. You can:
>
> A. Follow the rules of this world patiently, earning trust step by step
>    → tests: slowburn, philosophical
>
> B. Find a loophole, bend the system, get them out now
>    → tests: heist, mindfuck

**Key design decisions:**

1. Only use movies the user has already seen in sequencing (chosen or encountered) — no cold references
2. Gemini generates dilemmas dynamically based on pick history
3. Maximum 3 dilemma rounds per session (don't break the rhythm)
4. Dilemma picks contribute to tag vector with same weight as movie picks
5. New `pick_type` field: `"movie_pair"` (default) | `"character_dilemma"`

**What dilemmas measure that movie pairs don't:**

| Signal | Movie Pairs | Character Dilemmas |
|--------|------------|-------------------|
| Taste preference | Strong | Weak |
| Value system | Weak | Strong |
| Conflict response | None | Direct |
| Identification pattern | Implicit | Explicit |
| Engagement depth | Passive | Active |

---

## Data Requirements

### character_profiles.json

Target: 80 characters from the existing movie_pool + canonical films.

**Selection criteria:**
- Character must be from a well-known film (tmdb_id available)
- Character must have clear psychological dimensionality (not flat archetypes)
- Balance across: gender, culture, era, moral alignment
- Priority for characters from movies already in `movie_pool.json`

**Rough distribution:**

| Category | Count | Examples |
|----------|-------|---------|
| Asian cinema | 15-20 | Chihiro, Kaneda (Akira), Su Li-zhen (In the Mood for Love), Hsiao-kang (Rebels of the Neon God) |
| European auteur | 15-20 | Antoine Doinel, Alma (Persona), Beau Travail's Galoup, Jeanne Dielman |
| American indie/classic | 20-25 | Travis Bickle, The Dude, Llewyn Davis, Chiron, Ripley |
| Hollywood iconic | 10-15 | Ellen Ripley, Clarice Starling, Michael Corleone, T-800 |
| Animation | 8-10 | Chihiro, Ashitaka, Paprika, The Iron Giant |
| Latin/African/Middle Eastern | 5-8 | Karamakate (Embrace of the Serpent), Timbuktu characters, Taste of Cherry driver |

### Psychological trait vocabulary

A controlled set of ~30 traits to ensure consistent tagging:

**Interpersonal:** empathic, detached, manipulative, self-sacrificing, confrontational, avoidant
**Cognitive:** analytical, intuitive, obsessive, delusional, pragmatic, idealistic
**Emotional:** repressed, volatile, melancholic, resilient, numb, hypersensitive
**Existential:** nihilistic, meaning-seeking, absurdist, fatalistic, transcendent
**Identity:** fragmented, performative, authentic, rebellious, conformist

---

## Integration Points

### Backend

1. New service: `character_mirror.py`
   - `find_resonant_characters(dna_profile) -> list[CharacterMatch]`
   - `generate_mirror_reading(user_profile, characters) -> MirrorReading`

2. Extend `ai_pair_engine.py`:
   - `get_dilemma_round(session, picks) -> DilemmaPayload`
   - New Gemini prompt: `dilemma_generator.txt`

3. Extend models:
   - `Pick.pick_type`: add `"character_dilemma"` enum value
   - `DnaProfile`: add `character_mirrors` JSON field (top 3 results)

4. New Gemini prompt: `character_mirror.txt`

### Frontend

1. DNA result page: new "Character Mirror" card section
   - 3 character cards with glassmorphism style
   - Each card: character name, movie, one-liner quote, mirror reading
   - Flip animation to reveal psych framework on back

2. Sequencing flow: handle `pick_type: "character_dilemma"` rounds
   - Different visual treatment (scene-based, not poster-based)
   - Same interaction model (pick A or B, skip available)

3. Share card: extend DNA share card to include primary character mirror

---

## Execution Priority

This feature depends on stable DNA results. It should be scheduled **after roadmap Phase 2** (DNA stability).

Suggested phasing:

| Step | Scope | Dependency |
|------|-------|-----------|
| 1. Character dataset | Build `character_profiles.json` with 80 entries | None — can start now |
| 2. Resonance algorithm | `character_mirror.py` + cosine matching | Needs stable tag_vector (Phase 2) |
| 3. Mirror reading prompt | `character_mirror.txt` Gemini prompt | Needs step 2 |
| 4. Result page UI | Character mirror cards on DNA result | Needs step 3 |
| 5. Dilemma rounds | Phase 3 integration + `dilemma_generator.txt` | Needs step 2 + frontend sequencing refactor |
| 6. Share card integration | Character in DNA share card | Needs step 4 + share card feature |

Step 1 (dataset) can begin in parallel with current roadmap work.

---

## Open Questions

1. **Character count**: 80 enough? Or need 120+ for diversity?
2. **Dilemma weight**: Should dilemma picks have same weight as movie picks, or reduced (e.g., 0.7x)?
3. **Retest behavior**: On seasonal retest, do character mirrors update? Or show "evolution" comparison?
4. **Spoiler risk**: Dilemma rounds reference plot points — need spoiler-free framing?
5. **Localization**: Character names in original language or localized? (e.g., "千尋" vs "Chihiro")

---

## Risks

- **Character dataset quality**: Tag vectors for characters must be carefully curated, not auto-generated — wrong vectors = wrong mirrors
- **Psychological framing tone**: Must stay insightful, not clinical or pop-psych. Constant tone review needed
- **Scope creep**: This can easily balloon — strict "80 characters, 7 frameworks, 3 results" boundary needed at launch
