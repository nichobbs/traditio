# 🧬 Traditio Generation Report

_Iterated language transmission experiment: each generation only sees a sampled subset of the previous generation's language and must reconstruct the rest, testing what regularities survive a chain of learners._

![generation](https://img.shields.io/badge/generation-5-blue) ![model](https://img.shields.io/badge/model-claude--haiku--4--5--20251001-informational) ![unique_forms](https://img.shields.io/badge/unique_forms-187/200-orange) ![compositionality](https://img.shields.io/badge/compositionality-0.4745-brightgreen)

> [!NOTE]
> ➡️ Compositionality is holding roughly steady (+0.0082) this generation.

## Generation 5 (claude-haiku-4-5-20251001)

Generated: 2026-08-14T09:03:31.733Z

| Metric | Value | What it means |
|---|---|---|
| Compositionality | 0.4745 (▲ +0.0082) | Correlation between how different two meanings are and how different their word forms are. Closer to 1 = a systematic, rule-like language; closer to 0 = arbitrary forms. |
| Transmission fidelity (overall) | 0.2251 (▼ -0.0229) | Mean normalized edit distance between this generation's forms and the previous generation's, across all meanings (0 = identical, 1 = completely different). Lower = more faithful transmission. |
| — in-sample | 0.0000 | Same measure, restricted to meanings this generation actually saw during training. |
| — held-out | 0.3752 | Same measure for meanings NOT shown to this generation — it had to infer these forms. Larger divergence here is expected. |
| Compression ratio | 0.3544 (▼ -0.0012) | gzip size of the full lexicon divided by its raw size. Lower = more internal redundancy/structure in the forms. |
| Unique forms | 187 / 200 | Distinct word forms produced. Fewer than 200 means some meanings collapsed onto the same form. |

## 👀 Watch the language evolve

A fixed set of meanings, tracked every generation, so you can see actual forms drift:

| Meaning | Gen 4 form | Gen 5 form | |
|---|---|---|---|
| wolf sees bird (past) | `tobito` | `towibela` | 🔄 drifted |
| wolf fears bird (nonpast) | `wanitu` | `wanitun` | 🔄 drifted |
| bird chases child (past) | `bochato` | `bochato` | ✅ unchanged |
| bird finds child (nonpast) | `bashilun` | `bashilun` | ✅ unchanged |
| child eats stone (past) | `chisilo` | `chisilo` | ✅ unchanged |
| stone sees child (nonpast) | `somelan` | `somelan` | ✅ unchanged |
| stone fears river (past) | `soleme` | `soemel` | 🔄 drifted |
| river chases stone (nonpast) | `rimisilen` | `rimisilen` | ✅ unchanged |

## 📈 Trend

```mermaid
xychart-beta
    title "Compositionality & transmission fidelity across generations"
    x-axis "Generation" [1, 2, 3, 4, 5]
    y-axis "Score" 0 --> 1
    line "Compositionality" [0.2559, 0.2849, 0.4060, 0.4663, 0.4745]
    line "Transmission Fidelity" [0.5148, 0.3796, 0.2746, 0.2481, 0.2251]
```

## History across generations

| Gen | Compositionality | Transmission Fidelity | Compression | Unique Forms |
|---|---|---|---|---|
| 1 | 0.2559 | 0.5148 | 0.4620 | 197/200 |
| 2 | 0.2849 | 0.3796 | 0.4189 | 185/200 |
| 3 | 0.4060 | 0.2746 | 0.3776 | 183/200 |
| 4 | 0.4663 | 0.2481 | 0.3557 | 178/200 |
| 5 | 0.4745 | 0.2251 | 0.3544 | 187/200 |
