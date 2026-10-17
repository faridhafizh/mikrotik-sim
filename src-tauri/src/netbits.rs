use serde::{Deserialize, Serialize};

pub fn n2(ip: &str) -> u32 {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 {
        return 0;
    }
    let mut num: u32 = 0;
    for p in parts {
        let val: u32 = p.parse().unwrap_or(0);
        num = num * 256 + val;
    }
    num
}

pub fn to_ip(n: u32) -> String {
    format!(
        "{}.{}.{}.{}",
        (n >> 24) & 255,
        (n >> 16) & 255,
        (n >> 8) & 255,
        n & 255
    )
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedCidr {
    pub ip: String,
    pub len: u8,
}

pub fn parse_cidr(c: &str) -> ParsedCidr {
    let parts: Vec<&str> = c.split('/').collect();
    let ip = parts[0].to_string();
    let len = if parts.len() > 1 {
        parts[1].parse::<u8>().unwrap_or(32)
    } else {
        32
    };
    ParsedCidr { ip, len }
}

pub fn msk(len: u8) -> u32 {
    if len == 0 {
        0
    } else if len >= 32 {
        0xFFFF_FFFF
    } else {
        0xFFFFFFFF_u32 << (32 - len)
    }
}

pub fn in_net(cidr: &str, ip: &str) -> bool {
    let parsed = parse_cidr(cidr);
    let ip_num = n2(ip);
    let net_num = n2(&parsed.ip);
    let mask = msk(parsed.len);
    (net_num & mask) == (ip_num & mask)
}

pub fn net_of(cidr: &str) -> String {
    let parsed = parse_cidr(cidr);
    let net_num = n2(&parsed.ip) & msk(parsed.len);
    format!("{}/{}", to_ip(net_num), parsed.len)
}

pub fn valid_ip(ip: &str) -> bool {
    if ip.is_empty() {
        return false;
    }
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    for p in parts {
        match p.parse::<u32>() {
            Ok(v) => {
                if v > 255 {
                    return false;
                }
            }
            Err(_) => return false,
        }
    }
    true
}

fn expand6(ip: &str) -> Option<Vec<u16>> {
    let seg: Vec<&str> = ip.split("::").collect();
    if seg.len() > 2 {
        return None;
    }
    let head: Vec<&str> = if !seg[0].is_empty() {
        seg[0].split(':').collect()
    } else {
        Vec::new()
    };
    let tail: Vec<&str> = if seg.len() == 2 && !seg[1].is_empty() {
        seg[1].split(':').collect()
    } else {
        Vec::new()
    };

    if seg.len() == 1 && head.len() != 8 {
        return None;
    }

    let miss = 8_isize - head.len() as isize - tail.len() as isize;
    if miss < 0 || (seg.len() == 2 && miss < 1) {
        return None;
    }

    let mut out = Vec::new();
    for h in head {
        out.push(u16::from_str_radix(h, 16).ok()?);
    }
    for _ in 0..miss {
        out.push(0);
    }
    for t in tail {
        out.push(u16::from_str_radix(t, 16).ok()?);
    }

    if out.len() == 8 {
        Some(out)
    } else {
        None
    }
}

pub fn valid_ip6(ip: &str) -> bool {
    if ip.is_empty() {
        return false;
    }
    if !ip.chars().all(|c| c.is_ascii_hexdigit() || c == ':') {
        return false;
    }
    expand6(ip).is_some()
}

pub fn parse6(c: &str) -> ParsedCidr {
    let parts: Vec<&str> = c.split('/').collect();
    let ip = parts[0].to_string();
    let len = if parts.len() > 1 {
        parts[1].parse::<u8>().unwrap_or(128)
    } else {
        128
    };
    ParsedCidr { ip, len }
}

pub fn in_net6(cidr: &str, ip: &str) -> bool {
    let parts: Vec<&str> = cidr.split('/').collect();
    let a_str = parts[0];
    let len: u8 = if parts.len() > 1 {
        parts[1].parse().unwrap_or(128)
    } else {
        128
    };

    let a = match expand6(a_str) {
        Some(v) => v,
        None => return false,
    };
    let i = match expand6(ip) {
        Some(v) => v,
        None => return false,
    };

    if len > 128 {
        return false;
    }

    for idx in 0..8 {
        let bit_offset = idx * 16;
        let b = if (len as usize) <= bit_offset {
            0
        } else if (len as usize) >= bit_offset + 16 {
            16
        } else {
            len as usize - bit_offset
        };

        let m: u16 = if b == 0 {
            0
        } else {
            ((0xFFFF_u32 << (16 - b)) & 0xFFFF) as u16
        };

        if (a[idx] & m) != (i[idx] & m) {
            return false;
        }
    }

    true
}

pub fn valid_cidr(c: &str) -> bool {
    let parsed = parse_cidr(c);
    valid_ip(&parsed.ip) && parsed.len <= 32
}

pub fn rate(v: &str) -> Option<f64> {
    let s = v.trim();
    if s.is_empty() {
        return None;
    }

    let mut num_str = String::new();
    let mut unit_str = String::new();

    for c in s.chars() {
        if c.is_ascii_digit() || c == '.' {
            num_str.push(c);
        } else {
            unit_str.push(c);
        }
    }

    let num: f64 = num_str.parse().ok()?;
    let mult = match unit_str.to_lowercase().as_str() {
        "k" => 0.001,
        "m" | "" => 1.0,
        "g" => 1000.0,
        _ => return None,
    };

    Some(num * mult)
}

pub fn kv(tokens: &[String]) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    for t in tokens {
        if let Some(idx) = t.find('=') {
            let k = t[..idx].to_string();
            let v = t[idx + 1..].to_string();
            map.insert(k, v);
        }
    }
    map
}

