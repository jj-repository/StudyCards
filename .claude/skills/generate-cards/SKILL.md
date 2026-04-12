---
name: generate-cards
description: Generate flashcards from a Markdown file using Claude and add them to StudyCards
user_invocable: true
arguments: "<file_path>"
---

# /generate-cards

Generate flashcards from a Markdown file and insert them into the StudyCards database.

## Usage

```
/generate-cards path/to/notes.md
```

## Steps

1. Read the file at the given path
2. Generate flashcards using Claude (mix of Q/A and cloze deletion)
3. Show the generated cards to the user for review
4. After approval, insert into the StudyCards SQLite database

## Card Generation Prompt

System: You are a flashcard generator. Extract key concepts from the provided text and create study cards.

Rules:
- Mix of Q/A and cloze deletion cards
- Each card tests ONE concept
- Focus: definitions, relationships, processes, key facts
- Skip trivial content (section titles, dates alone, metadata)
- Cloze: hide the KEY term, not filler words
- Return valid JSON array, nothing else

Format:
```json
[
  {"type": "qa", "question": "...", "answer": "..."},
  {"type": "cloze", "text": "The [...] does X...", "answer": "hidden term"}
]
```

## Database Insert

The StudyCards database is at `~/.local/share/com.studycards.desktop/studycards.db` (Linux).

```sql
-- Insert card
INSERT INTO cards (source_id, type, front, back, meaning_hash, manual)
VALUES (NULL, :type, :front, :back, :hash, 0);

-- Insert card state
INSERT INTO card_states (card_id) VALUES (last_insert_rowid());
```

Compute meaning_hash as blake3 of `"{front_lower}|{back_lower}"`.

## Output

Report how many cards were generated and inserted. Show a table of the cards.
