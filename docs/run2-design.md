# Run 2 design: testing the presentation artefact, then adding communicative pressure

Status: design and runner implemented and tested against a mock learner. No real model calls have been made for run 2 yet.

## Why run 2 is not just "run 1 with new knobs"

Reading the code while writing the white paper turned up a confound in run 1. The learner's 80 training examples are rendered as `{"meaningId": "m082", "form": "chijemelo"}` and nothing else. The meaning fields appear only in the target list, in canonical enumeration order, and the IDs encode the structure (`id = ((agent*5 + action)*4 + patient)*2 + tense`). The fixed point of run 1 (form = agent + patient + tense, action ignored) is exactly a function of `id mod 8` and `floor(id / 40)`, which is what a learner reading IDs would find. Until that is excluded, run 1 cannot be read as evidence about what the model learns from meanings.

So run 2 is sequenced, with a decision gate after each phase.

## Phases

| Phase | Question | Conditions | Pressure |
|---|---|---|---|
| 1 | Was the action collapse caused by how meanings were presented? | `p1-ids` (run 1 presentation, new seeds), `p1-inline` (meaning fields on every example), `p1-inline-shuffled` (inline, shuffled targets, opaque IDs) | none |
| 2 | What happens when forms must also be distinguishable? | `p2-framing` (the learner is told a partner must decode), `p2-game` (speaker/listener game with revision) | framing, game |
| 3 | Is the outcome a property of the prompt, the position of a dimension, the semantics of the words, or the model? | `p3-action-first`, `p3-action-last`, `p3-nonsense-actions`, `p3-sonnet-none`, `p3-sonnet-game` | none or game |

Conditions are defined in `config/run2.json`. Phases 2 and 3 use `inline-shuffled` as the clean baseline. If phase 1 says otherwise, change `presentation` in the config before running them.

### Predictions, stated before running

Phase 1:
- If the ID-join artefact explains the collapse, `p1-ids` chains collapse the action dimension in most chains (at least 3 of 4), and `p1-inline-shuffled` collapses it in few (at most 1 of 5).
- If the collapse is a learner prior, action is dropped in most chains under all three presentations.
- If a different dimension collapses in different chains under the clean presentation, the choice is a symmetry-breaking event early in the chain. That is a result in itself, and it would mean the run 1 outcome was one draw from a distribution.
- If nothing collapses and chains stay near 200 forms, the bottleneck is too weak for this learner and the next step is a sweep of `sampleFraction` below 0.4.

Phase 2:
- `p2-game` should end near 200 distinct forms with high held-out listener accuracy. Whether it also keeps high topographic similarity is the open question: a held-out decoding task can only be solved by compositional structure, so game chains should be compositional and expressive together.
- `p2-framing` isolates being told from being corrected. If framing alone restores the action distinction, the effect is mostly instruction following and not emergent pressure.

Phase 3:
- If the dropped dimension follows the field order, it is a position artefact. If it follows the nonsense labels, it is semantic salience. If it does not move, it is more likely a learner prior.
- If a larger model keeps the action distinction under no pressure, then dimension-dropping is a capability limit of the smaller model and not a property of the task.

These are hypotheses with the opposite outcome recorded as a result too. Chains per condition are 3 to 5, so the report gives counts and ranges and not significance tests.

## What is new in the runner (`src/run2/`)

- **Presentation as a controlled variable** (`present.ts`): `ids` reproduces the run 1 prompt byte for byte (checked by a test against `corpus/gen-210/prompt.txt`), `inline` and `inline-shuffled` fix the mismatch between the template and what was rendered.
- **Communication game** (`chain.ts`): per generation, a speaker call produces the language from the bottlenecked sample, a listener call who saw the same sample must identify 60 meanings from their forms, then the speaker revises using the listener's actual mistakes. A second listener test on the revised language gives the communicative accuracy of what is transmitted, split into all and held-out meanings. If the listener is perfect, the revision call is skipped. This follows the shared-experience pair structure of human communication experiments (Kirby et al., 2015).
- **Paired chains**: chain `k` starts from the same seed language in every condition, so conditions are comparable chain by chain.
- **Independent seeds** for the seed language, training sample, test items and shuffles, derived by hashing (`rng.ts`), so a change to one does not move the others.
- **Metrics that run 1 lacked** (`metrics.ts`): per-dimension syncretism, per-dimension conditional entropy `H(dimension | form)`, expressivity (unique forms, oracle listener accuracy, normalised form entropy), Spearman topographic similarity, and the list of dropped dimensions. The run 1 metrics are still computed for comparability.
- **Stasis stop**: a chain stops when mean Levenshtein to the previous generation stays at or below `stasisEpsilon` for `stasisWindow` generations, or at `maxGenerations`.
- **Resume, retries, and failure records**: chains resume from the last written generation; transient API errors retry with backoff; a generation that cannot be parsed after one correction retry marks that chain failed without stopping the others.
- **Compact storage**: each generation is `language.json` (200 forms), `metrics.json` and `meta.json`. Raw responses are gzipped under `raw/` and git-ignored.

## Running it

```bash
npm run build
npm run run2 -- estimate                      # call budget, no API calls
npm run run2 -- prompt --condition p1-ids     # inspect a prompt first
npm run run2 -- run --mock --chains 1 --condition p2-game --runs /tmp/run2-smoke   # pipeline smoke test
npm run run2 -- run --phase 1                 # real run; resumable
npm run run2 -- report                        # writes runs/REPORT.md
```

Authentication is the same as run 1 (`CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`).

### Budget

`estimate` currently reports roughly 2,700 expected calls and 3,000 worst case for all three phases (phase 1 about 700, phase 2 about 800, phase 3 about 1,200). Phase 3 is the part to trim if needed: reduce `chains` or `maxGenerations` in the config. Game conditions cost 3 to 4 calls per generation, and the listener calls are cheap in output tokens because they return only item IDs.

## Limits of this design

- The mock learner exercises the pipeline only. Nothing about real model behaviour has been checked. The first real run should be a single chain of `p1-ids` to confirm that parsing, timing and output size behave.
- In the game, the listener learns from the same sample as the speaker, not from the speaker's output. That models shared conventions and forces held-out decoding to rely on structure, but it differs from a partner who learns from the speaker.
- The listener's temperature is 0 by default. Listener noise is therefore not a pressure.
- The speaker is told about the partner in both `framing` and `game`, so `game` minus `framing` isolates feedback and not instruction.
- Chains per condition are small. Treat anything short of a consistent pattern across chains as unresolved.
- Not yet covered: sweeps of bottleneck fraction and temperature, stratified or frequency-weighted sampling, larger or hierarchical meaning spaces, and cross-model transfer of a frozen language. They are listed in Section 8 of the white paper and become worthwhile once phase 1 and 2 results are in.
