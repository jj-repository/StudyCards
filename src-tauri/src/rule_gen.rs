use crate::db::GeneratedCard;

/// Rule-based card generation from Markdown — no LLM needed.
/// Extracts cards from structure: headings→Q/A, **bold**→cloze, lists→enumeration.
pub fn generate_from_markdown(content: &str) -> Vec<GeneratedCard> {
    let mut cards = Vec::new();
    let lines: Vec<&str> = content.lines().collect();

    let mut current_heading: Option<String> = None;
    let mut section_body = String::new();

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();

        // Heading detection
        if let Some(heading) = parse_heading(trimmed) {
            // Flush previous section
            if let Some(ref h) = current_heading {
                let body = section_body.trim().to_string();
                if !body.is_empty() && body.len() > 10 {
                    cards.push(GeneratedCard {
                        card_type: "qa".into(),
                        question: Some(format!("What is {}?", h)),
                        answer: Some(first_paragraph(&body)),
                        text: None,
                    });
                }
            }
            current_heading = Some(heading);
            section_body.clear();
            continue;
        }

        // Accumulate body text for heading-based cards
        if current_heading.is_some() && !trimmed.is_empty() {
            section_body.push_str(trimmed);
            section_body.push(' ');
        }

        // Bold term cloze: lines containing **term**
        if let Some(card) = extract_bold_cloze(trimmed) {
            cards.push(card);
        }

        // Definition pattern: "Term: definition" or "Term — definition"
        if let Some(card) = extract_definition(trimmed) {
            cards.push(card);
        }

        // Enumeration: detect list blocks (3+ consecutive list items under a heading)
        if is_list_item(trimmed) {
            let list_items = collect_list_from(i, &lines);
            if list_items.len() >= 3 {
                if let Some(ref h) = current_heading {
                    let items_str = list_items
                        .iter()
                        .map(|s| format!("- {s}"))
                        .collect::<Vec<_>>()
                        .join("\n");
                    cards.push(GeneratedCard {
                        card_type: "qa".into(),
                        question: Some(format!("List the items under: {}", h)),
                        answer: Some(items_str),
                        text: None,
                    });
                }
            }
        }
    }

    // Flush last section
    if let Some(ref h) = current_heading {
        let body = section_body.trim().to_string();
        if !body.is_empty() && body.len() > 10 {
            cards.push(GeneratedCard {
                card_type: "qa".into(),
                question: Some(format!("What is {}?", h)),
                answer: Some(first_paragraph(&body)),
                text: None,
            });
        }
    }

    dedup_cards(cards)
}

fn parse_heading(line: &str) -> Option<String> {
    if line.starts_with('#') {
        let text = line.trim_start_matches('#').trim();
        if !text.is_empty() {
            return Some(text.to_string());
        }
    }
    None
}

fn first_paragraph(body: &str) -> String {
    let truncated: String = body.chars().take(300).collect();
    if body.len() > 300 {
        format!("{}...", truncated.trim())
    } else {
        truncated.trim().to_string()
    }
}

fn extract_bold_cloze(line: &str) -> Option<GeneratedCard> {
    // Match **term** within a sentence (not standalone bold headings)
    let start = line.find("**")?;
    let rest = &line[start + 2..];
    let end = rest.find("**")?;
    let term = &rest[..end];

    if term.is_empty() || term.len() > 80 {
        return None;
    }

    // Need surrounding context — not just the bold word alone
    let before = line[..start].trim();
    let after = rest[end + 2..].trim();
    if before.is_empty() && after.is_empty() {
        return None; // standalone bold, likely a heading — skip
    }

    let cloze_text = format!("{} [...] {}", before, after).trim().to_string();

    Some(GeneratedCard {
        card_type: "cloze".into(),
        question: None,
        answer: Some(term.to_string()),
        text: Some(cloze_text),
    })
}

fn extract_definition(line: &str) -> Option<GeneratedCard> {
    // "Term: definition" pattern (colon with space after)
    let sep = if line.contains(": ") {
        ": "
    } else if line.contains(" — ") {
        " — "
    } else if line.contains(" - ") && !line.starts_with('-') && !line.starts_with('*') {
        " - "
    } else {
        return None;
    };

    let parts: Vec<&str> = line.splitn(2, sep).collect();
    if parts.len() != 2 {
        return None;
    }

    let term = parts[0]
        .trim()
        .trim_start_matches("- ")
        .trim_start_matches("* ");
    let def = parts[1].trim();

    // Sanity checks
    if term.is_empty() || def.is_empty() || term.len() > 80 || def.len() < 5 {
        return None;
    }
    // Skip if term looks like a sentence (has spaces and is long)
    if term.split_whitespace().count() > 5 {
        return None;
    }

    Some(GeneratedCard {
        card_type: "qa".into(),
        question: Some(format!("What is {}?", term)),
        answer: Some(def.to_string()),
        text: None,
    })
}

fn is_list_item(line: &str) -> bool {
    line.starts_with("- ") || line.starts_with("* ") || line.starts_with("1. ")
}

fn collect_list_from<'a>(start: usize, lines: &[&'a str]) -> Vec<String> {
    let mut items = Vec::new();
    for line in &lines[start..] {
        let trimmed = line.trim();
        if is_list_item(trimmed) {
            let text = trimmed
                .trim_start_matches("- ")
                .trim_start_matches("* ")
                .trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c == ' ');
            if !text.is_empty() {
                items.push(text.to_string());
            }
        } else if trimmed.is_empty() {
            continue; // blank lines within list
        } else {
            break;
        }
    }
    items
}

fn dedup_cards(cards: Vec<GeneratedCard>) -> Vec<GeneratedCard> {
    let mut seen = std::collections::HashSet::new();
    cards
        .into_iter()
        .filter(|c| {
            let key = format!(
                "{}|{}|{}",
                c.question.as_deref().unwrap_or(""),
                c.answer.as_deref().unwrap_or(""),
                c.text.as_deref().unwrap_or(""),
            );
            seen.insert(key)
        })
        .collect()
}
