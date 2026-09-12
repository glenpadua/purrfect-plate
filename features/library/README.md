# Recipe library

`app/page.tsx` composes `LibraryScreen`. The feature owns browsing, filters,
favorites, recipe cards, and the existing surprise-picker interaction.

Each card exposes deletion through an accessible confirmation. The delete control
waits for the authenticated `recipes.remove` mutation, blocks repeat submissions,
and keeps failures visible for retry. The reactive library query removes the card
after success; cancelling leaves the recipe unchanged.

- `screens/library-screen.tsx` composes the page and its loading/empty states.
- `hooks/use-library.ts` owns filter state, favorite updates, and opening the picker.
- `data/use-library-data.ts` is the only Convex binding boundary in this feature.
  `useLibraryData` provides the filtered library; `useSurpriseData` provides the
  complete candidate list and cook-log mutation. Both use the authenticated client.
- `components/surprise-me-modal.tsx` owns selection, reroll timing, and accepting a
  recipe. Accepting retains the existing behavior of logging a cook before navigation.
- `components/recipe-card.tsx` renders a recipe and delegates user actions to callbacks.
- `components/library-mascots.tsx` owns decorative animation loading and timer cleanup.
- `lib/tag-tone.ts` provides the deterministic tag colors used by the screen and picker.

Keep new backend bindings in `data/`; shared UI primitives stay independent of
Convex. Prefer adding behavior at the owning feature boundary rather than growing
the route. This move preserves the current query strategy and interaction behavior;
it does not introduce pagination or change surprise selection rules.
