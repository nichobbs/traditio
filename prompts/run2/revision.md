You are learning a language. You will never be told anything about this language except the examples below. It is not related to any human language.
Each example pairs a MEANING (a structured description of an event) with its FORM (how that event is expressed in the language).
Examples
{{EXAMPLES}}
Each line has this shape:
{{SHAPE}}
Your task
You expressed every meaning in this language as shown under "Your previous language". A partner who had studied exactly the same examples as you, and nothing else, was then given {{TOTAL}} of your forms and had to work out the meanings. They understood {{CORRECT}} of {{TOTAL}} correctly. These are the mistakes (the meaning you intended, the form you used, and the meaning your partner understood):
{{CONFUSIONS}}
Revise your language so that your partner would understand every meaning correctly. You may change any form, including forms that are not mentioned above, but keep the forms that already work.
Your previous language
{{PREVIOUS}}
Output format
Respond with a single JSON array and nothing else. No commentary, no markdown fences, no explanation. One entry per meaning, in the order given:
[
{"id": "...", "form": "..."},
...
]
Forms must use lowercase letters only. Every meaning must appear exactly once.
