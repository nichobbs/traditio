# 🧬 Traditio Generation Report

_Iterated language transmission experiment: each generation only sees a sampled subset of the previous generation's language and must reconstruct the rest, testing what regularities survive a chain of learners._

![generation](https://img.shields.io/badge/generation-1-blue) ![model](https://img.shields.io/badge/model-claude--haiku--4--5--20251001-informational) ![unique_forms](https://img.shields.io/badge/unique_forms-197/200-orange) ![compositionality](https://img.shields.io/badge/compositionality-0.2559-yellow)

> [!NOTE]
> First measured generation — nothing to compare against yet. Check back after the next run.

## Generation 1 (claude-haiku-4-5-20251001)

Generated: 2026-08-13T12:16:26.359Z

| Metric | Value | What it means |
|---|---|---|
| Compositionality | 0.2559 | Correlation between how different two meanings are and how different their word forms are. Closer to 1 = a systematic, rule-like language; closer to 0 = arbitrary forms. |
| Transmission fidelity (overall) | 0.5148 | Mean normalized edit distance between this generation's forms and the previous generation's, across all meanings (0 = identical, 1 = completely different). Lower = more faithful transmission. |
| — in-sample | 0.0000 | Same measure, restricted to meanings this generation actually saw during training. |
| — held-out | 0.8580 | Same measure for meanings NOT shown to this generation — it had to infer these forms. Larger divergence here is expected. |
| Compression ratio | 0.4620 | gzip size of the full lexicon divided by its raw size. Lower = more internal redundancy/structure in the forms. |
| Unique forms | 197 / 200 | Distinct word forms produced. Fewer than 200 means some meanings collapsed onto the same form. |

## 👀 Watch the language evolve

A fixed set of meanings, tracked every generation, so you can see actual forms drift:

| Meaning | Gen 0 form | Gen 1 form | |
|---|---|---|---|
| wolf sees bird (past) | `juwiwipo` | `waleni` | 🔄 drifted |
| wolf fears bird (nonpast) | `jekomo` | `wanitu` | 🔄 drifted |
| bird chases child (past) | `pajikemo` | `bochato` | 🔄 drifted |
| bird finds child (nonpast) | `tijikawi` | `tijikawi` | ✅ unchanged |
| child eats stone (past) | `lili` | `lili` | ✅ unchanged |
| stone sees child (nonpast) | `pepeke` | `howenu` | 🔄 drifted |
| stone fears river (past) | `lujopi` | `somelo` | 🔄 drifted |
| river chases stone (nonpast) | `lune` | `lune` | ✅ unchanged |

## History across generations

| Gen | Compositionality | Transmission Fidelity | Compression | Unique Forms |
|---|---|---|---|---|
| 1 | 0.2559 | 0.5148 | 0.4620 | 197/200 |
