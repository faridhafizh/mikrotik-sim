use crate::linkmodel::{link_status, speed_label};
use crate::models::*;
use crate::netbits::*;
use std::collections::{HashMap, HashSet};

pub fn owns6(d: &Device, ip: &str) -> bool {
    d.ifaces.iter().any(|i| {
        if let Some(addr6) = &i.addr6 {
            parse6(addr6).ip == ip
        } else {
            false
        }
    })
}

pub fn addr6_ip(i: &Interface) -> Option<String> {
    i.addr6.as_ref().map(|a| parse6(a).ip)
}

pub fn owns(d: &Device, ip: &str) -> bool {
    d.ifaces.iter().any(|i| {
        if let Some(addr) = &i.addr {
            parse_cidr(addr).ip == ip
        } else {
            false
        }
    })
}

#[derive(Debug, Clone)]
pub struct RouteLookup {
    pub len: u8,
    pub ad: u8,
    pub iface: String,
    pub nh: String,
}

pub fn lookup(d: &Device, ip: &str) -> Option<RouteLookup> {
    let mut best: Option<RouteLookup> = None;

    let mut take = |len: u8, ad: u8, iface: String, nh: String| {
        let update = match &best {
            None => true,
            Some(b) => len > b.len || (len == b.len && ad < b.ad),
        };
        if update {
            best = Some(RouteLookup { len, ad, iface, nh });
        }
    };

    for i in &d.ifaces {
        if let Some(addr) = &i.addr {
            if in_net(addr, ip) {
                take(parse_cidr(addr).len, 0, i.name.clone(), ip.to_string());
            }
        }
    }

    let mut combined_routes: Vec<Route> = d
        .routes
        .iter()
        .map(|r| {
            let mut r_clone = r.clone();
            if r_clone.ad.is_none() {
                r_clone.ad = Some(1);
            }
            r_clone
        })
        .collect();

    for dr in &d.dyn_routes {
        combined_routes.push(Route {
            dst: dr.dst.clone(),
            gw: dr.gw.clone(),
            dhcp: false,
            ad: Some(dr.ad),
            m: Some(dr.m),
            proto: Some(dr.proto.clone()),
        });
    }

    for r in combined_routes {
        if !in_net(&r.dst, ip) {
            continue;
        }
        if let Some(c) = d.ifaces.iter().find(|i| {
            if let Some(addr) = &i.addr {
                in_net(addr, &r.gw)
            } else {
                false
            }
        }) {
            take(
                parse_cidr(&r.dst).len,
                r.ad.unwrap_or(1),
                c.name.clone(),
                r.gw.clone(),
            );
        }
    }

    best
}

pub fn lookup6(d: &Device, ip: &str) -> Option<RouteLookup> {
    let mut best: Option<RouteLookup> = None;

    let mut take = |len: u8, ad: u8, iface: String, nh: String| {
        let update = match &best {
            None => true,
            Some(b) => len > b.len || (len == b.len && ad < b.ad),
        };
        if update {
            best = Some(RouteLookup { len, ad, iface, nh });
        }
    };

    for i in &d.ifaces {
        if let Some(addr6) = &i.addr6 {
            if in_net6(addr6, ip) {
                take(parse6(addr6).len, 0, i.name.clone(), ip.to_string());
            }
        }
    }

    for r in &d.routes6 {
        if !in_net6(&r.dst, ip) {
            continue;
        }
        if let Some(c) = d.ifaces.iter().find(|i| {
            if let Some(addr6) = &i.addr6 {
                in_net6(addr6, &r.gw)
            } else {
                false
            }
        }) {
            take(parse6(&r.dst).len, 1, c.name.clone(), r.gw.clone());
        }
    }

    best
}

#[derive(Debug, Clone)]
pub struct PeerLinkEnd {
    pub dev: String,
    pub if_: String,
}

pub fn peer_of(net: &Network, d_id: &str, p_if: &str) -> Option<PeerLinkEnd> {
    for l in &net.links {
        if l.a.dev == d_id && l.a.if_ == p_if {
            return Some(PeerLinkEnd {
                dev: l.b.dev.clone(),
                if_: l.b.if_.clone(),
            });
        }
        if l.b.dev == d_id && l.b.if_ == p_if {
            return Some(PeerLinkEnd {
                dev: l.a.dev.clone(),
                if_: l.a.if_.clone(),
            });
        }
    }
    None
}

pub fn port_cfg<'a>(sw: &'a Device, p: &str) -> PortConfig {
    if let Some(ports) = &sw.ports {
        if let Some(c) = ports.get(p) {
            return c.clone();
        }
    }
    PortConfig {
        mode: "access".to_string(),
        vlan: 1,
        vlans: None,
    }
}

pub fn iface_status(net: &Network, d: &Device, name: &str) -> String {
    let iface = d.ifaces.iter().find(|i| i.name == name);
    if let Some(i) = iface {
        if i.disabled {
            return "disabled".to_string();
        }
    }

    let lk = net
        .links
        .iter()
        .find(|l| (l.a.dev == d.id && l.a.if_ == name) || (l.b.dev == d.id && l.b.if_ == name));

    if let Some(l) = lk {
        let st = link_status(net, l);
        if st.up {
            format!("running {}", speed_label(st.speed))
        } else {
            "no link (mismatch)".to_string()
        }
    } else {
        "no link".to_string()
    }
}

pub fn link_live(net: &Network, l: &Link) -> bool {
    link_status(net, l).up
}

#[derive(Debug, Clone)]
pub struct WifiInfo {
    pub ap: String,
    pub cl: String,
    pub dbm: i32,
}

const RANGE: f64 = 240.0;

fn dist(a: &Device, b: &Device) -> f64 {
    ((a.x - b.x).powi(2) + (a.y - b.y).powi(2)).sqrt()
}

