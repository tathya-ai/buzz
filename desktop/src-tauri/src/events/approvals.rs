use nostr::{EventBuilder, Kind, Tag};

fn approval_tag(approval_ref: &str) -> Result<Tag, String> {
    if approval_ref.len() != 64 || !approval_ref.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("approval reference must be a 64-character hex digest".to_string());
    }
    Tag::parse(vec!["d", approval_ref]).map_err(|error| format!("invalid tag: {error}"))
}

/// Kind 46030 — grant an approval reference with an optional note.
pub fn build_approval_grant(
    approval_ref: &str,
    note: Option<&str>,
) -> Result<EventBuilder, String> {
    Ok(EventBuilder::new(Kind::Custom(46030), note.unwrap_or(""))
        .tags(vec![approval_tag(approval_ref)?]))
}

/// Kind 46031 — deny an approval reference with an optional note.
pub fn build_approval_deny(approval_ref: &str, note: Option<&str>) -> Result<EventBuilder, String> {
    Ok(EventBuilder::new(Kind::Custom(46031), note.unwrap_or(""))
        .tags(vec![approval_tag(approval_ref)?]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use nostr::{Keys, SecretKey};

    #[test]
    fn approval_builders_use_validated_d_tag_reference() {
        let approval_ref = "ab".repeat(32);
        let secret =
            SecretKey::from_hex("0000000000000000000000000000000000000000000000000000000000000004")
                .unwrap();
        let keys = Keys::new(secret);

        for (builder, expected_kind) in [
            (
                build_approval_grant(&approval_ref, Some("ship it")).unwrap(),
                46030,
            ),
            (build_approval_deny(&approval_ref, None).unwrap(), 46031),
        ] {
            let event = builder.sign_with_keys(&keys).unwrap();
            let tags: Vec<Vec<String>> = event
                .tags
                .iter()
                .map(|tag| tag.as_slice().to_vec())
                .collect();
            assert_eq!(event.kind, Kind::Custom(expected_kind));
            assert_eq!(tags, vec![vec!["d".to_string(), approval_ref.clone()]]);
        }

        assert!(build_approval_grant("short", None).is_err());
        assert!(build_approval_deny(&"z".repeat(64), None).is_err());
    }
}
