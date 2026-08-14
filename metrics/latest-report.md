# 🧬 Traditio Generation Report

_Iterated language transmission experiment: each generation only sees a sampled subset of the previous generation's language and must reconstruct the rest, testing what regularities survive a chain of learners._

![generation](https://img.shields.io/badge/generation-6-blue) ![model](https://img.shields.io/badge/model-claude--haiku--4--5--20251001-informational) ![unique_forms](https://img.shields.io/badge/unique_forms-197/200-orange) ![compositionality](https://img.shields.io/badge/compositionality-0.4941-brightgreen)

> [!NOTE]
> ➡️ Compositionality is holding roughly steady (+0.0197) this generation.

## Generation 6 (claude-haiku-4-5-20251001)

Generated: 2026-08-14T16:42:36.590Z

| Metric | Value | What it means |
|---|---|---|
| Compositionality | 0.4941 (▲ +0.0197) | Correlation between how different two meanings are and how different their word forms are. Closer to 1 = a systematic, rule-like language; closer to 0 = arbitrary forms. |
| Transmission fidelity (overall) | 0.2074 (▼ -0.0178) | Mean normalized edit distance between this generation's forms and the previous generation's, across all meanings (0 = identical, 1 = completely different). Lower = more faithful transmission. |
| — in-sample | 0.0000 | Same measure, restricted to meanings this generation actually saw during training. |
| — held-out | 0.3457 | Same measure for meanings NOT shown to this generation — it had to infer these forms. Larger divergence here is expected. |
| Compression ratio | 0.3510 (▼ -0.0035) | gzip size of the full lexicon divided by its raw size. Lower = more internal redundancy/structure in the forms. |
| Unique forms | 197 / 200 | Distinct word forms produced. Fewer than 200 means some meanings collapsed onto the same form. |

## 👀 Watch the language evolve

A fixed set of meanings, tracked every generation, so you can see actual forms drift:

| Meaning | Gen 5 form | Gen 6 form | |
|---|---|---|---|
| wolf sees bird (past) | `towibela` | `towibela` | ✅ unchanged |
| wolf fears bird (nonpast) | `wanitun` | `wabelan` | 🔄 drifted |
| bird chases child (past) | `bochato` | `bocha` | 🔄 drifted |
| bird finds child (nonpast) | `bashilun` | `bashilun` | ✅ unchanged |
| child eats stone (past) | `chisilo` | `chisilo` | ✅ unchanged |
| stone sees child (nonpast) | `somelan` | `somolen` | 🔄 drifted |
| stone fears river (past) | `soemel` | `solileme` | 🔄 drifted |
| river chases stone (nonpast) | `rimisilen` | `rimisilen` | ✅ unchanged |

## 📈 Trend

```mermaid
xychart-beta
    title "Compositionality & transmission fidelity across generations"
    x-axis "Generation" [1, 2, 3, 4, 5, 6]
    y-axis "Score" 0 --> 1
    line "Compositionality" [0.2559, 0.2849, 0.4060, 0.4663, 0.4745, 0.4941]
    line "Transmission Fidelity" [0.5148, 0.3796, 0.2746, 0.2481, 0.2251, 0.2074]
```

## History across generations

| Gen | Compositionality | Transmission Fidelity | Compression | Unique Forms |
|---|---|---|---|---|
| 1 | 0.2559 | 0.5148 | 0.4620 | 197/200 |
| 2 | 0.2849 | 0.3796 | 0.4189 | 185/200 |
| 3 | 0.4060 | 0.2746 | 0.3776 | 183/200 |
| 4 | 0.4663 | 0.2481 | 0.3557 | 178/200 |
| 5 | 0.4745 | 0.2251 | 0.3544 | 187/200 |
| 6 | 0.4941 | 0.2074 | 0.3510 | 197/200 |
