# 🧬 Traditio Generation Report

_Iterated language transmission experiment: each generation only sees a sampled subset of the previous generation's language and must reconstruct the rest, testing what regularities survive a chain of learners._

![generation](https://img.shields.io/badge/generation-9-blue) ![model](https://img.shields.io/badge/model-claude--haiku--4--5--20251001-informational) ![unique_forms](https://img.shields.io/badge/unique_forms-184/200-orange) ![compositionality](https://img.shields.io/badge/compositionality-0.4603-brightgreen)

> [!NOTE]
> ➡️ Compositionality is holding roughly steady (-0.0224) this generation.

## Generation 9 (claude-haiku-4-5-20251001)

Generated: 2026-08-15T16:12:03.375Z

| Metric | Value | What it means |
|---|---|---|
| Compositionality | 0.4603 (▼ -0.0224) | Correlation between how different two meanings are and how different their word forms are. Closer to 1 = a systematic, rule-like language; closer to 0 = arbitrary forms. |
| Transmission fidelity (overall) | 0.1949 (▲ +0.0334) | Mean normalized edit distance between this generation's forms and the previous generation's, across all meanings (0 = identical, 1 = completely different). Lower = more faithful transmission. |
| — in-sample | 0.0086 | Same measure, restricted to meanings this generation actually saw during training. |
| — held-out | 0.3191 | Same measure for meanings NOT shown to this generation — it had to infer these forms. Larger divergence here is expected. |
| Compression ratio | 0.3194 (▲ +0.0069) | gzip size of the full lexicon divided by its raw size. Lower = more internal redundancy/structure in the forms. |
| Unique forms | 184 / 200 | Distinct word forms produced. Fewer than 200 means some meanings collapsed onto the same form. |

## 👀 Watch the language evolve

A fixed set of meanings, tracked every generation, so you can see actual forms drift:

| Meaning | Gen 8 form | Gen 9 form | |
|---|---|---|---|
| wolf sees bird (past) | `towibelo` | `towibelo` | ✅ unchanged |
| wolf fears bird (nonpast) | `wabelen` | `wabelen` | ✅ unchanged |
| bird chases child (past) | `bobemet` | `bobemet` | ✅ unchanged |
| bird finds child (nonpast) | `bachatilan` | `babemetan` | 🔄 drifted |
| child eats stone (past) | `chiselo` | `chisselon` | 🔄 drifted |
| stone sees child (nonpast) | `somelan` | `somelan` | ✅ unchanged |
| stone fears river (past) | `solileme` | `solileme` | ✅ unchanged |
| river chases stone (nonpast) | `riselan` | `riliselan` | 🔄 drifted |

## 📈 Trend

```mermaid
xychart-beta
    title "Compositionality & transmission fidelity across generations"
    x-axis "Generation" [1, 2, 3, 4, 5, 6, 7, 8, 9]
    y-axis "Score" 0 --> 1
    line "Compositionality" [0.2559, 0.2849, 0.4060, 0.4663, 0.4745, 0.4941, 0.5099, 0.4826, 0.4603]
    line "Transmission Fidelity" [0.5148, 0.3796, 0.2746, 0.2481, 0.2251, 0.2074, 0.1785, 0.1615, 0.1949]
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
| 7 | 0.5099 | 0.1785 | 0.3388 | 181/200 |
| 8 | 0.4826 | 0.1615 | 0.3126 | 164/200 |
| 9 | 0.4603 | 0.1949 | 0.3194 | 184/200 |
