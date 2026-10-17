use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct PingArgs {
    pub count: u32,
    pub size: u32,
    pub target: Option<String>,
}

pub fn parse_ping_args(tokens: &[String], q: &HashMap<String, String>) -> PingArgs {
    let mut count = 4;
    let mut size = 56;
    let mut target = None;

    if let Some(c_str) = q.get("count") {
        if let Ok(c) = c_str.parse::<u32>() {
            count = c;
        }
    }
    if let Some(s_str) = q.get("size") {
        if let Ok(s) = s_str.parse::<u32>() {
            size = s;
        }
    }

    let mut i = 0;
    while i < tokens.len() {
        let tok = &tokens[i];
        if tok.contains('=') {
            i += 1;
            continue;
        }
        if tok == "-n" || tok == "-c" {
            if i + 1 < tokens.len() {
                if let Ok(c) = tokens[i + 1].parse::<u32>() {
                    count = c;
                }
                i += 2;
                continue;
            }
        }
        if tok == "-l" || tok == "-s" {
            if i + 1 < tokens.len() {
                if let Ok(s) = tokens[i + 1].parse::<u32>() {
                    size = s;
                }
                i += 2;
                continue;
            }
        }
        if !tok.starts_with('-') && target.is_none() {
            target = Some(tok.clone());
        }
        i += 1;
    }

    PingArgs {
        count: count.min(100).max(1),
        size,
        target,
    }
}