pub fn tokenize(line: &str) -> Vec<String> {
    let src = line.trim().trim_start_matches('/');
    let mut out = Vec::new();
    let chars: Vec<char> = src.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        if chars[i].is_whitespace() {
            i += 1;
            continue;
        }

        let mut tok = String::new();
        while i < chars.len() && !chars[i].is_whitespace() {
            let c = chars[i];
            if c == '"' || c == '\'' {
                let quote = c;
                let mut end = None;
                for j in (i + 1)..chars.len() {
                    if chars[j] == quote {
                        end = Some(j);
                        break;
                    }
                }
                if let Some(e) = end {
                    for j in (i + 1)..e {
                        tok.push(chars[j]);
                    }
                    i = e + 1;
                    continue;
                } else {
                    tok.push(c);
                    i += 1;
                    continue;
                }
            }
            tok.push(c);
            i += 1;
        }
        out.push(tok);
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ip_helpers() {
        assert_eq!(n2("192.168.1.1"), 0xC0A80101);
        assert_eq!(to_ip(0xC0A80101), "192.168.1.1");
        assert!(valid_ip("192.168.1.1"));
        assert!(!valid_ip("256.0.0.1"));
        assert!(in_net("192.168.1.0/24", "192.168.1.50"));
        assert!(!in_net("192.168.1.0/24", "192.168.2.50"));
    }

    #[test]
    fn test_ip6_helpers() {
        assert!(valid_ip6("2001:db8::1"));
        assert!(in_net6("2001:db8::/32", "2001:db8::1"));
        assert!(!in_net6("2001:db8::/32", "2001:db9::1"));
    }

    #[test]
    fn test_tokenize() {
        let tokens = tokenize("/ip address add address=192.168.1.1/24 comment=\"test comment\"");
        assert_eq!(tokens[0], "ip");
        assert_eq!(tokens[1], "address");
        assert_eq!(tokens[2], "add");
        assert_eq!(tokens[3], "address=192.168.1.1/24");
        assert_eq!(tokens[4], "comment=test comment");
    }
}
