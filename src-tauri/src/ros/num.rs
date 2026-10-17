pub fn split_addr(a: &str) -> (&str, u8) {
    let parts: Vec<&str> = a.split('/').collect();
    let ip = parts[0];
    let len = if parts.len() > 1 {
        parts[1].parse().unwrap_or(32)
    } else {
        32
    };
    (ip, len)
}

pub fn mask_of(len: u8) -> String {
    let m = if len == 0 {
        0
    } else if len >= 32 {
        0xFFFF_FFFF
    } else {
        0xFFFFFFFF_u32 << (32 - len)
    };
    format!(
        "{}.{}.{}.{}",
        (m >> 24) & 255,
        (m >> 16) & 255,
        (m >> 8) & 255,
        m & 255
    )
}

pub fn len_of_mask(mask: &str) -> Option<u8> {
    let parts: Vec<&str> = mask.split('.').collect();
    if parts.len() != 4 {
        return None;
    }
    let mut num: u32 = 0;
    for p in parts {
        let val: u32 = p.parse().ok()?;
        num = num * 256 + val;
    }
    let mut count = 0;
    let mut started = false;
    for i in (0..32).rev() {
        let bit = (num >> i) & 1;
        if bit == 1 {
            if started && count != (31 - i) {
                return None;
            }
            started = true;
            count += 1;
        }
    }
    Some(count)
}

pub fn win_mac(mac: &str) -> String {
    mac.replace(':', "-").to_uppercase()
}

pub fn uptime_of(ms: u64) -> String {
    let sec = ms / 1000;
    let days = sec / 86400;
    let hours = (sec % 86400) / 3600;
    let mins = (sec % 3600) / 60;
    let secs = sec % 60;

    let mut parts = Vec::new();
    if days > 0 {
        parts.push(format!("{}d", days));
    }
    if hours > 0 || days > 0 {
        parts.push(format!("{:02}h", hours));
    }
    if mins > 0 || hours > 0 || days > 0 {
        parts.push(format!("{:02}m", mins));
    }
    parts.push(format!("{:02}s", secs));

    parts.join(" ")
}
