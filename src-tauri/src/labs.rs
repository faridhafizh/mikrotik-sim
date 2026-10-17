use crate::engine::ping;
use crate::models::Network;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabObjective {
    pub label: Option<String>,
    #[serde(rename = "type")]
    pub type_: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomLab {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub objectives: Vec<LabObjective>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectiveResult {
    pub label: String,
    pub ok: bool,
}

pub fn check_custom_lab(net: &mut Network, lab: &CustomLab) -> Vec<ObjectiveResult> {
    let mut results = Vec::new();

    for obj in &lab.objectives {
        let label = obj
            .label
            .clone()
            .unwrap_or_else(|| format!("{} check {}", obj.type_, obj.target));

        match obj.type_.as_str() {
            "ping" => {
                let src_dev = net.devices.keys().next().cloned();
                let ok = if let Some(s_id) = src_dev {
                    ping(net, &s_id, &obj.target, "icmp", "").ok
                } else {
                    false
                };
                results.push(ObjectiveResult { label, ok });
            }
            "ifaceIp" => {
                let parts: Vec<&str> = obj.target.split(':').collect();
                let dev_name = parts[0];
                let ip_cidr = if parts.len() > 1 { parts[1] } else { "" };

                let dev = net.devices.values().find(|d| d.name == dev_name);
                let ok = dev.map_or(false, |d| {
                    d.ifaces
                        .iter()
                        .any(|i| i.addr.as_deref() == Some(ip_cidr))
                });
                results.push(ObjectiveResult { label, ok });
            }
            "route" => {
                let parts: Vec<&str> = obj.target.split(':').collect();
                let dev_name = parts[0];
                let dst_gw = if parts.len() > 1 { parts[1] } else { "" };

                let dev = net.devices.values().find(|d| d.name == dev_name);
                let ok = dev.map_or(false, |d| {
                    d.routes.iter().any(|r| {
                        format!("{}->{}", r.dst, r.gw) == dst_gw || r.dst == dst_gw
                    })
                });
                results.push(ObjectiveResult { label, ok });
            }
            "fw" => {
                let parts: Vec<&str> = obj.target.split(':').collect();
                let dev_name = parts[0];
                let chain_action = if parts.len() > 1 { parts[1] } else { "" };

                let dev = net.devices.values().find(|d| d.name == dev_name);
                let ok = dev.map_or(false, |d| {
                    d.fw.as_ref().map_or(false, |fw| {
                        fw.iter().any(|f| {
                            format!("{}={}", f.chain, f.action) == chain_action
                                || f.chain == chain_action
                        })
                    })
                });
                results.push(ObjectiveResult { label, ok });
            }
            _ => {
                results.push(ObjectiveResult { label, ok: true });
            }
        }
    }

    results
}
