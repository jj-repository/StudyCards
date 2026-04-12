use fsrs::{MemoryState, FSRS};

pub struct Scheduler {
    fsrs: FSRS,
    desired_retention: f32,
}

impl Scheduler {
    pub fn new(desired_retention: f32) -> Self {
        Self {
            fsrs: FSRS::new(None).expect("Failed to initialize FSRS"),
            desired_retention,
        }
    }

    /// Compute the next state after a review.
    /// Returns (stability, difficulty, interval_days, new_status).
    pub fn review(
        &self,
        stability: f64,
        difficulty: f64,
        review_count: i64,
        days_elapsed: f64,
        rating: u32,
    ) -> Result<(f64, f64, f64, String), String> {
        let memory_state = if review_count == 0 {
            None
        } else {
            Some(MemoryState {
                stability: stability as f32,
                difficulty: difficulty as f32,
            })
        };

        let elapsed = if review_count == 0 {
            0
        } else {
            (days_elapsed as u32).max(1)
        };

        let next_states = self
            .fsrs
            .next_states(memory_state, self.desired_retention, elapsed)
            .map_err(|e| format!("FSRS error: {e}"))?;

        let chosen = match rating {
            1 => &next_states.again,
            2 => &next_states.hard,
            3 => &next_states.good,
            4 => &next_states.easy,
            _ => return Err("Rating must be 1-4".to_string()),
        };

        let new_stability = chosen.memory.stability as f64;
        let new_difficulty = chosen.memory.difficulty as f64;
        let mut interval = chosen.interval.round().max(1.0) as f64;

        // Learning step caps (from Repeater pattern)
        let total_reviews = review_count + 1;
        interval = apply_learning_caps(total_reviews, rating, interval);

        let new_status = determine_status(total_reviews, rating);

        Ok((new_stability, new_difficulty, interval, new_status))
    }
}

/// Cap intervals for early reviews to prevent aggressive spacing.
fn apply_learning_caps(total_reviews: i64, rating: u32, raw_interval: f64) -> f64 {
    match total_reviews {
        1 => {
            // First review: max 10 minutes (as fraction of day)
            let cap = 10.0 / 1440.0; // ~0.007 days
            if rating == 1 {
                1.0 / 1440.0 // 1 minute
            } else {
                raw_interval.min(cap)
            }
        }
        2 => {
            if rating == 1 {
                1.0 / 1440.0 // 1 minute
            } else {
                raw_interval.min(10.0 / 1440.0) // 10 minutes
            }
        }
        3 => {
            if rating == 1 {
                10.0 / 1440.0 // 10 minutes
            } else {
                raw_interval.min(1.0) // 1 day
            }
        }
        _ => raw_interval, // Trust FSRS after 3 reviews
    }
}

fn determine_status(total_reviews: i64, rating: u32) -> String {
    if rating == 1 {
        if total_reviews <= 3 {
            "learning".to_string()
        } else {
            "relearning".to_string()
        }
    } else if total_reviews <= 3 {
        "learning".to_string()
    } else {
        "review".to_string()
    }
}

impl Default for Scheduler {
    fn default() -> Self {
        Self::new(0.9)
    }
}
