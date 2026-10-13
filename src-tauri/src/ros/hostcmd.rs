use crate::engine::{dhcp, resolve_dns};
use crate::models::{ExecResult, Network};
use crate::ros::arp::arp_entries;
use crate::ros::mac::mac_of;
use crate::ros::num::*;
use crate::ros::pingargs::parse_ping_args;
use std::collections::HashMap;

fn pad(s: &str, n: usize) -> String {
    format!("{:width$}", s, width = n)
}

pub fn host_cmd(
    net: &mut Network,
    dev_id: &str,
    tokens: &[String],
    q: &HashMap<String, String>,
) -> Option<ExecResult> {
    if tokens.is_empty() {
        return None;
    }

    let cmd = tokens[0].to_lowercase();
    let lower_tokens: Vec<String> = tokens.iter().map(|s| s.to_lowercase()).collect();

    // Check ipconfig /all
    if cmd == "ipconfig" {
        let is_all = lower_tokens.iter().any(|t| t == "/all");
        let is_renew = lower_tokens.iter().any(|t| t == "/renew");
        let is_release = lower_tokens.iter().any(|t| t == "/release");

        if is_renew {
            let res = dhcp(net, dev_id);
            return Some(ExecResult {
                out: vec!["Meminta sewa DHCP...".to_string(), res],
                ..Default::default()
            });
        }

        if is_release {
            let res = dhcp(net, dev_id);
            return Some(ExecResult {
                out: vec!["Melepas sewa DHCP...".to_string(), res],
                ..Default::default()
            });
        }

        let dev = match net.devices.get(dev_id) {
            Some(d) => d,
            None => return None,
        };

        let primary_if = dev.ifaces.iter().find(|i| i.addr.is_some()).unwrap_or(&dev.ifaces[0]);
        let if_label = if dev.type_ == "laptop" {
            "Wireless LAN adapter Wi-Fi"
        } else {
            "Ethernet adapter Ethernet"
        };

        let gw = dev
            .routes
            .iter()
            .find(|r| r.dst == "0.0.0.0/0")
            .map(|r| r.gw.clone())
            .unwrap_or_default();

        let mut out = vec![
            "Windows IP Configuration".to_string(),
            "".to_string(),
            format!("{}:", if_label),
            "".to_string(),
        ];

        if is_all {
            out.push(format!("   Description . . . . . . . . . . . : {}-adapter (simulasi)", dev.type_));
            out.push(format!("   Physical Address. . . . . . . . . : {}", win_mac(&mac_of(&dev.id, &primary_if.name))));
            out.push(format!("   DHCP Enabled. . . . . . . . . . . : {}", if dev.dhcp_client.as_ref().map_or(false, |c| !c.is_empty()) { "Yes" } else { "No" }));
        }

        out.push("   Connection-specific DNS Suffix  . :".to_string());
        out.push(format!("   IPv4 Address. . . . . . . . . . . : {}", primary_if.addr.as_deref().unwrap_or("(kosong)")));

        let mask_str = if let Some(addr) = &primary_if.addr {
            let (_, len) = split_addr(addr);
            mask_of(len)
        } else {
            "0.0.0.0".to_string()
        };
        out.push(format!("   Subnet Mask . . . . . . . . . . . : {}", mask_str));
        out.push(format!("   Default Gateway . . . . . . . . . : {}", if gw.is_empty() { "(kosong)" } else { &gw }));
        out.push("   DHCP Server . . . . . . . . . . . : (kosong)".to_string());
        out.push("   DHCPv4 IP Address Lease . . . . . : (statis)".to_string());

        if let Some(addr6) = &primary_if.addr6 {
            out.push(format!("   IPv6 Address. . . . . . . . . . . : {}", addr6));
        }

        out.push(format!("   DNS Servers . . . . . . . . . . . : {}", dev.dns.as_deref().unwrap_or("(kosong)")));
        out.push(format!("   NetBIOS over TCP/IP. . . . . . . : {}", dev.name.to_uppercase()));

        if is_all {
            out.push("".to_string());
            out.push(format!("   Host Name . . . . . . . . . . . : {}", dev.name));
            out.push("   Primary Dns Suffix  . . . . . . . :".to_string());
            out.push("   Node Type . . . . . . . . . . . . : Hybrid".to_string());
            out.push(format!("   IP Routing Enabled . . . . . . . : {}", if !dev.routes.is_empty() { "Yes" } else { "No" }));
            out.push("   WINS Proxy Enabled . . . . . . . : No".to_string());
            out.push(format!("   Adapter Name . . . . . . . . . . : {}", primary_if.name));
        }

        return Some(ExecResult {
            out,
            ..Default::default()
        });
    }

    if cmd == "ping" {
        let args = parse_ping_args(&tokens[1..], q);
        let target = match args.target {
            Some(t) => t,
            None => return Some(ExecResult { out: vec!["Ketik: ping [-n jumlah] [-l ukuran] <ip>".to_string()], ..Default::default() }),
        };

        let dev = net.devices.get(dev_id).cloned()?;
        let rs = resolve_dns(net, &dev, &target);
        if let Some(_err) = rs.err {
            return Some(ExecResult {
                out: vec![format!("Ping tidak dapat menemukan host {}.", target), "Periksa nama hostname, lalu coba lagi.".to_string()],
                ..Default::default()
            });
        }

        let ip_target = rs.ip.unwrap();
        let ping_res = if ip_target.contains(':') {
            crate::engine::ping6(net, dev_id, &ip_target)
        } else {
            crate::engine::ping(net, dev_id, &ip_target, "icmp", "")
        };

        let ms = if ping_res.ok { ping_res.hops.len().max(1) as u32 } else { 0 };
        let mut out = vec![
            format!("Pinging {} with {} bytes of data:", ip_target, args.size),
            "".to_string(),
        ];

        for _ in 0..args.count {
            if ping_res.ok {
                out.push(format!("Reply from {}: bytes={} time={}ms TTL={}", ip_target, args.size, ms, 64 - ping_res.hops.len()));
            } else {
                out.push("Request timed out.".to_string());
            }
        }

        out.push("".to_string());
        out.push(format!("Ping statistics for {}:", ip_target));
        out.push(format!("    Packets: Sent = {}, Received = {}, Lost = {} ({}% loss)", args.count, if ping_res.ok { args.count } else { 0 }, if ping_res.ok { 0 } else { args.count }, if ping_res.ok { 0 } else { 100 }));

        if !ping_res.ok {
            out.push("".to_string());
            if let Some(e) = ping_res.err {
                out.push(e);
            }
        }

        return Some(ExecResult {
            out,
            anim: Some(ping_res.path),
            ok: Some(ping_res.ok),
            hops: Some(ping_res.hops),
            clear: false,
        });
    }

    if cmd == "tracert" {
        let target = match tokens.get(1) {
            Some(t) => t,
            None => return Some(ExecResult { out: vec!["Ketik: tracert <ip>".to_string()], ..Default::default() }),
        };

        let dev = net.devices.get(dev_id).cloned()?;
        let rs = resolve_dns(net, &dev, target);
        if rs.err.is_some() {
            return Some(ExecResult {
                out: vec!["Ketik: tracert <ip>".to_string(), format!("Tidak dapat me-resolve {}.", target)],
                ..Default::default()
            });
        }

        let ip_target = rs.ip.unwrap();
        let ping_res = if ip_target.contains(':') {
            crate::engine::ping6(net, dev_id, &ip_target)
        } else {
            crate::engine::ping(net, dev_id, &ip_target, "icmp", "")
        };

        let last_dev = net.devices.get(ping_res.path.last().unwrap_or(&"".to_string()));
        let reached = last_dev.map_or(false, |d| {
            d.ifaces.iter().any(|i| {
                let ip = i.addr.as_deref().or(i.addr6.as_deref()).unwrap_or("");
                split_addr(ip).0 == ip_target
            })
        });

        let mut out = vec![
            format!("Tracing route to {} over a maximum of 30 hops", ip_target),
            "".to_string(),
        ];

        for (i, h) in ping_res.hops.iter().enumerate() {
            let ms = (i + 1).max(1);
            out.push(format!("  {:2}{:10}{:10}{:10}  {}", i + 1, format!("{} ms", ms), format!("{} ms", ms), format!("{} ms", ms), h));
        }

        out.push("".to_string());
        if reached {
            out.push("Trace complete.".to_string());
        } else if let Some(e) = &ping_res.err {
            out.push(e.clone());
        }

        return Some(ExecResult {
            out,
            anim: Some(ping_res.path),
            ok: Some(reached),
            hops: Some(ping_res.hops),
            clear: false,
        });
    }

    if cmd == "nslookup" {
        let name = match tokens.get(1) {
            Some(n) => n,
            None => return Some(ExecResult { out: vec!["Ketik: nslookup <nama>".to_string()], ..Default::default() }),
        };

        let dev = net.devices.get(dev_id).cloned()?;
        let server = tokens.get(2).cloned().or_else(|| dev.dns.clone());
        let rs = resolve_dns(net, &dev, name);

        let mut out = Vec::new();
        if let Some(srv) = &server {
            out.push(format!("Server:  {}", srv));
            out.push(format!("Address:  {}", srv));
        }

        if rs.err.is_some() {
            out.push("".to_string());
            out.push(format!("*** {} Non-existent domain", name));
            out.push(format!("*** {} can't find {}: Non-existent domain", server.as_deref().unwrap_or("localhost"), name));
        } else {
            out.push("".to_string());
            out.push("Non-authoritative answer:".to_string());
            out.push(format!("Name:    {}", name));
            out.push(format!("Address: {}", rs.ip.unwrap()));
        }

        return Some(ExecResult { out, ..Default::default() });
    }

    if cmd == "arp" {
        let flag = tokens.get(1).map(|s| s.to_lowercase()).unwrap_or_default();
        if flag == "-d" {
            if let Some(ip) = tokens.get(2) {
                let dev_mut = net.devices.get_mut(dev_id)?;
                dev_mut.arp_blocked.get_or_insert_with(Vec::new).push(ip.clone());
                return Some(ExecResult { out: vec![format!("{} dihapus dari tabel ARP", ip)], ..Default::default() });
            } else {
                return Some(ExecResult { out: vec!["Ketik: arp -d <ip>".to_string()], ..Default::default() });
            }
        }

        let dev = net.devices.get(dev_id)?;
        let list = arp_entries(net, dev);

        let mut out = Vec::new();
        for (ix, i) in dev.ifaces.iter().enumerate() {
            if let Some(addr) = &i.addr {
                let (ip, _) = split_addr(addr);
                let rows: Vec<&crate::ros::arp::ArpEntry> = list.iter().filter(|x| x.iface == i.name).collect();
                out.push(format!("Interface: {} --- 0x{:x}", ip, ix));
                out.push("  Internet Address      Physical Address      Type".to_string());
                for x in rows {
                    out.push(format!("  {}{}{}", pad(&x.ip, 21), pad(&win_mac(&x.mac), 24), "dynamic"));
                }
                out.push("".to_string());
            }
        }

        if out.is_empty() {
            out.push("No ARP entries".to_string());
        }

        return Some(ExecResult { out, ..Default::default() });
    }

    if cmd == "hostname" {
        let dev = net.devices.get(dev_id)?;
        return Some(ExecResult { out: vec![dev.name.clone()], ..Default::default() });
    }

    if cmd == "getmac" {
        let dev = net.devices.get(dev_id)?;
        let mut out = vec!["Physical Address    Transport Name".to_string()];
        for i in &dev.ifaces {
            out.push(format!("{} \\Device\\Tcpip_{{{}{}}}", pad(&win_mac(&mac_of(&dev.id, &i.name)), 20), dev.id, i.name));
        }
        return Some(ExecResult { out, ..Default::default() });
    }

    if cmd == "cls" || cmd == "clear" {
        return Some(ExecResult { out: Vec::new(), clear: true, ..Default::default() });
    }

    if cmd == "echo" {
        let txt = tokens[1..].join(" ");
        return Some(ExecResult { out: vec![txt], ..Default::default() });
    }

    None
}
