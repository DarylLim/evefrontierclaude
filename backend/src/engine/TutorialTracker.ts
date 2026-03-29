import { PlayerContext } from '../types';

/**
 * Starter shell types – these are the default hulls a new player receives.
 * Any shell type NOT in this set is considered an upgraded/crafted hull.
 */
const STARTER_SHELL_TYPES = new Set([
  'Rugged',
  'Reaping',
  'Aggressive',
]);

/**
 * Minimum number of unique cargo item types that signals the player has
 * refined resources (proxy for "inventory contains Refined Water Ice" since
 * exact typeIds are not hard-coded).
 */
const REFINED_CARGO_UNIQUE_THRESHOLD = 4;

/**
 * Evaluates the current PlayerContext and returns the highest tutorial stage
 * the player has reached.  The function is stateless – it only inspects the
 * snapshot supplied to it.
 *
 * | Stage | Signal                                                       |
 * |-------|--------------------------------------------------------------|
 * |   0   | No character yet (wallet connected but no profile)           |
 * |   1   | PlayerProfile exists (characterId is non-empty)              |
 * |   2   | Cargo contains refined items (>= 4 unique typeIds)           |
 * |   3   | Player has been involved in combat (lastCombatEventAt set)   |
 * |   4   | Player has deployed/manufactured assemblies                  |
 * |   5   | Shell is a non-starter type (e.g. Reflex)                    |
 * |   6   | Player has used a gate jump (hasJumped flag)                 |
 */
export function determineTutorialStage(ctx: PlayerContext): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  // Stage 6: Player has jumped through a gate (left starter system)
  if (ctx.hasJumped) return 6;

  // Stage 5: Shell upgraded beyond starter type
  if (
    ctx.shellType !== null &&
    !STARTER_SHELL_TYPES.has(ctx.shellType)
  ) {
    return 5;
  }

  // Stage 4: Has manufactured / deployed assemblies
  if (ctx.activeAssemblies.length > 0) return 4;

  // Stage 3: Has been in combat
  if (ctx.lastCombatEventAt !== null) return 3;

  // Stage 2: Cargo contains refined items (proxy: >= REFINED_CARGO_UNIQUE_THRESHOLD unique types)
  const uniqueTypeIds = new Set(ctx.cargoItems.map((c) => c.typeId));
  if (uniqueTypeIds.size >= REFINED_CARGO_UNIQUE_THRESHOLD) return 2;

  // Stage 1: Character profile exists
  if (ctx.characterId !== '') return 1;

  // Stage 0: Nothing yet
  return 0;
}
