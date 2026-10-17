pub fn help_index(scope: &str) -> Vec<String> {
    match scope {
        "switch" => vec![
            "Perintah untuk perangkat ini. Ketik 'help <topik>' (mis. help vlan) untuk detail.".to_string(),
            "".to_string(),
            "VLAN: vlan access, vlan trunk, vlan print, vlan remove".to_string(),
            "Lain: interface print, system identity set, export".to_string(),
        ],
        "host" => vec![
            "Perintah untuk perangkat ini. Ketik 'help <topik>' (mis. help ip) untuk detail.".to_string(),
            "".to_string(),
            "Windows CMD: ipconfig, ping, tracert, nslookup, arp, route, netsh".to_string(),
            "Konfigurasi IP: ip address add, ip route add, dhcp, wifi connect".to_string(),
        ],
        _ => vec![
            "Perintah untuk perangkat ini. Ketik 'help <topik>' (mis. help dhcp) untuk detail.".to_string(),
            "".to_string(),
            "Alamat IP: ip address add, ip address print".to_string(),
            "Routing: ip route add, ip route print, routing ospf, routing rip".to_string(),
            "DHCP: ip pool add, ip dhcp-server add, ip dhcp-server network add".to_string(),
            "Firewall/NAT: ip firewall filter add, ip firewall nat add".to_string(),
            "Lain: interface print, export, ping, traceroute, tool bandwidth-test".to_string(),
        ],
    }
}

pub fn help_topic(scope: &str, topic: &str) -> Vec<String> {
    vec![
        format!("Bantuan topik '{}' untuk scope '{}':", topic, scope),
        "Ketik perintah sesuai dengan pedoman CLI RouterOS / Windows CMD.".to_string(),
    ]
}
