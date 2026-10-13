use crate::engine::*;
use crate::models::*;
use crate::netbits::*;
use crate::ros::help::{help_index, help_topic};
use crate::ros::hostcmd::host_cmd;
use crate::ros::mac::mac_of;
use crate::ros::pingargs::parse_ping_args;

fn pad(s: &str, n: usize) -> String {
    format!("{:width$}", s, width = n)
}

fn bad(msg: &str) -> ExecResult {
    ExecResult {
        out: vec![format!("failure: {}", msg)],
        ..Default::default()
    }
}

fn quote_val(v: &str) -> String {
    if v.contains(' ') || v.contains('"') {
        format!("\"{}\"", v.replace('"', ""))
    } else {
        v.to_string()
    }
}

pub fn export_of(_net: &Network, d: &Device) -> Vec<String> {
    let mut lines = vec![
        format!("# {} ({})", d.name, d.type_),
        format!("system identity set name={}", d.name),
    ];

    if d.type_ == "switch" {
        for i in &d.ifaces {
            let c = port_cfg(d, &i.name);
            if c.mode == "access" {
                lines.push(format!("vlan access port={} id={}", i.name, c.vlan));
            } else {
                let vlans_str = c
                    .vlans
                    .as_ref()
                    .map(|v| v.iter().map(|n| n.to_string()).collect::<Vec<_>>().join(","))
                    .unwrap_or_default();
                lines.push(format!("vlan trunk port={} ids={}", i.name, vlans_str));
            }
            if i.disabled || i.comment.is_some() {
                lines.push(format!(
                    "interface ethernet set {} disabled={}{}",
                    i.name,
                    if i.disabled { "yes" } else { "no" },
                    i.comment.as_ref().map_or("".to_string(), |cm| format!(" comment={}", quote_val(cm)))
                ));
            }
        }
        if d.stp.as_deref() == Some("no") {
            lines.push("interface bridge set stp=no".to_string());
        }
        if d.clock_date.is_some() || d.clock_time.is_some() {
            lines.push(format!(
                "system clock set{}{}",
                d.clock_date.as_ref().map_or("".to_string(), |date| format!(" date={}", date)),
                d.clock_time.as_ref().map_or("".to_string(), |time| format!(" time={}", time))
            ));
        }
        return lines;
    }

    if matches!(d.type_.as_str(), "pc" | "server" | "laptop") {
        if let Some(i0) = d.ifaces.first() {
            if let Some(addr) = &i0.addr {
                lines.push(format!("ip address add address={} interface={}", addr, i0.name));
            }
            if let Some(addr6) = &i0.addr6 {
                lines.push(format!("ipv6 address add address={} interface={}", addr6, i0.name));
            }
        }
        for r in &d.routes {
            lines.push(format!("ip route add dst-address={} gateway={}", r.dst, r.gw));
        }
        for r in &d.routes6 {
            lines.push(format!("ipv6 route add dst-address={} gateway={}", r.dst, r.gw));
        }
        if let Some(dns) = &d.dns {
            lines.push(format!("ip dns set servers={}", dns));
        }
        if let Some(wifi) = &d.wifi {
            lines.push(format!("wifi connect ssid={} password={}", wifi.ssid, wifi.pass));
        }
        return lines;
    }

    for i in &d.ifaces {
        if let Some(addr) = &i.addr {
            lines.push(format!("ip address add address={} interface={}", addr, i.name));
        }
        if let Some(addr6) = &i.addr6 {
            lines.push(format!("ipv6 address add address={} interface={}", addr6, i.name));
        }
        if let Some(vlan_id) = i.vlan {
            lines.push(format!("interface vlan add name={} vlan-id={} interface={}", i.name, vlan_id, i.parent.as_deref().unwrap_or("")));
        }
        if i.members.is_some() {
            lines.push(format!("interface bridge add name={}", i.name));
        }
    }

    for i in &d.ifaces {
        if let Some(members) = &i.members {
            for m in members {
                lines.push(format!("interface bridge port add bridge={} interface={}", i.name, m));
            }
        }
    }

    for i in &d.ifaces {
        if i.kind.is_some() && (i.disabled || i.comment.is_some()) {
            lines.push(format!(
                "interface ethernet set {} disabled={}{}",
                i.name,
                if i.disabled { "yes" } else { "no" },
                i.comment.as_ref().map_or("".to_string(), |cm| format!(" comment={}", quote_val(cm)))
            ));
        }
    }

    for r in &d.routes {
        lines.push(format!("ip route add dst-address={} gateway={}", r.dst, r.gw));
    }
    for r in &d.routes6 {
        lines.push(format!("ipv6 route add dst-address={} gateway={}", r.dst, r.gw));
    }
    if let Some(dns) = &d.dns {
        lines.push(format!("ip dns set servers={}", dns));
    }
    if let Some(dns_rem) = &d.dns_remote {
        if dns_rem != "yes" {
            lines.push(format!("ip dns set allow-remote-requests={}", dns_rem));
        }
    }
    if let Some(rip) = &d.rip {
        for n in rip {
            lines.push(format!("routing rip network add network={}", n));
        }
    }
    if let Some(ospf) = &d.ospf {
        for n in ospf {
            lines.push(format!("routing ospf network add network={}", n));
        }
    }
    if let Some(pools) = &d.pools {
        for p in pools {
            lines.push(format!("ip pool add name={} ranges={}-{}", p.name, p.from, p.to));
        }
    }
    if let Some(dhcp_nets) = &d.dhcp_nets {
        for n in dhcp_nets {
            lines.push(format!(
                "ip dhcp-server network add address={}{}{}",
                n.address,
                n.gateway.as_ref().map_or("".to_string(), |gw| format!(" gateway={}", gw)),
                n.dns.as_ref().map_or("".to_string(), |dns| format!(" dns-server={}", dns))
            ));
        }
    }
    if let Some(dhcp_servers) = &d.dhcp {
        for s in dhcp_servers {
            lines.push(format!("ip dhcp-server add name={} interface={} address-pool={}", s.name, s.interface, s.pool));
        }
    }
    if let Some(dns_static) = &d.dns_static {
        for e in dns_static {
            lines.push(format!("ip dns static add name={} address={}", e.name, e.address));
        }
    }
    if let Some(addr_list) = &d.addr_list {
        for a in addr_list {
            lines.push(format!(
                "ip firewall address-list add list={} address={}{}",
                a.list,
                a.address,
                a.timeout.as_ref().map_or("".to_string(), |t| format!(" timeout={}", t))
            ));
        }
    }
    if let Some(wlan) = &d.wlan {
        lines.push(format!(
            "interface wireless set wlan1 ssid={} password={} mode={}",
            wlan.ssid,
            wlan.pass,
            wlan.mode.as_deref().unwrap_or("ap-bridge")
        ));
    }
    if let Some(queues) = &d.queues {
        for q in queues {
            lines.push(format!("queue simple add name={} target={} max-limit={}M/{}M", q.name, q.target, q.up, q.down));
        }
    }
    if let Some(qtypes) = &d.qtypes {
        for q in qtypes {
            lines.push(format!("queue type add name={} kind=pcq pcq-rate={}M pcq-classifier={}", q.name, q.rate, q.classifier));
        }
    }
    if let Some(qtrees) = &d.qtrees {
        for q in qtrees {
            lines.push(format!(
                "queue tree add name={} parent=global max-limit={}M/{}M{}",
                q.name,
                q.up,
                q.down,
                if !q.queue.is_empty() { format!(" queue={}", q.queue) } else { "".to_string() }
            ));
        }
    }
    if let Some(fw) = &d.fw {
        for r in fw {
            lines.push(format!(
                "ip firewall filter add chain={} action={}{}{}{}{}",
                r.chain,
                r.action,
                r.src.as_ref().map_or("".to_string(), |s| format!(" src-address={}", s)),
                r.dst.as_ref().map_or("".to_string(), |dst| format!(" dst-address={}", dst)),
                r.proto.as_ref().map_or("".to_string(), |p| format!(" protocol={}", p)),
                r.dport.as_ref().map_or("".to_string(), |dp| format!(" dst-port={}", dp))
            ));
        }
    }
    if let Some(nat) = &d.nat {
        for n0 in nat {
            let n = nat_norm(n0);
            if n.chain == "srcnat" {
                lines.push(format!("ip firewall nat add chain=srcnat action=masquerade out-interface={}", n.out.as_deref().unwrap_or("")));
            } else {
                lines.push(format!(
                    "ip firewall nat add chain=dstnat action={}{}{}{}{}{}",
                    n.action,
                    if n.redirect { "".to_string() } else { format!(" to-addresses={}", n.to_addr.as_deref().unwrap_or("")) },
                    n.to_port.as_ref().map_or("".to_string(), |tp| format!(" to-ports={}", tp)),
                    n.proto.as_ref().map_or("".to_string(), |p| format!(" protocol={}", p)),
                    n.dport.as_ref().map_or("".to_string(), |dp| format!(" dst-port={}", dp)),
                    n.in_iface.as_ref().map_or("".to_string(), |i| format!(" in-interface={}", i))
                ));
            }
        }
    }
    if let Some(dhcp_clients) = &d.dhcp_client {
        for c in dhcp_clients {
            lines.push(format!("ip dhcp-client add interface={}", c.interface));
        }
    }

    lines
}