pub fn wifi_links(net: &Network) -> Vec<WifiInfo> {
    let aps: Vec<&Device> = net
        .devices
        .values()
        .filter(|d| {
            d.type_ == "router"
                && d.wlan.as_ref().map_or(false, |w| {
                    !w.ssid.is_empty()
                        && (w.mode.as_deref() == Some("ap-bridge") || w.mode.is_none())
                })
        })
        .collect();

    let mut out = Vec::new();

    let clients: Vec<&Device> = net
        .devices
        .values()
        .filter(|d| {
            (d.type_ == "laptop" && d.wifi.is_some())
                || (d.type_ == "router"
                    && d.wlan.as_ref().map_or(false, |w| {
                        w.mode.as_deref() == Some("station") && !w.ssid.is_empty()
                    }))
        })
        .collect();

    for c in clients {
        let cred = if c.type_ == "laptop" {
            c.wifi.as_ref()
        } else {
            c.wlan.as_ref()
        };

        if cred.is_none() {
            continue;
        }
        let cred = cred.unwrap();

        if c.type_ == "router"
            && c.wlan
                .as_ref()
                .map_or(true, |w| w.mode.as_deref() != Some("station"))
        {
            continue;
        }

        let mut candidate_aps: Vec<(&Device, f64)> = aps
            .iter()
            .filter_map(|&a| {
                if a.id != c.id {
                    if let Some(a_wlan) = &a.wlan {
                        if a_wlan.ssid == cred.ssid && a_wlan.pass == cred.pass {
                            let d = dist(a, c);
                            if d <= RANGE {
                                return Some((a, d));
                            }
                        }
                    }
                }
                None
            })
            .collect();

        candidate_aps.sort_by(|x, y| x.1.partial_cmp(&y.1).unwrap());

        if let Some((ap, d_val)) = candidate_aps.first() {
            let dbm = (-35.0 - d_val * 0.25).round() as i32;
            out.push(WifiInfo {
                ap: ap.id.clone(),
                cl: c.id.clone(),
                dbm,
            });
        }
    }

    out
}

pub fn wifi_status(net: &Network, c: &Device) -> String {
    if c.wifi.is_none() {
        return "tidak terhubung ke Wi-Fi".to_string();
    }
    let c_wifi = c.wifi.as_ref().unwrap();

    let w = wifi_links(net).into_iter().find(|x| x.cl == c.id);
    if let Some(link) = w {
        return format!("terhubung ke {} ({} dBm)", c_wifi.ssid, link.dbm);
    }

    let aps: Vec<&Device> = net
        .devices
        .values()
        .filter(|a| a.type_ == "router" && a.wlan.as_ref().map_or(false, |w| w.ssid == c_wifi.ssid))
        .collect();

    if aps.is_empty() {
        return format!("SSID {} tidak ditemukan", c_wifi.ssid);
    }

    if !aps.iter().any(|a| dist(a, c) <= RANGE) {
        return "di luar jangkauan: dekatkan laptop ke AP".to_string();
    }

    "autentikasi gagal: password salah".to_string()
}

fn is_l2(d: &Device) -> bool {
    d.type_ == "switch"
        || (d.type_ == "router"
            && d.ifaces
                .iter()
                .any(|i| i.members.as_ref().map_or(false, |m| !m.is_empty())))
}

fn stp_on(d: &Device) -> bool {
    d.stp.as_deref() != Some("no")
}

pub fn stp_blocked(net: &Network) -> HashSet<String> {
    let mut blocked = HashSet::new();
    let on: Vec<&Device> = net
        .devices
        .values()
        .filter(|d| is_l2(d) && stp_on(d))
        .collect();

    if on.is_empty() {
        return blocked;
    }

    let ids: HashSet<String> = on.iter().map(|d| d.id.clone()).collect();
    let mut seen = HashSet::new();
    let mut q = Vec::new();
    let mut disc: HashMap<String, String> = HashMap::new();

    let mut roots: Vec<String> = on.iter().map(|d| d.id.clone()).collect();
    roots.sort();

    for root in roots {
        if seen.contains(&root) {
            continue;
        }
        seen.insert(root.clone());
        q.push(root.clone());

        while !q.is_empty() {
            let u = q.remove(0);
            for l in &net.links {
                let (v, uif, vif) = if l.a.dev == u {
                    (l.b.dev.clone(), l.a.if_.clone(), l.b.if_.clone())
                } else if l.b.dev == u {
                    (l.a.dev.clone(), l.b.if_.clone(), l.a.if_.clone())
                } else {
                    continue;
                };

                if !ids.contains(&v) {
                    continue;
                }
                if !link_live(net, l) {
                    continue;
                }

                let key = format!("{}:{}-{}:{}", l.a.dev, l.a.if_, l.b.dev, l.b.if_);
                if !seen.contains(&v) {
                    seen.insert(v.clone());
                    q.push(v.clone());
                    disc.insert(v, key);
                } else if disc.get(&u) != Some(&key) && disc.get(&v) != Some(&key) {
                    blocked.insert(format!("{}:{}", u, uif));
                    blocked.insert(format!("{}:{}", v, vif));
                }
            }
        }
    }

    blocked
}

pub fn peers_of(net: &Network, d_id: &str, p_if: &str) -> Vec<PeerLinkEnd> {
    if p_if == "wlan0" {
        return wifi_links(net)
            .into_iter()
            .filter(|w| w.cl == d_id)
            .map(|w| PeerLinkEnd {
                dev: w.ap,
                if_: "wlan1".to_string(),
            })
            .collect();
    }

    if p_if == "wlan1" {
        if let Some(me) = net.devices.get(d_id) {
            if me.type_ == "router" {
                if me
                    .wlan
                    .as_ref()
                    .map_or(false, |w| w.mode.as_deref() == Some("station"))
                {
                    return wifi_links(net)
                        .into_iter()
                        .filter(|w| w.cl == d_id)
                        .map(|w| PeerLinkEnd {
                            dev: w.ap,
                            if_: "wlan1".to_string(),
                        })
                        .collect();
                } else {
                    return wifi_links(net)
                        .into_iter()
                        .filter(|w| w.ap == d_id)
                        .map(|w| PeerLinkEnd {
                            dev: w.cl.clone(),
                            if_: if net.devices.get(&w.cl).map_or("", |x| &x.type_) == "router" {
                                "wlan1".to_string()
                            } else {
                                "wlan0".to_string()
                            },
                        })
                        .collect();
                }
            }
        }
    }

    let o = peer_of(net, d_id, p_if);
    let lk = net
        .links
        .iter()
        .find(|l| (l.a.dev == d_id && l.a.if_ == p_if) || (l.b.dev == d_id && l.b.if_ == p_if));

    let out = if let (Some(peer), Some(l)) = (o, lk) {
        if link_live(net, l) {
            vec![peer]
        } else {
            vec![]
        }
    } else {
        vec![]
    };

    let blk = stp_blocked(net);
    out.into_iter()
        .filter(|b| {
            let dev_a = net.devices.get(d_id);
            let dev_b = net.devices.get(&b.dev);
            if let (Some(a), Some(b_dev)) = (dev_a, dev_b) {
                if !is_l2(a) || !is_l2(b_dev) {
                    return true;
                }
                if a.stp.as_deref() == Some("no") && b_dev.stp.as_deref() == Some("no") {
                    return false;
                }
            }
            !blk.contains(&format!("{}:{}", d_id, p_if))
                && !blk.contains(&format!("{}:{}", b.dev, b.if_))
        })
        .collect()
}

