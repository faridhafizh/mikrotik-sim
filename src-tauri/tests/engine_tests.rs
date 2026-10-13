use app_lib::engine::*;
use app_lib::models::*;
use app_lib::ros::registry::exec;
use std::collections::HashMap;

fn create_sample_network() -> Network {
    let mut devices = HashMap::new();

    // PC1: 192.168.1.10/24, GW: 192.168.1.1
    let pc1 = Device {
        id: "d1".to_string(),
        name: "PC1".to_string(),
        type_: "pc".to_string(),
        x: 100.0,
        y: 100.0,
        ifaces: vec![Interface {
            name: "eth0".to_string(),
            addr: Some("192.168.1.10/24".to_string()),
            kind: Some("GBE".to_string()),
            ..Default::default()
        }],
        routes: vec![Route {
            dst: "0.0.0.0/0".to_string(),
            gw: "192.168.1.1".to_string(),
            ..Default::default()
        }],
        ..Default::default()
    };

    // R1: ether1=192.168.1.1/24, ether2=10.0.0.1/24
    let r1 = Device {
        id: "d2".to_string(),
        name: "R1".to_string(),
        type_: "router".to_string(),
        x: 300.0,
        y: 100.0,
        ifaces: vec![
            Interface {
                name: "ether1".to_string(),
                addr: Some("192.168.1.1/24".to_string()),
                kind: Some("GBE".to_string()),
                ..Default::default()
            },
            Interface {
                name: "ether2".to_string(),
                addr: Some("10.0.0.1/24".to_string()),
                kind: Some("GBE".to_string()),
                ..Default::default()
            },
        ],
        routes: vec![Route {
            dst: "192.168.2.0/24".to_string(),
            gw: "10.0.0.2".to_string(),
            ..Default::default()
        }],
        ..Default::default()
    };

    // R2: ether1=10.0.0.2/24, ether2=192.168.2.1/24
    let r2 = Device {
        id: "d3".to_string(),
        name: "R2".to_string(),
        type_: "router".to_string(),
        x: 500.0,
        y: 100.0,
        ifaces: vec![
            Interface {
                name: "ether1".to_string(),
                addr: Some("10.0.0.2/24".to_string()),
                kind: Some("GBE".to_string()),
                ..Default::default()
            },
            Interface {
                name: "ether2".to_string(),
                addr: Some("192.168.2.1/24".to_string()),
                kind: Some("GBE".to_string()),
                ..Default::default()
            },
        ],
        routes: vec![Route {
            dst: "192.168.1.0/24".to_string(),
            gw: "10.0.0.1".to_string(),
            ..Default::default()
        }],
        ..Default::default()
    };

    // PC2: 192.168.2.10/24, GW: 192.168.2.1
    let pc2 = Device {
        id: "d4".to_string(),
        name: "PC2".to_string(),
        type_: "pc".to_string(),
        x: 700.0,
        y: 100.0,
        ifaces: vec![Interface {
            name: "eth0".to_string(),
            addr: Some("192.168.2.10/24".to_string()),
            kind: Some("GBE".to_string()),
            ..Default::default()
        }],
        routes: vec![Route {
            dst: "0.0.0.0/0".to_string(),
            gw: "192.168.2.1".to_string(),
            ..Default::default()
        }],
        ..Default::default()
    };

    devices.insert("d1".to_string(), pc1);
    devices.insert("d2".to_string(), r1);
    devices.insert("d3".to_string(), r2);
    devices.insert("d4".to_string(), pc2);

    let links = vec![
        Link {
            a: LinkEnd { dev: "d1".to_string(), if_: "eth0".to_string() },
            b: LinkEnd { dev: "d2".to_string(), if_: "ether1".to_string() },
            cable: "cat6".to_string(),
        },
        Link {
            a: LinkEnd { dev: "d2".to_string(), if_: "ether2".to_string() },
            b: LinkEnd { dev: "d3".to_string(), if_: "ether1".to_string() },
            cable: "cat6".to_string(),
        },
        Link {
            a: LinkEnd { dev: "d3".to_string(), if_: "ether2".to_string() },
            b: LinkEnd { dev: "d4".to_string(), if_: "eth0".to_string() },
            cable: "cat6".to_string(),
        },
    ];

    Network {
        devices,
        links,
        notes: HashMap::new(),
    }
}

#[test]
fn test_ping_and_routing() {
    let mut net = create_sample_network();
    let res = ping(&mut net, "d1", "192.168.2.10", "icmp", "");
    assert!(res.ok, "PC1 should reach PC2 across 2 routers");
    assert_eq!(res.path, vec!["d1", "d2", "d3", "d4", "d3", "d2", "d1"]);
}

#[test]
fn test_firewall_drop() {
    let mut net = create_sample_network();

    // Drop forward packets on R1 destined for 192.168.2.10
    if let Some(r1) = net.devices.get_mut("d2") {
        r1.fw = Some(vec![FirewallRule {
            chain: "forward".to_string(),
            action: "drop".to_string(),
            dst: Some("192.168.2.10/32".to_string()),
            ..Default::default()
        }]);
    }

    let res = ping(&mut net, "d1", "192.168.2.10", "icmp", "");
    assert!(!res.ok, "Ping should be blocked by R1 forward drop rule");

    let flow = simulate_packet_flow(&mut net, "d1", "192.168.2.10", "icmp", "");
    assert!(!flow.ok);
    assert_eq!(flow.final_status, "DROPPED (FORWARD CHAIN)");
}

#[test]
fn test_cli_execution() {
    let mut net = create_sample_network();

    let exec_res = exec(&mut net, "d1", "ipconfig /all");
    assert!(!exec_res.out.is_empty());
    assert!(exec_res.out[0].contains("Windows IP Configuration"));

    let r1_exec = exec(&mut net, "d2", "ip address print");
    assert!(r1_exec.out.iter().any(|line| line.contains("192.168.1.1")));
}
