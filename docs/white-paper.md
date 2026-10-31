# Convergence to a Degenerate Fixed Point in Iterated LLM Language Learning

**Traditio experiment, run 1 (generations 0 to 210)**

Status: internal technical report. Findings are from a single chain, a single model and a single seed, and should be read as a pilot.

---

## Abstract

Traditio is an iterated learning experiment in which a stateless LLM learner (Claude Haiku 4.5, temperature 1.0) observes a 40% sample of form-meaning pairs from the previous generation's language and produces forms for all 200 meanings. Over 210 generations, a random holistic seed language converged to a fully regular, concatenative code in which every form is predictable from the others. That code is reproduced exactly from generation 44 onwards, so the last 166 generations carry no information beyond that point.

The fixed point is not a complete compositional language. It encodes agent, patient and tense but discards the action dimension entirely, mapping 200 meanings onto 40 distinct forms. Existing metrics (compositionality, fidelity, compressibility) all read the end state as "highly structured", and none of them penalise the loss of expressivity. This is the expected behaviour of an iterated learning chain that has a pressure for learnability and no pressure for expressivity. We report the dynamics, state what the run does and does not show, and propose a set of extensions, centred on introducing a communicative pressure, that would let the experiment produce results beyond the confirmation of a known effect.

## 1. Background

In iterated learning models (Kirby, Smith, Brighton and colleagues), a language is transmitted through a chain of learners, each of whom sees only a sample of the previous learner's output. A finite sample forces generalisation, which favours compressible, compositional languages. The same pressure also favours degenerate languages in which meanings are merged, because a language with fewer distinctions is easier to learn. Kirby, Tamariz, Cornish and Smith (2015) showed that expressive, compositional structure appears only when a pressure for communicative distinctness is added to the pressure for learnability. Griffiths and Kalish (2007) showed that, for Bayesian learners, the stationary distribution of such a chain is the learners' prior, so the endpoint of a chain is information about the learner and not about the initial language. Recent work has applied iterated learning to LLMs and reported bias amplification (Ren et al., 2024).

(References are cited from memory and should be checked before this document is circulated outside the project.)

Traditio asks what structure an LLM learner induces, and how fast, when placed in this loop.

## 2. Method

### 2.1 Meaning space

200 meanings, exhaustively enumerated: 5 agents (wolf, bird, child, stone, river) x 5 actions (sees, chases, eats, fears, finds) x 4 patients (any agent except the agent) x 2 tenses (past, nonpast).

### 2.2 Transmission

- Generation 0 is a seeded random holistic language: 2 to 4 CV syllables per meaning, with no relation between form and meaning.
- At generation N, a fresh learner receives 80 pairs (`sampleFraction` 0.4, resampled each generation with seed `config.seed + N`), shows only the meaning-form examples, and is asked to express all 200 meanings. It is told only that the language is "not related to any human language".
- There is no memory across generations, no feedback and no communicative task. Invalid output is retried once with a correction note, then the run aborts.
- Configuration: `claude-haiku-4-5-20251001`, temperature 1.0, max 8000 output tokens, seed 42.

### 2.3 Metrics

Transmission fidelity (normalised Levenshtein between consecutive generations, plus exact-match rate), compositionality (Pearson correlation between Hamming distance over meaning dimensions and normalised Levenshtein distance over forms), compressibility (gzip ratio), and lexicon statistics (unique forms, mean length, character bigram entropy).

For this report we added one analysis, `analysis/syncretism.mjs`: for each dimension, the fraction of meaning pairs that differ only in that dimension and nonetheless share an identical form. This measures which distinctions the language has stopped making, which the standard metrics cannot see.

## 3. Results

### 3.1 Trajectory

