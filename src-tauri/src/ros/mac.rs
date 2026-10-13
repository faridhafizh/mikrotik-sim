pub fn mac_of(dev_id: &str, if_name: &str) -> String {
    let mut h: u32 = 0;
    let s = format!("{}{}", dev_id, if_name);
    for c in s.chars() {
        h = h.wrapping_mul(31).wrapping_add(c as u32);
    }
    let b1 = (h >> 16) & 255;
    let b2 = (h >> 8) & 255;
    let b3 = h & 255;
    format!("4C:5E:0C:{:02X}:{:02X}:{:02X}", b1, b2, b3)
}