pub fn exec(net: &mut Network, dev_id: &str, line: &str) -> ExecResult {
    let tokens = tokenize(line);
    if tokens.is_empty() {
        return ExecResult { out: Vec::new(), ..Default::default() };
    }

    let dev_type = match net.devices.get(dev_id) {
        Some(d) => d.type_.clone(),
        None => return bad("device not found"),
    };

    let q = kv(&tokens);

    if tokens[0] == "export" {
        let dev = net.devices.get(dev_id).unwrap();
        return ExecResult {
            out: export_of(net, dev),
            ..Default::default()
        };
    }

    let is_host = matches!(dev_type.as_str(), "pc" | "server" | "laptop");

    if is_host {
        if let Some(res) = host_cmd(net, dev_id, &tokens, &q) {
            return res;
        }
    }

    let lower_tokens: Vec<String> = tokens.iter().map(|s| s.to_lowercase()).collect();
    let lower_refs: Vec<&str> = lower_tokens.iter().map(|s| s.as_str()).collect();

    if lower_refs[0] == "help" {
        let topic = if tokens.len() > 1 {
            tokens[1..].join(" ")
        } else {
            "".to_string()
        };
        let scope = if is_host { "host" } else if dev_type == "switch" { "switch" } else { "router" };
        let out = if topic.is_empty() {
            help_index(scope)
        } else {
            help_topic(scope, &topic)
        };
        return ExecResult { out, ..Default::default() };
    }

    // Ping / traceroute / bandwidth-test commands
    if lower_refs[0] == "ping" || (lower_refs.len() >= 2 && lower_refs[0] == "tool" && lower_refs[1] == "ping") {
        let arg_start = if lower_refs[0] == "tool" { 2 } else { 1 };
        let args = parse_ping_args(&tokens[arg_start..], &q);
        let target = match args.target {
            Some(t) => t,
            None => return bad("ping <ip|nama> [count=<n>] [size=<byte>]"),
        };

        let dev = net.devices.get(dev_id).unwrap().clone();
        let rs = resolve_dns(net, &dev, &target);
        if let Some(err) = rs.err {
            return ExecResult { out: vec![err], ..Default::default() };
        }

        let ip_target = rs.ip.unwrap();
        let ping_res = if ip_target.contains(':') {
            ping6(net, dev_id, &ip_target)
        } else {
            ping(net, dev_id, &ip_target, "icmp", "")
        };

        let ms = if ping_res.ok { ping_res.hops.len().max(1) as u32 } else { 0 };
        let mut out = Vec::new();

        if ping_res.ok {
            for i in 0..args.count {
                out.push(format!("reply from {} seq={} size={} ttl={} time={}ms", ip_target, i, args.size, 64 - ping_res.hops.len(), ms));
            }
            out.push(format!("{} packets transmitted, {} received, 0% packet loss", args.count, args.count));
        } else {
            for _ in 0..args.count {
                out.push("timeout".to_string());
            }
            if let Some(err) = &ping_res.err {
                out.push(err.clone());
            }
            out.push(format!("{} packets transmitted, 0 received, 100% packet loss", args.count));
        }

        return ExecResult {
            out,
            anim: Some(ping_res.path),
            ok: Some(ping_res.ok),
            hops: Some(ping_res.hops),
            clear: false,
        };
    }

    if lower_refs[0] == "traceroute" || (lower_refs.len() >= 2 && lower_refs[0] == "tool" && lower_refs[1] == "traceroute") {
        let arg_start = if lower_refs[0] == "tool" { 2 } else { 1 };
        let target = match tokens.get(arg_start) {
            Some(t) => t,
            None => return bad("traceroute <ip|nama>"),
        };

        let dev = net.devices.get(dev_id).unwrap().clone();
        let rs = resolve_dns(net, &dev, target);
        if let Some(err) = rs.err {
            return ExecResult { out: vec![err], ..Default::default() };
        }

        let ip_target = rs.ip.unwrap();
        let ping_res = if ip_target.contains(':') {
            ping6(net, dev_id, &ip_target)
        } else {
            ping(net, dev_id, &ip_target, "icmp", "")
        };

        let mut out = vec![format!("traceroute ke {}", ip_target)];
        for (i, h) in ping_res.hops.iter().enumerate() {
            out.push(format!("{}  {}  {}ms", i + 1, h, i + 1));
        }
        if !ping_res.ok {
            if let Some(err) = &ping_res.err {
                out.push(format!("* {}", err));
            }
        }

        return ExecResult {
            out,
            anim: Some(ping_res.path),
            ok: Some(ping_res.ok),
            hops: Some(ping_res.hops),
            clear: false,
        };
    }

    if lower_refs[0] == "speedtest" || (lower_refs.len() >= 2 && lower_refs[0] == "tool" && lower_refs[1] == "bandwidth-test") {
        let ip = q.get("address").cloned().or_else(|| tokens.get(if lower_refs[0] == "speedtest" { 1 } else { 2 }).cloned());
        let target_ip = match ip {
            Some(i) => i,
            None => return bad("tool bandwidth-test address=<ip> [protocol=tcp|udp] [direction=transmit|receive|both] [duration=10s]"),
        };

        let dev = net.devices.get(dev_id).unwrap().clone();
        let rs = resolve_dns(net, &dev, &target_ip);
        if let Some(err) = rs.err {
            return ExecResult { out: vec![err], ..Default::default() };
        }

        let bw_res = bw(net, dev_id, &rs.ip.unwrap());
        if !bw_res.ok {
            return ExecResult { out: vec![bw_res.err.unwrap_or_else(|| "tujuan tidak terjangkau".to_string())], ..Default::default() };
        }

        let proto = q.get("protocol").map(|s| s.to_uppercase()).unwrap_or_else(|| "TCP".to_string());
        let dir = q.get("direction").map(|s| s.to_lowercase()).unwrap_or_else(|| "both".to_string());
        let duration = q.get("duration").cloned().unwrap_or_else(|| "5s".to_string());

        let tx_val = if dir == "receive" { 0.0 } else { bw_res.tx };
        let rx_val = if dir == "transmit" { 0.0 } else { bw_res.rx };

        return ExecResult {
            out: vec![
                format!("status: running bandwidth test to {} ({}, duration {})", target_ip, proto, duration),
                format!("  tx-current: {:.1} Mbps", tx_val),
                format!("  rx-current: {:.1} Mbps", rx_val),
                format!("  random-loss: {}", if proto == "UDP" { "0.1%" } else { "0.0%" }),
                format!("  jitter: {}", if proto == "UDP" { "1.2ms" } else { "0.4ms" }),
            ],
            anim: Some(bw_res.path),
            ok: Some(true),
            hops: None,
            clear: false,
        };
    }

    if lower_refs.starts_with(&["interface", "print"]) {
        let dev = net.devices.get(dev_id).unwrap();
        let mut out = Vec::new();
        let detail = lower_refs.contains(&"detail");

        if detail {
            out.push("".to_string());
            out.push("Flags: X - disabled, R - running, D - dynamic".to_string());
            out.push("#  NAME             TYPE     MAC-ADDRESS       STATUS            ADDRESS            COMMENT".to_string());
            for (k, i) in dev.ifaces.iter().enumerate() {
                let st = iface_status(net, dev, &i.name);
                let type_str = if i.members.is_some() { "bridge" } else if i.vlan.is_some() { "vlan" } else if i.name.starts_with("wlan") { "wlan" } else { "ether" };
                let addr_str = i.addr.as_deref().or(i.addr6.as_deref()).unwrap_or("");
                out.push(format!("{}  {} {} {} {} {}{}", k, pad(&i.name, 16), pad(type_str, 8), pad(&mac_of(&dev.id, &i.name), 18), pad(&st, 19), pad(addr_str, 20), i.comment.as_deref().unwrap_or("")));
            }
        } else {
            for (k, i) in dev.ifaces.iter().enumerate() {
                let st = iface_status(net, dev, &i.name);
                out.push(format!("{}  {} {}", k, pad(&i.name, 8), st));
            }
        }

        return ExecResult { out, ..Default::default() };
    }

    if lower_refs.starts_with(&["ip", "address", "add"]) {
        let addr = match q.get("address") {
            Some(a) => a,
            None => return bad("address tidak valid"),
        };
        if !valid_cidr(addr) {
            return bad("address tidak valid");
        }

        let iface_name = match q.get("interface") {
            Some(i) => i,
            None => return bad("interface tidak ada"),
        };

        let dev_mut = net.devices.get_mut(dev_id).unwrap();
        if let Some(i) = dev_mut.ifaces.iter_mut().find(|x| x.name == *iface_name) {
            i.addr = Some(addr.clone());
            return ExecResult { out: Vec::new(), ..Default::default() };
        } else {
            return bad("interface tidak ada");
        }
    }

    if lower_refs.starts_with(&["ip", "address", "print"]) {
        let dev = net.devices.get(dev_id).unwrap();
        let list: Vec<&Interface> = dev.ifaces.iter().filter(|i| i.addr.is_some()).collect();
        let mut out = vec!["#  ADDRESS           INTERFACE".to_string()];
        for (k, i) in list.iter().enumerate() {
            out.push(format!("{}  {} {}", k, pad(i.addr.as_ref().unwrap(), 17), i.name));
        }
        return ExecResult { out, ..Default::default() };
    }

    if lower_refs.starts_with(&["ip", "route", "add"]) {
        let dst = match q.get("dst-address") {
            Some(d) => d,
            None => return bad("butuh dst-address=<net/len> gateway=<ip>"),
        };
        let gw = match q.get("gateway") {
            Some(g) => g,
            None => return bad("butuh dst-address=<net/len> gateway=<ip>"),
        };

        if !valid_cidr(dst) || !valid_ip(gw) {
            return bad("butuh dst-address=<net/len> gateway=<ip>");
        }

        let dev_mut = net.devices.get_mut(dev_id).unwrap();
        dev_mut.routes.push(Route {
            dst: dst.clone(),
            gw: gw.clone(),
            dhcp: false,
            ad: Some(1),
            m: None,
            proto: None,
        });

        return ExecResult { out: Vec::new(), ..Default::default() };
    }

    if lower_refs.starts_with(&["ip", "route", "print"]) {
        converge(net);
        let dev = net.devices.get(dev_id).unwrap();
        let mut rows = Vec::new();

        for i in &dev.ifaces {
            if let Some(addr) = &i.addr {
                let net_addr = net_of(addr);
                rows.push(format!("DAC {} {}", pad(&net_addr, 18), i.name));
            }
        }
        for r in &dev.routes {
            rows.push(format!("S   {} {}", pad(&r.dst, 18), r.gw));
        }
        for dr in &dev.dyn_routes {
            let p_flag = if dr.proto == "ospf" { "O" } else { "R" };
            rows.push(format!("{}   {} {}  ({})", p_flag, pad(&dr.dst, 18), dr.gw, dr.m));
        }

        let mut out = vec!["    DST-ADDRESS        GATEWAY".to_string()];
        out.extend(rows);
        return ExecResult { out, ..Default::default() };
    }

    if lower_refs.starts_with(&["system", "identity", "set"]) {
        let name = match q.get("name") {
            Some(n) => n,
            None => return bad("butuh name=<nama>"),
        };
        let dev_mut = net.devices.get_mut(dev_id).unwrap();
        dev_mut.name = name.clone();
        return ExecResult { out: Vec::new(), ..Default::default() };
    }

    ExecResult {
        out: vec![format!("bad command name {}", tokens[0]), "ketik 'help' untuk daftar perintah".to_string()],
        ..Default::default()
    }
}
