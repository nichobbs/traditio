# 🧬 Traditio Generation Report

_Iterated language transmission experiment: each generation only sees a sampled subset of the previous generation's language and must reconstruct the rest, testing what regularities survive a chain of learners._

![generation](https://img.shields.io/badge/generation-43-blue) ![model](https://img.shields.io/badge/model-claude--haiku--4--5--20251001-informational) ![unique_forms](https://img.shields.io/badge/unique_forms-40/200-orange) ![compositionality](https://img.shields.io/badge/compositionality-0.8250-brightgreen)

> [!NOTE]
> ➡️ Compositionality is holding roughly steady (+0.0067) this generation.

## Generation 43 (claude-haiku-4-5-20251001)

Generated: 2026-08-30T13:23:53.318Z

| Metric | Value | What it means |
|---|---|---|
| Compositionality | 0.8250 (▲ +0.0067) | Correlation between how different two meanings are and how different their word forms are. Closer to 1 = a systematic, rule-like language; closer to 0 = arbitrary forms. |
| Transmission fidelity (overall) | 0.0071 (▲ +0.0043) | Mean normalized edit distance between this generation's forms and the previous generation's, across all meanings (0 = identical, 1 = completely different). Lower = more faithful transmission. |
| — in-sample | 0.0073 | Same measure, restricted to meanings this generation actually saw during training. |
| — held-out | 0.0069 | Same measure for meanings NOT shown to this generation — it had to infer these forms. Larger divergence here is expected. |
| Compression ratio | 0.0764 (▼ -0.0121) | gzip size of the full lexicon divided by its raw size. Lower = more internal redundancy/structure in the forms. |
| Unique forms | 40 / 200 | Distinct word forms produced. Fewer than 200 means some meanings collapsed onto the same form. |

## 👀 Watch the language evolve

A fixed set of meanings, tracked every generation, so you can see actual forms drift:

| Meaning | Gen 42 form | Gen 43 form | |
|---|---|---|---|
| wolf sees bird (past) | `wajemelo` | `wajemelo` | ✅ unchanged |
| wolf fears bird (nonpast) | `wajemelen` | `wajemelen` | ✅ unchanged |
| bird chases child (past) | `bomemelo` | `bomemelo` | ✅ unchanged |
| bird finds child (nonpast) | `bomemelen` | `bomemelen` | ✅ unchanged |
| child eats stone (past) | `chisemelo` | `chisemelo` | ✅ unchanged |
| stone sees child (nonpast) | `simemelen` | `simemelen` | ✅ unchanged |
| stone fears river (past) | `silemelo` | `silemelo` | ✅ unchanged |
| river chases stone (nonpast) | `rusemelen` | `rusemelen` | ✅ unchanged |

## 📈 Trend

```mermaid
xychart-beta
    title "Compositionality & transmission fidelity across generations"
    x-axis "Generation" [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43]
    y-axis "Score" 0 --> 1
    line "Compositionality" [0.2559, 0.2849, 0.4060, 0.4663, 0.4745, 0.4941, 0.5099, 0.4826, 0.4603, 0.4619, 0.5665, 0.6011, 0.5822, 0.6121, 0.6029, 0.6464, 0.6473, 0.6195, 0.6304, 0.6332, 0.6566, 0.6361, 0.6598, 0.7061, 0.6725, 0.6757, 0.6767, 0.6767, 0.6863, 0.7028, 0.6890, 0.7012, 0.7442, 0.7505, 0.7619, 0.7619, 0.7619, 0.7619, 0.7619, 0.7669, 0.8009, 0.8183, 0.8250]
    line "Transmission Fidelity" [0.5148, 0.3796, 0.2746, 0.2481, 0.2251, 0.2074, 0.1785, 0.1615, 0.1949, 0.1977, 0.1504, 0.1472, 0.1286, 0.1016, 0.0861, 0.0987, 0.0594, 0.0888, 0.0697, 0.0276, 0.0536, 0.0500, 0.0553, 0.0339, 0.0483, 0.0051, 0.0012, 0.0000, 0.0083, 0.0219, 0.0066, 0.0142, 0.0301, 0.0134, 0.0092, 0.0000, 0.0000, 0.0000, 0.0000, 0.0047, 0.0146, 0.0028, 0.0071]
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
| 10 | 0.4619 | 0.1977 | 0.3076 | 176/200 |
| 11 | 0.5665 | 0.1504 | 0.3196 | 175/200 |
| 12 | 0.6011 | 0.1472 | 0.2931 | 166/200 |
| 13 | 0.5822 | 0.1286 | 0.2746 | 164/200 |
| 14 | 0.6121 | 0.1016 | 0.2793 | 172/200 |
| 15 | 0.6029 | 0.0861 | 0.2531 | 157/200 |
| 16 | 0.6464 | 0.0987 | 0.2310 | 142/200 |
| 17 | 0.6473 | 0.0594 | 0.2235 | 140/200 |
| 18 | 0.6195 | 0.0888 | 0.2259 | 138/200 |
| 19 | 0.6304 | 0.0697 | 0.2001 | 125/200 |
| 20 | 0.6332 | 0.0276 | 0.1935 | 118/200 |
| 21 | 0.6566 | 0.0536 | 0.1938 | 122/200 |
| 22 | 0.6361 | 0.0500 | 0.1934 | 125/200 |
| 23 | 0.6598 | 0.0553 | 0.1736 | 105/200 |
| 24 | 0.7061 | 0.0339 | 0.1517 | 94/200 |
| 25 | 0.6725 | 0.0483 | 0.1283 | 80/200 |
| 26 | 0.6757 | 0.0051 | 0.1354 | 86/200 |
| 27 | 0.6767 | 0.0012 | 0.1342 | 86/200 |
| 28 | 0.6767 | 0.0000 | 0.1342 | 86/200 |
| 29 | 0.6863 | 0.0083 | 0.1330 | 88/200 |
| 30 | 0.7028 | 0.0219 | 0.1236 | 80/200 |
| 31 | 0.6890 | 0.0066 | 0.1319 | 82/200 |
| 32 | 0.7012 | 0.0142 | 0.1350 | 90/200 |
| 33 | 0.7442 | 0.0301 | 0.1130 | 69/200 |
| 34 | 0.7505 | 0.0134 | 0.1061 | 66/200 |
| 35 | 0.7619 | 0.0092 | 0.1044 | 64/200 |
| 36 | 0.7619 | 0.0000 | 0.1044 | 64/200 |
| 37 | 0.7619 | 0.0000 | 0.1044 | 64/200 |
| 38 | 0.7619 | 0.0000 | 0.1044 | 64/200 |
| 39 | 0.7619 | 0.0000 | 0.1044 | 64/200 |
| 40 | 0.7669 | 0.0047 | 0.0951 | 56/200 |
| 41 | 0.8009 | 0.0146 | 0.0937 | 48/200 |
| 42 | 0.8183 | 0.0028 | 0.0885 | 48/200 |
| 43 | 0.8250 | 0.0071 | 0.0764 | 40/200 |