| Gen | Compositionality (r) | Fidelity (mean Lev.) | Compression ratio | Unique forms | Action syncretism |
|----:|---:|---:|---:|---:|---:|
| 0 | n/a | n/a | n/a | 199 | 0.00 |
| 1 | 0.26 | 0.52 | 0.46 | 197 | 0.01 |
| 10 | 0.57 | 0.15 | 0.32 | 176 | 0.02 |
| 20 | 0.63 | 0.03 | 0.19 | 118 | 0.28 |
| 25 | 0.67 | 0.05 | 0.13 | 80 | 0.52 |
| 30 | 0.70 | 0.02 | 0.12 | 80 | 0.62 |
| 40 | 0.77 | 0.005 | 0.10 | 56 | 0.84 |
| 44 | 0.825 | 0 | 0.076 | 40 | 1.00 |
| 210 | 0.825 | 0 | 0.076 | 40 | 1.00 |

Three phases are visible:

1. **Generations 1 to 15, regularisation.** Fidelity improves steeply (0.52 to about 0.1) and compositionality rises, but the lexicon stays near 200 distinct forms. The learner is building structure but is still preserving distinctions.
2. **Generations 15 to 44, collapse.** Distinct forms fall from about 160 to 40. The decline in unique forms is almost entirely accounted for by action syncretism (0.09 at gen 15, 0.52 at gen 25, 1.00 by gen 45). Agent, patient and tense syncretism stay near zero throughout.
3. **Generations 44 to 210, stasis.** The language file is byte-identical from generation 44 to 210, apart from isolated deviations: generations 117 to 118, 152 to 153, 167 to 171 and 190 to 191 show mean Levenshtein of at most 0.0076, and each reverted within one or two generations.

### 3.2 The fixed-point language

Form = agent syllable + patient syllable + `-melo` (past) or `-melen` (nonpast).

| Role | wolf | bird | child | stone | river |
|---|---|---|---|---|---|
| Agent (first syllable) | `wa` | `bo` | `chi` | `si` | `ru` |
| Patient (second syllable) | `de` | `je` | `me` | `se` | `le` |

Example: `wajemelo` means wolf-{sees, chases, eats, fears, finds}-bird-past, and `wajemelen` is the same set in the nonpast. There is no marker for the action, so each of the 40 forms covers five meanings.

### 3.3 Observations

- The fixed point is exact and stable at temperature 1.0 with a different random 40% sample each generation. Once every form is derivable from a small set of rules, any 80-pair sample contains enough evidence to reconstruct all 40 forms, so sampling noise has nothing to disrupt.
- The reported compositionality (r = 0.825) is a ceiling of this particular degenerate code, not evidence of a complete compositional system. The metric is computed over meaning pairs and rewards form distance tracking semantic distance; it is indifferent to whether some semantic distances map to zero form distance.
- The 40-form code is exactly the 200-meaning space with one axis projected out. The learner chose which axis to drop, and the choice is the most interesting single fact in the data.

## 4. Interpretation

What the run supports:

- A finite bottleneck is sufficient to drive an LLM learner from holistic to compositional-looking structure within roughly 40 generations.
- Without a pressure to preserve distinctions, the chain converges to a lossy code. This reproduces the known result for iterated learning without communicative pressure.
- The learner is a consistent regularity extractor. Given structured input it reproduces it exactly even at temperature 1.0.

What it does not support:

- That Haiku has any particular preference for dropping actions. One chain cannot separate a model prior from a chance event early in the run.
- That the 40-form language is a general attractor for LLM learners. We have not tested another model, seed, bottleneck or meaning space.
- Why action collapsed. Candidate explanations that this run cannot discriminate between: (a) action is the middle field in the prompt's JSON ordering and in the learner's output; (b) agent and patient share a vocabulary and so reinforce each other as reusable nouns; (c) the five action words are semantically less salient to the learner than the role-bearing entities; (d) the binary tense and the five-valued agent and patient are easier to mark than a five-valued action sandwiched between them; (e) early random drift in generations 15 to 25 favoured action-merging and positive feedback locked it in. These are hypotheses.

Known weaknesses of the current design:

