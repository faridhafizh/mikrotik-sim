use crate::engine::{bw, converge, ping, simulate_packet_flow};
use crate::labs::{check_custom_lab, CustomLab, ObjectiveResult};
use crate::models::{BandwidthResult, ExecResult, FlowResult, Network, PingResult};
use crate::ros::registry::{exec, export_of};
use tauri::command;

#[command]
pub fn exec_command(mut net: Network, dev_id: String, line: String) -> Result<(Network, ExecResult), String> {
    let res = exec(&mut net, &dev_id, &line);
    Ok((net, res))
}

#[command]
pub fn simulate_flow(
    mut net: Network,
    src_dev_id: String,
    dst_ip: String,
    proto: Option<String>,
    dport: Option<String>,
) -> Result<FlowResult, String> {
    let p = proto.unwrap_or_else(|| "icmp".to_string());
    let dp = dport.unwrap_or_default();
    let res = simulate_packet_flow(&mut net, &src_dev_id, &dst_ip, &p, &dp);
    Ok(res)
}

#[command]
pub fn ping_test(
    mut net: Network,
    src_id: String,
    dst_ip: String,
    proto: Option<String>,
    dport: Option<String>,
) -> Result<PingResult, String> {
    let p = proto.unwrap_or_else(|| "icmp".to_string());
    let dp = dport.unwrap_or_default();
    let res = ping(&mut net, &src_id, &dst_ip, &p, &dp);
    Ok(res)
}

#[command]
pub fn bw_test(mut net: Network, src_id: String, dst_ip: String) -> Result<BandwidthResult, String> {
    let res = bw(&mut net, &src_id, &dst_ip);
    Ok(res)
}

#[command]
pub fn converge_routes(mut net: Network) -> Result<Network, String> {
    converge(&mut net);
    Ok(net)
}

#[command]
pub fn evaluate_lab(mut net: Network, lab: CustomLab) -> Result<Vec<ObjectiveResult>, String> {
    let res = check_custom_lab(&mut net, &lab);
    Ok(res)
}

#[command]
pub fn get_export_config(net: Network, dev_id: String) -> Result<Vec<String>, String> {
    let dev = net
        .devices
        .get(&dev_id)
        .ok_or_else(|| "Device not found".to_string())?;
    Ok(export_of(&net, dev))
}
