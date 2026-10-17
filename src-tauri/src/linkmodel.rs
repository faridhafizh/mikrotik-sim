use crate::models::{Device, Link, LinkStatusInfo, Network};

pub fn port_kind(dev: Option<&Device>, if_name: &str) -> Option<String> {
    if let Some(d) = dev {
        if let Some(iface) = d.ifaces.iter().find(|i| i.name == if_name) {
            if let Some(kind) = &iface.kind {
                return Some(kind.clone());
            }
        }
    }
    None
}

pub fn medium_of(kind: &str) -> &'static str {
    match kind {
        "SFP" | "SFPP" => "fiber",
        _ => "copper",
    }
}

pub fn speed_of_kind(kind: &str) -> u32 {
    match kind {
        "FE" => 100,
        "GBE" | "SFP" => 1000,
        "SFPP" => 10000,
        _ => 1000,
    }
}

pub fn cable_medium(cable: &str) -> &'static str {
    match cable {
        "fiber1g" | "fiber10g" => "fiber",
        _ => "copper",
    }
}

pub fn cable_max(cable: &str) -> u32 {
    match cable {
        "cat5e" => 100,
        "cat6" => 1000,
        "fiber1g" => 1000,
        "fiber10g" => 10000,
        _ => 1000,
    }
}

pub fn link_status(net: &Network, link: &Link) -> LinkStatusInfo {
    let dev_a = net.devices.get(&link.a.dev);
    let dev_b = net.devices.get(&link.b.dev);

    let k_a = port_kind(dev_a, &link.a.if_).unwrap_or_else(|| "GBE".to_string());
    let k_b = port_kind(dev_b, &link.b.if_).unwrap_or_else(|| "GBE".to_string());
    let ck = if link.cable.is_empty() {
        "cat6"
    } else {
        &link.cable
    };

    let ma = medium_of(&k_a);
    let mb = medium_of(&k_b);
    let mc = cable_medium(ck);

    let off_a = dev_a.map_or(false, |d| {
        d.ifaces.iter().any(|i| i.name == link.a.if_ && i.disabled)
    });
    let off_b = dev_b.map_or(false, |d| {
        d.ifaces.iter().any(|i| i.name == link.b.if_ && i.disabled)
    });

    if off_a || off_b {
        return LinkStatusInfo {
            up: false,
            speed: 0,
            reason: "port disabled".to_string(),
        };
    }

    let up = ma == mb && mb == mc;
    let speed = if up {
        let sa = speed_of_kind(&k_a);
        let sb = speed_of_kind(&k_b);
        let sc = cable_max(ck);
        sa.min(sb).min(sc)
    } else {
        0
    };

    LinkStatusInfo {
        up,
        speed,
        reason: if up {
            "".to_string()
        } else {
            format!("medium mismatch: {}/{}/{}", ma, mb, mc)
        },
    }
}

pub fn speed_label(speed: u32) -> &'static str {
    if speed >= 10000 {
        "10G"
    } else if speed >= 1000 {
        "1G"
    } else {
        "100M"
    }
}