pub fn l2_peers(net: &Network, dev_id: &str, ifn: &str) -> Vec<PeerLinkEnd> {
    let src_dev = match net.devices.get(dev_id) {
        Some(d) => d,
        None => return Vec::new(),
    };
    let src = match src_dev.ifaces.iter().find(|i| i.name == ifn) {
        Some(i) => i,
        None => return Vec::new(),
    };

    let mut out = Vec::new();
    let mut seen = HashSet::new();

    #[derive(Debug, Clone)]
    struct QueueItem {
        dev: String,
        port: String,
        tag: Option<u16>,
    }

    let initial_ports = src.members.clone().unwrap_or_else(|| {
        vec![src.parent.clone().unwrap_or_else(|| ifn.to_string())]
    });

    let mut q: Vec<QueueItem> = initial_ports
        .into_iter()
        .map(|port| QueueItem {
            dev: dev_id.to_string(),
            port,
            tag: src.vlan,
        })
        .collect();

    while !q.is_empty() {
        let item = q.remove(0);
        let k = format!("{}{}{:?}", item.dev, item.port, item.tag);
        if seen.contains(&k) {
            continue;
        }
        seen.insert(k);

        for p in peers_of(net, &item.dev, &item.port) {
            if let Some(pd) = net.devices.get(&p.dev) {
                if pd.type_ == "switch" {
                    let c = port_cfg(pd, &p.if_);
                    if c.mode == "access" && item.tag.is_some() {
                        continue;
                    }
                    let v = if c.mode == "access" {
                        c.vlan
                    } else {
                        item.tag.unwrap_or(1)
                    };
                    if c.mode == "trunk" {
                        if v != 1 {
                            if let Some(vlans) = &c.vlans {
                                if !vlans.contains(&v) {
                                    continue;
                                }
                            } else {
                                continue;
                            }
                        }
                    }
                    for x in &pd.ifaces {
                        if x.name == p.if_ {
                            continue;
                        }
                        let e = port_cfg(pd, &x.name);
                        if e.mode == "access" && e.vlan == v {
                            q.push(QueueItem {
                                dev: pd.id.clone(),
                                port: x.name.clone(),
                                tag: None,
                            });
                        } else if e.mode == "trunk" && (v == 1 || e.vlans.as_ref().map_or(false, |vl| vl.contains(&v))) {
                            q.push(QueueItem {
                                dev: pd.id.clone(),
                                port: x.name.clone(),
                                tag: if v == 1 { None } else { Some(v) },
                            });
                        }
                    }
                } else if let Some(tag) = item.tag {
                    let sub = pd.ifaces.iter().find(|i| i.parent.as_deref() == Some(&p.if_) && i.vlan == Some(tag));
                    if let Some(s) = sub {
                        out.push(PeerLinkEnd {
                            dev: pd.id.clone(),
                            if_: s.name.clone(),
                        });
                    }
                } else {
                    let br = pd.ifaces.iter().find(|i| {
                        i.members.as_ref().map_or(false, |m| m.contains(&p.if_))
                    });
                    if let Some(b) = br {
                        out.push(PeerLinkEnd {
                            dev: pd.id.clone(),
                            if_: b.name.clone(),
                        });
                        if let Some(members) = &b.members {
                            for m in members {
                                if m != &p.if_ {
                                    q.push(QueueItem {
                                        dev: pd.id.clone(),
                                        port: m.clone(),
                                        tag: None,
                                    });
                                }
                            }
                        }
                    } else {
                        out.push(PeerLinkEnd {
                            dev: pd.id.clone(),
                            if_: p.if_.clone(),
                        });
                        if pd.type_ == "router"
                            && p.if_ == "wlan1"
                            && pd.wlan.as_ref().map_or(false, |w| {
                                !w.ssid.is_empty()
                                    && (w.mode.as_deref() == Some("ap-bridge") || w.mode.is_none())
                            })
                        {
                            for w in wifi_links(net).into_iter().filter(|w| w.ap == pd.id) {
                                let cl_dev = net.devices.get(&w.cl);
                                out.push(PeerLinkEnd {
                                    dev: w.cl.clone(),
                                    if_: if cl_dev.map_or("", |x| &x.type_) == "router" {
                                        "wlan1".to_string()
                                    } else {
                                        "wlan0".to_string()
                                    },
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    out.into_iter()
        .filter(|p| !(p.dev == dev_id && p.if_ == ifn))
        .collect()
}

pub fn converge(net: &mut Network) {
    let router_ids: Vec<String> = net
        .devices
        .values()
        .filter(|d| d.type_ == "router")
        .map(|d| d.id.clone())
        .collect();

    for id in &router_ids {
        if let Some(r) = net.devices.get_mut(id) {
            r.dyn_routes = Vec::new();
        }
    }

    let protocols = [
        ("rip", 120_u8, 1_u32),
        ("ospf", 110_u8, 10_u32),
    ];

    for (proto, ad, w) in protocols {
        let on_ids: Vec<String> = router_ids
            .iter()
            .filter(|&id| {
                let d = &net.devices[id];
                if proto == "rip" {
                    d.rip.as_ref().map_or(false, |list| !list.is_empty())
                } else {
                    d.ospf.as_ref().map_or(false, |list| !list.is_empty())
                }
            })
            .cloned()
            .collect();

        let act = |d: &Device, i: &Interface| -> bool {
            if let Some(addr) = &i.addr {
                let list = if proto == "rip" {
                    d.rip.as_ref()
                } else {
                    d.ospf.as_ref()
                };
                if let Some(nets) = list {
                    let ip = parse_cidr(addr).ip;
                    return nets.iter().any(|n| in_net(n, &ip));
                }
            }
            false
        };

        #[derive(Clone)]
        struct Edge {
            id: String,
            nh: String,
        }

        let mut adj: HashMap<String, Vec<Edge>> = HashMap::new();
        for id in &on_ids {
            adj.insert(id.clone(), Vec::new());
        }

        for a_id in &on_ids {
            let a = &net.devices[a_id];
            for ia in a.ifaces.iter().filter(|i| act(a, i)) {
                for p in l2_peers(net, a_id, &ia.name) {
                    if let Some(b) = net.devices.get(&p.dev) {
                        let ib = b.ifaces.iter().find(|i| i.name == p.if_);
                        if b.type_ == "router" && adj.contains_key(&b.id) {
                            if let Some(ib_if) = ib {
                                if act(b, ib_if) {
                                    if let (Some(addr_a), Some(addr_b)) = (&ia.addr, &ib_if.addr) {
                                        if in_net(addr_a, &parse_cidr(addr_b).ip) {
                                            adj.get_mut(a_id).unwrap().push(Edge {
                                                id: b.id.clone(),
                                                nh: parse_cidr(addr_b).ip,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        for r_id in &on_ids {
            let mut dist: HashMap<String, u32> = HashMap::new();
            dist.insert(r_id.clone(), 0);
            let mut first: HashMap<String, String> = HashMap::new();
            let mut todo = vec![r_id.clone()];

            while !todo.is_empty() {
                let u = todo.remove(0);
                if let Some(edges) = adj.get(&u) {
                    for e in edges {
                        let nd = dist.get(&u).unwrap() + w;
                        let curr_dist = dist.get(&e.id).copied().unwrap_or(1_000_000_000);
                        if nd < curr_dist && (proto != "rip" || nd <= 15) {
                            dist.insert(e.id.clone(), nd);
                            let f_nh = if u == *r_id {
                                e.nh.clone()
                            } else {
                                first.get(&u).unwrap().clone()
                            };
                            first.insert(e.id.clone(), f_nh);
                            todo.push(e.id.clone());
                        }
                    }
                }
            }

            for x_id in &on_ids {
                if x_id != r_id && dist.contains_key(x_id) {
                    let x_dev = &net.devices[x_id];
                    let mut routes_to_add = Vec::new();

                    for i in x_dev.ifaces.iter().filter(|i| act(x_dev, i)) {
                        if let Some(addr) = &i.addr {
                            let dst = net_of(addr);
                            let r_dev = &net.devices[r_id];
                            if r_dev.ifaces.iter().any(|j| j.addr.as_ref().map_or(false, |a| net_of(a) == dst)) {
                                continue;
                            }

                            let d_val = *dist.get(x_id).unwrap();
                            routes_to_add.push((dst, first.get(x_id).unwrap().clone(), d_val));
                        }
                    }

                    if !routes_to_add.is_empty() {
                        let r_mut = net.devices.get_mut(r_id).unwrap();
                        for (dst, gw, d_val) in routes_to_add {
                            let mut existing_idx = None;
                            for (idx, old) in r_mut.dyn_routes.iter().enumerate() {
                                if old.dst == dst && old.proto == proto {
                                    existing_idx = Some((idx, old.m));
                                    break;
                                }
                            }

                            if let Some((_, old_m)) = existing_idx {
                                if old_m <= d_val {
                                    continue;
                                }
                            }

                            if let Some((idx, _)) = existing_idx {
                                r_mut.dyn_routes.remove(idx);
                            }
                            r_mut.dyn_routes.push(DynamicRoute {
                                dst,
                                gw,
                                ad,
                                m: d_val,
                                proto: proto.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
}

pub fn src_of(d: &Device, ip: &str) -> Option<String> {
    if let Some(r) = lookup(d, ip) {
        if let Some(i) = d.ifaces.iter().find(|x| x.name == r.iface) {
            if let Some(addr) = &i.addr {
                return Some(parse_cidr(addr).ip);
            }
        }
    }
    None
}

pub fn src6_of(d: &Device, ip: &str) -> Option<String> {
    if let Some(r) = lookup6(d, ip) {
        if let Some(i) = d.ifaces.iter().find(|x| x.name == r.iface) {
            return addr6_ip(i);
        }
    }
    None
}

pub fn trace6(net: &Network, src_id: &str, dst_ip: &str, src_ip: &str) -> PingResult {
    let mut path = vec![src_id.to_string()];
    let mut hops = Vec::new();

    let mut cur_id = src_id.to_string();
    let _s = src_ip.to_string();

    for _ttl in 0..16 {
        let cur = match net.devices.get(&cur_id) {
            Some(d) => d,
            None => return PingResult { ok: false, path, hops, err: Some("device not found".to_string()) },
        };

        if owns6(cur, dst_ip) {
            return PingResult { ok: true, path, hops, err: None };
        }

        let r = match lookup6(cur, dst_ip) {
            Some(res) => res,
            None => return PingResult { ok: false, path, hops, err: Some(format!("{}: no route to host", cur.name)) },
        };

        let via = l2_peers(net, &cur.id, &r.iface);
        let nxt = via.into_iter().find(|p| {
            if let Some(d) = net.devices.get(&p.dev) {
                if let Some(i) = d.ifaces.iter().find(|i| i.name == p.if_) {
                    if let Some(ip) = addr6_ip(i) {
                        return ip == r.nh;
                    }
                }
            }
            false
        });

        match nxt {
            Some(p) => {
                hops.push(r.nh);
                cur_id = p.dev.clone();
                path.push(cur_id.clone());
            }
            None => return PingResult { ok: false, path, hops, err: Some(format!("{}: host unreachable (ARP failed)", cur.name)) },
        }
    }

    PingResult { ok: false, path, hops, err: Some("TTL exceeded".to_string()) }
}

pub fn ping6(net: &Network, src_id: &str, dst_ip: &str) -> PingResult {
    let src = match net.devices.get(src_id) {
        Some(d) => d,
        None => return PingResult { ok: false, path: vec![src_id.to_string()], hops: Vec::new(), err: Some("Source not found".to_string()) },
    };

    if owns6(src, dst_ip) {
        return PingResult { ok: true, path: vec![src_id.to_string()], hops: Vec::new(), err: None };
    }

    let s0 = match src6_of(src, dst_ip) {
        Some(s) => s,
        None => return PingResult { ok: false, path: vec![src_id.to_string()], hops: Vec::new(), err: Some(format!("{}: no route to host", src.name)) },
    };

    let f = trace6(net, src_id, dst_ip, &s0);
    if !f.ok {
        return f;
    }

    let last_dev = f.path.last().unwrap().clone();
    let b = trace6(net, &last_dev, &s0, dst_ip);
    if !b.ok {
        return PingResult {
            ok: false,
            path: f.path,
            hops: f.hops,
            err: Some(format!("reply hilang: {}", b.err.unwrap_or_default())),
        };
    }

    let mut full_path = f.path;
    if b.path.len() > 1 {
        full_path.extend_from_slice(&b.path[1..]);
    }

    PingResult { ok: true, path: full_path, hops: f.hops, err: None }
}

fn hit_rule(r: &FirewallRule, s: &str, d: &str, proto: &str, dport: &str) -> bool {
    if let Some(src) = &r.src {
        if !src.is_empty() && !in_net(src, s) {
            return false;
        }
    }
    if let Some(dst) = &r.dst {
        if !dst.is_empty() && !in_net(dst, d) {
            return false;
        }
    }
    if let Some(p) = &r.proto {
        if !p.is_empty() && p != proto {
            return false;
        }
    }
    if let Some(dp) = &r.dport {
        if !dp.is_empty() && dp != dport {
            return false;
        }
    }
    true
}

fn drops_rule(d: &Device, chain: &str, s: &str, dst: &str, proto: &str, dport: &str) -> bool {
    if let Some(fw) = &d.fw {
        if let Some(r) = fw.iter().find(|r| r.chain == chain && hit_rule(r, s, dst, proto, dport)) {
            return r.action == "drop";
        }
    }
    false
}

pub fn nat_norm(n: &NatRule) -> NatRule {
    let mut n_clone = n.clone();
    if n_clone.chain.is_empty() {
        n_clone.chain = "srcnat".to_string();
        n_clone.action = "masquerade".to_string();
    }
    n_clone
}

fn cur_to_ip(d: &Device, ifname: Option<&str>) -> Option<String> {
    if let Some(name) = ifname {
        if let Some(i) = d.ifaces.iter().find(|x| x.name == name && x.addr.is_some()) {
            return i.addr.as_ref().map(|a| parse_cidr(a).ip);
        }
    }
    if let Some(i) = d.ifaces.iter().find(|x| x.addr.is_some()) {
        return i.addr.as_ref().map(|a| parse_cidr(a).ip);
    }
    None
}

#[derive(Debug, Clone)]
pub struct TraceXlat {
    pub dev: String,
    pub to: String,
}

#[derive(Debug, Clone)]
pub struct TraceResult {
    pub ok: bool,
    pub path: Vec<String>,
    pub hops: Vec<String>,
    pub xlat: Vec<TraceXlat>,
    pub err: Option<String>,
}

pub fn trace(
    net: &Network,
    src_id: &str,
    dst_ip: &str,
    src_ip: &str,
    nat: bool,
    proto: &str,
    dport: &str,
) -> TraceResult {
    let mut path = vec![src_id.to_string()];
    let mut hops = Vec::new();
    let mut xlat = Vec::new();

    let mut cur_id = src_id.to_string();
    let mut s = src_ip.to_string();
    let mut target_ip = dst_ip.to_string();
    let mut ingress: Option<String> = None;

    for _ttl in 0..16 {
        let cur = match net.devices.get(&cur_id) {
            Some(d) => d,
            None => return TraceResult { ok: false, path, hops, xlat, err: Some("device not found".to_string()) },
        };

        if let Some(nat_rules) = &cur.nat {
            let dr = nat_rules.iter().map(nat_norm).find(|n| {
                n.chain == "dstnat"
                    && (n.proto.as_deref().unwrap_or("").is_empty() || n.proto.as_deref() == Some(proto))
                    && (n.dport.as_deref().unwrap_or("").is_empty() || n.dport.as_deref() == Some(dport))
                    && (n.in_iface.as_deref().unwrap_or("").is_empty() || n.in_iface == ingress)
                    && (n.dst.as_deref().unwrap_or("").is_empty() || in_net(n.dst.as_ref().unwrap(), &target_ip))
            });

            if let Some(dr_rule) = dr {
                let to = if dr_rule.redirect {
                    cur_to_ip(cur, ingress.as_deref())
                } else {
                    dr_rule.to_addr.clone()
                };

                if let Some(to_addr) = to {
                    target_ip = to_addr.clone();
                    let to_str = if let Some(p) = &dr_rule.to_port {
                        format!("{}:{}", to_addr, p)
                    } else {
                        to_addr
                    };
                    xlat.push(TraceXlat { dev: cur.id.clone(), to: to_str });
                }
            }
        }

        if owns(cur, &target_ip) {
            if cur.id != src_id && drops_rule(cur, "input", &s, &target_ip, proto, dport) {
                return TraceResult { ok: false, path, hops, xlat, err: Some(format!("{}: firewall input drop", cur.name)) };
            }
            return TraceResult { ok: true, path, hops, xlat, err: None };
        }

        let r = match lookup(cur, &target_ip) {
            Some(res) => res,
            None => return TraceResult { ok: false, path, hops, xlat, err: Some(format!("{}: no route to host", cur.name)) },
        };

        if cur.id != src_id {
            if drops_rule(cur, "forward", &s, &target_ip, proto, dport) {
                return TraceResult { ok: false, path, hops, xlat, err: Some(format!("{}: firewall forward drop", cur.name)) };
            }
            if nat {
                if let Some(nat_rules) = &cur.nat {
                    if nat_rules.iter().map(nat_norm).any(|n| n.chain == "srcnat" && n.out.as_deref() == Some(&r.iface)) {
                        if let Some(i) = cur.ifaces.iter().find(|i| i.name == r.iface) {
                            if let Some(addr) = &i.addr {
                                let o = parse_cidr(addr).ip;
                                xlat.push(TraceXlat { dev: cur.id.clone(), to: o.clone() });
                                s = o;
                            }
                        }
                    }
                }
            }
        }

        let via = l2_peers(net, &cur.id, &r.iface);
        let nxt = via.iter().find(|p| {
            if let Some(d) = net.devices.get(&p.dev) {
                if let Some(i) = d.ifaces.iter().find(|i| i.name == p.if_) {
                    if let Some(addr) = &i.addr {
                        return addr.starts_with(&format!("{}/", r.nh));
                    }
                }
            }
            false
        });

        match nxt {
            Some(p) => {
                ingress = via.iter().find(|v| v.dev == p.dev).map(|v| v.if_.clone());
                hops.push(r.nh);
                cur_id = p.dev.clone();
                path.push(cur_id.clone());
            }
            None => return TraceResult { ok: false, path, hops, xlat, err: Some(format!("{}: host {} unreachable (ARP failed)", cur.name, r.nh)) },
        }
    }

    TraceResult { ok: false, path, hops, xlat, err: Some("TTL exceeded".to_string()) }
}

pub fn simulate_packet_flow(net: &mut Network, src_dev_id: &str, dst_ip: &str, proto: &str, dport: &str) -> FlowResult {
    converge(net);

    let src = match net.devices.get(src_dev_id) {
        Some(d) => d,
        None => return FlowResult { ok: false, final_status: "ERROR".to_string(), error: Some("Source device not found".to_string()), hops: Vec::new() },
    };

    let s0 = match src_of(src, dst_ip) {
        Some(s) => s,
        None => return FlowResult { ok: false, final_status: "NO ROUTE".to_string(), error: Some(format!("{}: No route to host", src.name)), hops: Vec::new() },
    };

    let mut hops = Vec::new();
    let mut cur_id = src_dev_id.to_string();
    let mut s = s0;
    let mut ingress: Option<String> = None;
    let mut target_ip = dst_ip.to_string();

    for hop_num in 1..=16 {
        let cur = match net.devices.get(&cur_id) {
            Some(d) => d,
            None => break,
        };

        let mut hop_info = HopStep {
            hop: hop_num,
            dev_id: cur.id.clone(),
            dev_name: cur.name.clone(),
            dev_type: cur.type_.clone(),
            src_ip: s.clone(),
            dst_ip: target_ip.clone(),
            chains: Vec::new(),
        };

        // 1. Dst-NAT Chain (Prerouting)
        if let Some(nat_rules) = &cur.nat {
            let dr = nat_rules.iter().map(nat_norm).find(|n| {
                n.chain == "dstnat"
                    && (n.proto.as_deref().unwrap_or("").is_empty() || n.proto.as_deref() == Some(proto))
                    && (n.dport.as_deref().unwrap_or("").is_empty() || n.dport.as_deref() == Some(dport))
                    && (n.in_iface.as_deref().unwrap_or("").is_empty() || n.in_iface == ingress)
                    && (n.dst.as_deref().unwrap_or("").is_empty() || in_net(n.dst.as_ref().unwrap(), &target_ip))
            });

            if let Some(dr_rule) = dr {
                let to = if dr_rule.redirect {
                    cur_to_ip(cur, ingress.as_deref())
                } else {
                    dr_rule.to_addr.clone()
                };

                if let Some(to_addr) = to {
                    target_ip = to_addr.clone();
                    hop_info.chains.push(ChainStep {
                        chain: "PREROUTING // DST-NAT".to_string(),
                        action: "DST-NAT".to_string(),
                        matched_rule: Some(format!("action={} to-addresses={}", dr_rule.action, to_addr)),
                        detail: format!("Destination NAT applied -> new dst {}", to_addr),
                    });
                }
            } else {
                hop_info.chains.push(ChainStep {
                    chain: "PREROUTING // DST-NAT".to_string(),
                    action: "PASSTHROUGH".to_string(),
                    matched_rule: None,
                    detail: "No dst-nat rules matched".to_string(),
                });
            }
        } else {
            hop_info.chains.push(ChainStep {
                chain: "PREROUTING // DST-NAT".to_string(),
                action: "PASSTHROUGH".to_string(),
                matched_rule: None,
                detail: "No dst-nat rules matched".to_string(),
            });
        }

        // Check if target is locally owned
        if owns(cur, &target_ip) {
            if cur.id != src_dev_id {
                let drop_rule = cur.fw.as_ref().and_then(|fw| {
                    fw.iter().find(|r| r.chain == "input" && hit_rule(r, &s, &target_ip, proto, dport) && r.action == "drop")
                });

                if let Some(dr) = drop_rule {
                    hop_info.chains.push(ChainStep {
                        chain: "INPUT // FILTER".to_string(),
                        action: "DROP".to_string(),
                        matched_rule: Some(format!("chain=input action=drop src={} dst={}", dr.src.as_deref().unwrap_or("*"), dr.dst.as_deref().unwrap_or("*"))),
                        detail: format!("Packet dropped by firewall input rule on {}", cur.name),
                    });
                    hops.push(hop_info);
                    return FlowResult {
                        ok: false,
                        final_status: "DROPPED (INPUT CHAIN)".to_string(),
                        error: Some(format!("{}: firewall input drop", cur.name)),
                        hops,
                    };
                } else {
                    hop_info.chains.push(ChainStep {
                        chain: "INPUT // FILTER".to_string(),
                        action: "ACCEPT".to_string(),
                        matched_rule: None,
                        detail: "Accepted into local host/services".to_string(),
                    });
                }
            }
            hops.push(hop_info);
            return FlowResult {
                ok: true,
                final_status: "DELIVERED (LOCAL HOST)".to_string(),
                error: None,
                hops,
            };
        }

        // 2. Forwarding lookup
        let r = match lookup(cur, &target_ip) {
            Some(res) => res,
            None => {
                hop_info.chains.push(ChainStep {
                    chain: "ROUTING DECISION".to_string(),
                    action: "UNREACHABLE".to_string(),
                    matched_rule: None,
                    detail: format!("No route to {}", target_ip),
                });
                hops.push(hop_info);
                return FlowResult {
                    ok: false,
                    final_status: "NO ROUTE".to_string(),
                    error: Some(format!("{}: no route to {}", cur.name, target_ip)),
                    hops,
                };
            }
        };

        // 3. Filter Forward Chain
        if cur.id != src_dev_id {
            let drop_rule = cur.fw.as_ref().and_then(|fw| {
                fw.iter().find(|r| r.chain == "forward" && hit_rule(r, &s, &target_ip, proto, dport) && r.action == "drop")
            });

            if let Some(dr) = drop_rule {
                hop_info.chains.push(ChainStep {
                    chain: "FORWARD // FILTER".to_string(),
                    action: "DROP".to_string(),
                    matched_rule: Some(format!("chain=forward action=drop src={} dst={}", dr.src.as_deref().unwrap_or("*"), dr.dst.as_deref().unwrap_or("*"))),
                    detail: format!("Packet dropped by firewall forward rule on {}", cur.name),
                });
                hops.push(hop_info);
                return FlowResult {
                    ok: false,
                    final_status: "DROPPED (FORWARD CHAIN)".to_string(),
                    error: Some(format!("{}: firewall forward drop", cur.name)),
                    hops,
                };
            } else {
                hop_info.chains.push(ChainStep {
                    chain: "FORWARD // FILTER".to_string(),
                    action: "ACCEPT (default)".to_string(),
                    matched_rule: None,
                    detail: "Forward chain evaluation passed".to_string(),
                });
            }

            // 4. Src-NAT / Masquerade Chain
            if let Some(nat_rules) = &cur.nat {
                let sr = nat_rules.iter().map(nat_norm).find(|n| n.chain == "srcnat" && n.out.as_deref() == Some(&r.iface));
                if let Some(sr_rule) = sr {
                    if let Some(i) = cur.ifaces.iter().find(|i| i.name == r.iface) {
                        if let Some(addr) = &i.addr {
                            let o = parse_cidr(addr).ip;
                            s = o.clone();
                            hop_info.chains.push(ChainStep {
                                chain: "POSTROUTING // SRC-NAT".to_string(),
                                action: "SRC-NAT".to_string(),
                                matched_rule: Some(format!("chain=srcnat action=masquerade out-interface={}", sr_rule.out.as_deref().unwrap_or(""))),
                                detail: format!("Source address masqueraded to {}", o),
                            });
                        }
                    }
                }
            }
        }

        hops.push(hop_info);

        // Traverse next L2 hop
        let via = l2_peers(net, &cur.id, &r.iface);
        let nxt = via.iter().find(|p| {
            if let Some(d) = net.devices.get(&p.dev) {
                if let Some(i) = d.ifaces.iter().find(|i| i.name == p.if_) {
                    if let Some(addr) = &i.addr {
                        return addr.starts_with(&format!("{}/", r.nh));
                    }
                }
            }
            false
        });

        match nxt {
            Some(p) => {
                ingress = via.iter().find(|v| v.dev == p.dev).map(|v| v.if_.clone());
                cur_id = p.dev.clone();
            }
            None => {
                return FlowResult {
                    ok: false,
                    final_status: "ARP FAILED".to_string(),
                    error: Some(format!("{}: host {} unreachable (ARP failed)", cur.name, r.nh)),
                    hops,
                };
            }
        }
    }

    FlowResult {
        ok: false,
        final_status: "TTL EXCEEDED".to_string(),
        error: Some("TTL exceeded (routing loop?)".to_string()),
        hops,
    }
}

pub fn ping(net: &mut Network, src_id: &str, dst_ip: &str, proto: &str, dport: &str) -> PingResult {
    converge(net);
    let src = match net.devices.get(src_id) {
        Some(d) => d,
        None => return PingResult { ok: false, path: vec![src_id.to_string()], hops: Vec::new(), err: Some("Source not found".to_string()) },
    };

    if owns(src, dst_ip) {
        return PingResult { ok: true, path: vec![src_id.to_string()], hops: Vec::new(), err: None };
    }

    let s0 = match src_of(src, dst_ip) {
        Some(s) => s,
        None => return PingResult { ok: false, path: vec![src_id.to_string()], hops: Vec::new(), err: Some(format!("{}: no route to host", src.name)) },
    };

    let f = trace(net, src_id, dst_ip, &s0, true, proto, dport);
    if !f.ok {
        return PingResult { ok: false, path: f.path, hops: f.hops, err: f.err };
    }

    let mut cur = f.path.last().unwrap().clone();
    let mut path = f.path.clone();

    let mut return_targets: Vec<String> = f.xlat.iter().rev().map(|x| x.to.split(':').next().unwrap_or("").to_string()).collect();
    return_targets.push(s0);

    for t in return_targets {
        let b = trace(net, &cur, &t, dst_ip, false, proto, dport);
        if !b.ok {
            return PingResult {
                ok: false,
                path,
                hops: f.hops,
                err: Some(format!("reply hilang: {}", b.err.unwrap_or_default())),
            };
        }
        if b.path.len() > 1 {
            path.extend_from_slice(&b.path[1..]);
        }
        cur = b.path.last().unwrap().clone();
    }

    PingResult { ok: true, path, hops: f.hops, err: None }
}

pub fn bw(net: &mut Network, src_id: &str, dst_ip: &str) -> BandwidthResult {
    let r = ping(net, src_id, dst_ip, "tcp", "80");
    if !r.ok {
        return BandwidthResult {
            ok: false,
            path: r.path,
            tx: 0.0,
            rx: 0.0,
            err: r.err,
        };
    }

    let src_dev = net.devices.get(src_id).unwrap();
    let s_ip = src_of(src_dev, dst_ip).unwrap_or_default();
    let dst_id = r.path[r.hops.len()].clone();
    let mids: Vec<String> = if r.hops.len() > 1 {
        r.path[1..r.hops.len()].to_vec()
    } else {
        Vec::new()
    };

    let wl = wifi_links(net);
    let wl_rates: Vec<f64> = wl
        .iter()
        .filter(|w| w.cl == src_id || w.cl == dst_id)
        .map(|w| if w.dbm > -55 { 150.0 } else if w.dbm > -65 { 72.0 } else { 24.0 })
        .collect();

    let link_cap = || -> f64 {
        let mut c = f64::INFINITY;
        let mut found = false;
        if r.path.len() >= 2 {
            for i in 0..(r.path.len() - 1) {
                let u = &r.path[i];
                let v = &r.path[i + 1];
                let lk = net.links.iter().find(|l| (l.a.dev == *u && l.b.dev == *v) || (l.b.dev == *u && l.a.dev == *v));
                if let Some(l) = lk {
                    let st = link_status(net, l);
                    if link_live(net, l) {
                        c = c.min(st.speed as f64);
                        found = true;
                    }
                }
            }
        }
        if found { c } else { 100.0 }
    };

    let cap = |a: &str, b: &str, dir: &str| -> f64 {
        let mut c = link_cap();
        for &rate in &wl_rates {
            c = c.min(rate);
        }
        for id in &mids {
            if let Some(dev) = net.devices.get(id) {
                if let Some(queues) = &dev.queues {
                    for q in queues {
                        let limit = if in_net(&q.target, a) {
                            q.up
                        } else if in_net(&q.target, b) {
                            q.down
                        } else {
                            1e9
                        };
                        c = c.min(limit);
                    }
                }
                if let Some(qtrees) = &dev.qtrees {
                    for q in qtrees {
                        let limit = if dir == "tx" { q.up } else { q.down };
                        c = c.min(limit);
                        if let Some(qtypes) = &dev.qtypes {
                            if let Some(t) = qtypes.iter().find(|x| x.name == q.queue) {
                                c = c.min(t.rate);
                            }
                        }
                    }
                }
            }
        }
        c
    };

    let tx = cap(&s_ip, dst_ip, "tx");
    let rx = cap(dst_ip, &s_ip, "rx");

    BandwidthResult {
        ok: true,
        path: r.path,
        tx,
        rx,
        err: None,
    }
}

pub fn dhcp_on(net: &mut Network, d_id: &str, ifname: &str) -> String {
    let dev = match net.devices.get(d_id) {
        Some(d) => d,
        None => return "dhcp: device tidak ada".to_string(),
    };

    if !dev.ifaces.iter().any(|i| i.name == ifname) {
        return "dhcp: interface tidak ada".to_string();
    }

    let peers = l2_peers(net, d_id, ifname);
    for p in peers {
        let r_dev = match net.devices.get(&p.dev) {
            Some(d) => d,
            None => continue,
        };

        let mut found_pool_info = None;

        if let Some(servers) = &r_dev.dhcp {
            if let Some(sv) = servers.iter().find(|x| x.interface == p.if_) {
                let pool = r_dev.pools.as_ref().and_then(|pools| pools.iter().find(|x| x.name == sv.pool));
                let nw = pool.and_then(|p_obj| {
                    r_dev.dhcp_nets.as_ref().and_then(|nets| nets.iter().find(|x| in_net(&x.address, &p_obj.from)))
                });

                if pool.is_none() || nw.is_none() {
                    return "dhcp: pool atau network di server belum lengkap".to_string();
                }

                let p_obj = pool.unwrap();
                let nw_obj = nw.unwrap();
                found_pool_info = Some((p_obj.from.clone(), p_obj.to.clone(), nw_obj.address.clone(), nw_obj.gateway.clone(), nw_obj.dns.clone()));
            }
        }

        if let Some((p_from, p_to, nw_addr, nw_gw, nw_dns)) = found_pool_info {
            let from_n = n2(&p_from);
            let to_n = n2(&p_to);

            let r_dev_mut = net.devices.get_mut(&p.dev).unwrap();
            let ls = r_dev_mut.leases.get_or_insert_with(Vec::new);

            let mut existing_lease = ls.iter().find(|x| x.by == d_id).cloned();

            if existing_lease.is_none() {
                for n in from_n..=to_n {
                    let ip_str = to_ip(n);
                    if !ls.iter().any(|x| x.ip == ip_str) {
                        let new_l = DHCPLease { ip: ip_str, by: d_id.to_string() };
                        ls.push(new_l.clone());
                        existing_lease = Some(new_l);
                        break;
                    }
                }
            }

            if let Some(l) = existing_lease {
                let d_mut = net.devices.get_mut(d_id).unwrap();
                let len = parse_cidr(&nw_addr).len;
                if let Some(iface) = d_mut.ifaces.iter_mut().find(|i| i.name == ifname) {
                    iface.addr = Some(format!("{}/{}", l.ip, len));
                }
                if let Some(gw) = &nw_gw {
                    if valid_ip(gw) {
                        d_mut.routes = vec![Route {
                            dst: "0.0.0.0/0".to_string(),
                            gw: gw.clone(),
                            dhcp: true,
                            ad: Some(1),
                            m: None,
                            proto: None,
                        }];
                    }
                }
                d_mut.dns = nw_dns.clone();
                return format!(
                    "bound {}/{} gw {} dns {}",
                    l.ip,
                    len,
                    nw_gw.as_deref().unwrap_or("-"),
                    d_mut.dns.as_deref().unwrap_or("-")
                );
            } else {
                return "dhcp: pool habis".to_string();
            }
        }
    }

    "dhcp: tidak ada server DHCP di segmen ini".to_string()
}

pub fn dhcp(net: &mut Network, pc_id: &str) -> String {
    let ifname = {
        let pc = match net.devices.get(pc_id) {
            Some(d) => d,
            None => return "dhcp: device tidak ada".to_string(),
        };
        pc.ifaces[0].name.clone()
    };
    dhcp_on(net, pc_id, &ifname)
}

#[derive(Debug, Clone)]
pub struct DnsResolveResult {
    pub ip: Option<String>,
    pub err: Option<String>,
}

pub fn resolve_dns(net: &Network, d: &Device, name: &str) -> DnsResolveResult {
    if valid_ip(name) || valid_ip6(name) || name.contains(':') {
        return DnsResolveResult {
            ip: Some(name.to_string()),
            err: None,
        };
    }

    let mut tab_dev: Option<&Device> = Some(d);

    if d.type_ != "router" {
        if let Some(dns_server) = &d.dns {
            if dns_server.contains(':') {
                tab_dev = net.devices.values().find(|x| owns6(x, dns_server));
            } else if let Some(sip) = src_of(d, dns_server) {
                let t = trace(net, &d.id, dns_server, &sip, true, "icmp", "");
                if t.ok {
                    if let Some(last_id) = t.path.last() {
                        tab_dev = net.devices.get(last_id);
                    }
                } else {
                    tab_dev = None;
                }
            } else {
                tab_dev = None;
            }
        } else {
            tab_dev = None;
        }
    }

    if let Some(tab) = tab_dev {
        if let Some(static_entries) = &tab.dns_static {
            if let Some(e) = static_entries.iter().find(|x| x.name == name) {
                return DnsResolveResult {
                    ip: Some(e.address.clone()),
                    err: None,
                };
            }
        }
    }

    DnsResolveResult {
        ip: None,
        err: Some(format!("dns: tidak bisa resolve {}", name)),
    }
}