1. **No expressivity pressure.** The learner is never asked to be understood, so merging meanings is free.
2. **Single chain.** n = 1 for every claim above.
3. **Blind metrics.** None of the existing metrics detects syncretism. A language that stopped distinguishing actions improved on every metric.
4. **No stopping rule.** About 166 generations were spent reproducing an identical language.
5. **Small, uniform meaning space.** All meanings are equally frequent, and the dimensions are few and low-cardinality. This limits what structure can emerge and what can be learned about learner biases.

## 5. Should the meaning space be larger than 200?

Yes, but size is not the main reason, and a bigger space in the current design would mostly reproduce the same result more slowly and more expensively. The reasons to change it are specific.

**What a larger or richer space buys:**

- **More dimensions, with varied cardinality.** With four dimensions and cardinalities 5, 5, 4 and 2 we cannot tell whether the dropped dimension was chosen by position, cardinality, semantics or chance. A space with, for example, six or seven dimensions of cardinalities that are deliberately crossed with position (a small dimension first, a large one last, and so on) lets us fit a model of which dimensions survive.
- **A harder generalisation task.** At 200 meanings and 80 examples, a learner can nearly memorise a 40-form language. At 1,000 or more meanings, the same 40% bottleneck means the learner sees far more of each regularity, but only partial coverage of any one rule (for example every agent-patient-tense combination), which is where over- and under-generalisation appear.
- **Room for structure that 200 meanings cannot hold.** Hierarchical or recursive meanings (a clause embedded as a patient, a modifier on an agent) are the natural test of whether anything beyond flat concatenative morphology can emerge. This is the more informative direction than simply multiplying the existing dimensions.
- **Non-uniform meaning frequency.** If meanings are sampled with a Zipfian distribution, the classic prediction is that frequent items keep irregular forms while rare items regularise. This is a clean, testable, well-studied effect that the uniform design cannot show.

**What to watch for when scaling:**

- Distinguish an absolute bottleneck (number of examples) from a relative one (fraction of the meaning space). The theory depends on the ratio. Scaling the space while holding the fraction constant changes the absolute number of examples and the prompt and output size together, and confounds the two.
- Output size grows with the space: 200 forms already takes a noticeable share of the 8000-token output limit. Beyond roughly 500 meanings, generation needs to be chunked, and chunking itself introduces a source of inconsistency across chunks that must be controlled for.
- Keep the 200-meaning space as the baseline condition so that results remain comparable.

Recommendation: do not simply raise 200 to 2,000. Add dimensions and structure on purpose, in a design that varies one thing at a time.

## 6. What changing the parameters can teach us

Each row is a condition we can run with the current code and small changes. The "prediction" column is a hypothesis to be tested, not a result.

| Parameter | Variations | What it isolates | Prediction |
|---|---|---|---|
| Bottleneck fraction | 0.1, 0.2, 0.6, 0.8, 1.0 | The learnability pressure. There should be a threshold below which structure cannot be sustained, and a point above which holistic languages persist. | Lower fractions collapse faster and further. At 0.8 and above, irregular holistic forms may survive, and stasis may arrive later or with more forms. |
| Temperature | 0, 0.5, 1.0, 1.5 | The mutation rate of transmission. | At 0 the chain should lock in earlier and exactly. At higher values the fixed point may fail to hold, which tells us the size of the basin. |
| Seed and chains | At least 10 independent chains per condition | Separates the model prior from path dependence. | If the same dimension collapses in most chains, that is a learner bias. If it varies, this run reflects chance. |
| Seed language | Structured (fully compositional), degenerate (the gen-210 language), random | Whether the fixed point is an attractor and how large its basin is. | A fully compositional start tests whether the chain actively degrades expressivity (the strong claim), or merely fails to build it. |
| Sampling strategy | Resampled vs fixed sample; stratified vs random; frequency-weighted | Whether coverage matters. A stratified sample guarantees each dimension value is seen. | Stratified sampling should slow collapse by removing one route by which distinctions are lost. |
| Prompt wording | Remove "not related to any human language", state that the language is used for communication, or require forms to be distinct | How much the prompt, as opposed to the model, determines the result. | Telling the learner that forms must be distinct will probably restore action marking. This is the cheapest version of the expressivity pressure in Section 8.1. |
| Output constraints | Cap form length, restrict the phoneme inventory | Length and phonotactic pressure. | A tight length cap should force shorter affixes and may drive more collapse. |
| Field order in the prompt | Permute agent, action, patient, tense | Position as an explanation for which dimension collapsed. | If the dropped dimension tracks position, the finding is a prompt artefact. |
| Meaning labels | Replace real words with nonsense tokens or swap semantic roles | Semantic salience as an explanation. | If the action is still dropped when its labels are meaningless, semantics is not the cause. |

