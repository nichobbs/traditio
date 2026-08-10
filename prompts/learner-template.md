# Language Learning Task

You are learning an artificial language through bottlenecked observation.

## Training Data

Below are form-meaning pairs in the language. Study them carefully:

{{TRAINING_PAIRS}}

## Your Task

You must produce forms for the following meanings. For each meaning, provide the form that you believe belongs in this language. Your response must be a valid JSON array with exactly one entry per meaning.

Output format: `[{"meaningId": "m000", "form": "word"}, {"meaningId": "m001", "form": "word"}, ...]`

## Target Meanings

Produce forms for all of these meanings:

{{TARGET_MEANINGS}}

## Rules

- Each form must be lowercase letters only (a-z).
- No hyphens, apostrophes, numbers, or special characters.
- Forms should follow the patterns you observe in the training data.
- You must provide exactly one form for each of the 200 target meanings.
- Respond with only the JSON array, with no additional text.
