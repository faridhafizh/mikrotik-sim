use crate::engine::l2_peers;
use crate::models::{Device, Network};
use crate::netbits::{in_net, parse_cidr};
use crate::ros::mac::mac_of;

#[derive(Debug, Clone)]
pub struct ArpEntry {
    pub ip: String,
    pub mac: String,
    pub iface: String,
    pub name: String,
}

pub fn arp_entries(net: &Network, d: &Device) -> Vec<ArpEntry> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();

    let blocked: std::collections::HashSet<String> = d
        .arp_blocked
        .as_ref()
        .map(|list| list.iter().cloned().collect())
        .unwrap_or_default();

    for i in &d.ifaces {
        if i.addr.is_none() || i.disabled {
            continue;
        }
        let addr = i.addr.as_ref().unwrap();
        let my_ip = parse_cidr(addr).ip;

        for p in l2_peers(net, &d.id, &i.name) {
            if let Some(pd) = net.devices.get(&p.dev) {
                if let Some(pi) = pd.ifaces.iter().find(|x| x.name == p.if_) {
                    if let Some(pi_addr) = &pi.addr {
                        let peer_ip = parse_cidr(pi_addr).ip;
                        if peer_ip != my_ip
                            && in_net(addr, &peer_ip)
                            && !blocked.contains(&peer_ip)
                            && !seen.contains(&peer_ip)
                        {
                            seen.insert(peer_ip.clone());
                            out.push(ArpEntry {
                                ip: peer_ip,
                                mac: mac_of(&pd.id, &pi.name),
                                iface: i.name.clone(),
                                name: pd.name.clone(),
                            });
                        }
                    }
                }
            }
        }
    }

    out
}

#[derive(Debug, Clone)]
pub struct NeighborEntry {
    pub addr: String,
    pub iface: String,
    pub state: String,
}

pub fn proto_neighbors(net: &Network, d: &Device, proto: &str) -> Vec<NeighborEntry> {
    let mut out = Vec::new();
    let act = |dev: &Device, i: &crate::models::Interface| -> bool {
        if let Some(addr) = &i.addr {
            let list = if proto == "rip" {
                dev.rip.as_ref()
            } else {
                dev.ospf.as_ref()
            };
            if let Some(nets) = list {
                let ip = parse_cidr(addr).ip;
                return nets.iter().any(|n| in_net(n, &ip));
            }
        }
        false
    };

    for ia in d.ifaces.iter().filter(|i| act(d, i)) {
        for p in l2_peers(net, &d.id, &ia.name) {
            if let Some(b) = net.devices.get(&p.dev) {
                if b.type_ == "router" {
                    if let Some(ib) = b.ifaces.iter().find(|x| x.name == p.if_) {
                        if act(b, ib) {
                            if let (Some(addr_a), Some(addr_b)) = (&ia.addr, &ib.addr) {
                                let ip_b = parse_cidr(addr_b).ip;
                                if in_net(addr_a, &ip_b) {
                                    out.push(NeighborEntry {
                                        addr: ip_b,
                                        iface: ia.name.clone(),
                                        state: "FULL".to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    out
}