The last two rows are the quickest way to explain the action collapse that the current run leaves unexplained.

## 7. What a different model would change

There is no data on this yet, so what follows is reasoning from the theory and should be tested.

If the learner is approximately Bayesian, the chain's endpoint is governed by the learner's prior. A different model has a different prior, so we should expect a different endpoint, a different rate of convergence, or both. Specific, testable predictions:

- **Larger models (Sonnet, Opus) may converge faster and more cleanly.** They are better at noticing a regularity from a few examples. They might also be better at noticing that a language is dropping distinctions and so preserve the action marking. Which of these dominates is an open question and is itself a result.
- **Smaller or older models should inject more noise.** Higher noise acts like a higher mutation rate, so the stationary language may be less regular, and the chain may never freeze.
- **Models will differ in typological bias.** Suffixing vs prefixing, order of agent and patient, and whether the tense marker is final are all things human languages have strong tendencies on (Greenberg universals). Running many chains per model gives a distribution over these choices, which is a way of probing what each model has absorbed from its training data. The fixed point here has the tense marker as a suffix and the agent before the patient, which matches English word order and common suffixing tendencies, but one chain does not make a bias.
- **Human-language leakage.** Even with the instruction that the language is unrelated to any human language, a model may import English-like structure. Comparing to a model with a different training mix (including an open-weight model) is a direct test.

Three experiments that use model differences well:

1. **Cross-model transfer of the frozen language.** Give the gen-210 language to other models for a short chain. If they reproduce it, the fixed point is a property of the language (an easy-to-learn code). If they alter it, the fixed point is partly specific to Haiku. This is cheap (a handful of generations).
2. **Same seed, different model.** Run the gen-0 seed through several models and compare which dimensions survive and how fast.
3. **Mixed-model chains.** Alternate two models in a chain. A language that survives alternation is robust to both priors. One that does not shows which model's prior dominates.

## 8. How to extend the experiment so it teaches something new

The central change is to give the system a second selective pressure. Under learnability alone, the result is predictable from the literature and the run has now confirmed it. The open questions are about what an LLM does when two pressures compete.

### 8.1 Add a communicative pressure (priority 1)

Options, from cheapest to most faithful:

1. **Distinctness constraint in the prompt.** Tell the learner that each meaning needs its own form, or that a listener must be able to tell meanings apart. Trivial to implement and a good first check, but it tells the learner what we want, which weakens the result as evidence of emergence.
2. **Post-hoc collision feedback.** After the learner's output, detect colliding forms, return them and ask for a revision. This models a repair process but is no longer a pure transmission chain, so it should be labelled as a different condition.
3. **Communication game (recommended).** Within each generation, a speaker model produces forms. A listener model, which has seen only the forms and the generation's training sample, must identify the intended meaning from a candidate set, and communicative accuracy is recorded. The next generation inherits the language that was used successfully. Variants: use the listener's errors to choose which pairs are shown to the next learner, or discard generations that fall below a success threshold. This is the structure used in the human experiments that produced both compositionality and expressivity (Kirby et al., 2015).

The central prediction under this design is a language with a unique form for essentially every meaning and high compositionality, and the interesting measurements are the trade-off curve between expressivity and learnability and where the system sits on it.

### 8.2 Improve measurement (priority 1, no new model calls)

- Per-dimension syncretism and per-dimension mutual information between form and each meaning dimension. These make "which distinctions are encoded" a first-class metric.
- An expressivity measure (unique forms divided by meanings, or the entropy of the meaning-to-form map) reported next to compositionality, so that a degenerate code cannot look like success.
- Spearman topographic similarity as a robustness check on Pearson.
- A morphological segmentation of the final languages (the fixed point here was recovered by hand) to quantify affix position and consistency.
- A stasis detector in the runner: halt after N consecutive generations with zero fidelity change, and report the generation at which it triggered.

### 8.3 Replicate (priority 1)

Run at least 10 chains per condition with different seeds, and report the distribution of time-to-stasis, the final number of unique forms and which dimension was dropped, with bootstrap confidence intervals. Without this, every extension above remains anecdotal.

### 8.4 Probe the learner, not the language (priority 2)

If the chain converges to the learner's prior, the experiment is a prior-elicitation tool. Sweeping seeds and models and tabulating which structures appear gives a map of the inductive biases of each model: dimension-dropping order, affix position, tendency to reuse segments across roles. This is a genuinely new kind of data for LLMs and would be the most publishable result the project could produce.

### 8.5 Richer meaning spaces and noise (priority 2)

Hierarchical meanings, Zipfian frequency and varied cardinalities (Section 5), plus a learner with limited memory or injected transmission noise, to test whether irregularity persists in high-frequency items and whether noise can be a source of continued change instead of stasis.

### 8.6 Suggested order of work

1. Add the metrics and stopping rule (no cost, makes everything else interpretable).
2. Run the prompt-ordering and label-ablation experiments to explain the action collapse.
3. Replicate the baseline over 10 seeds and test the bottleneck fraction and temperature sweeps.
4. Run the cross-model transfer test and a same-seed comparison across models.
5. Implement the communication game and rerun the baseline.
6. Only then expand the meaning space.

## 9. Limitations

- One chain, one model, one seed, one meaning space. All interpretations in Section 4 are provisional.
- The compositionality metric is blind to syncretism, so its value at the fixed point overstates how compositional the language is.
- Model behaviour is tied to a specific model snapshot, which may not remain available.
- Hand analysis of the fixed point was done on the final language only. The route by which action marking disappeared (gradual merging between generations 15 and 44) is inferred from syncretism statistics and has not been traced form by form.

## 10. Conclusion

The experiment reached stasis at generation 44. Within that time it reproduced a known effect: transmission through a bottleneck turns a holistic language into a regular one, and without a pressure for communication it also discards distinctions, here the entire action dimension. The run does not yet say anything about LLMs that was not predicted by the theory, and it cannot say whether the choice of dropped dimension is a property of the model. The extensions that change this are the introduction of a communicative pressure, replication across seeds and models, and an analysis of which structures each model's prior favours.

## Appendix A: Reproducing the analysis

```bash
node analysis/syncretism.mjs            # default generations
node analysis/syncretism.mjs 0 25 44    # chosen generations
npm run report                          # headline metrics, writes metrics/timeseries.json
```

## Appendix B: References (verify before external use)

- Kirby, S., Cornish, H. and Smith, K. (2008). Cumulative cultural evolution in the laboratory: an experimental approach to the origins of structure in human language. PNAS.
- Kirby, S., Tamariz, M., Cornish, H. and Smith, K. (2015). Compression and communication in the cultural evolution of linguistic structure. Cognition.
- Griffiths, T. L. and Kalish, M. L. (2007). Language evolution by iterated learning with Bayesian agents. Cognitive Science.
- Ren, Y. et al. (2024). Bias amplification in language model evolution: an iterated learning perspective. NeurIPS.
