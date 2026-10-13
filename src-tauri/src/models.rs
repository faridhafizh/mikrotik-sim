use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Interface {
    pub name: String,
    #[serde(default)]
    pub addr: Option<String>,
    #[serde(default)]
    pub addr6: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default)]
    pub comment: Option<String>,
    #[serde(default)]
    pub mtu: Option<u32>,
    #[serde(default)]
    pub members: Option<Vec<String>>,
    #[serde(default)]
    pub vlan: Option<u16>,
    #[serde(default)]
    pub parent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Route {
    pub dst: String,
    pub gw: String,
    #[serde(default)]
    pub dhcp: bool,
    #[serde(default)]
    pub ad: Option<u8>,
    #[serde(default)]
    pub m: Option<u32>,
    #[serde(default)]
    pub proto: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Route6 {
    pub dst: String,
    pub gw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DynamicRoute {
    pub dst: String,
    pub gw: String,
    pub ad: u8,
    pub m: u32,
    pub proto: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WlanConfig {
    pub ssid: String,
    #[serde(default)]
    pub pass: String,
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PortConfig {
    #[serde(default = "default_access")]
    pub mode: String,
    #[serde(default = "default_vlan_1")]
    pub vlan: u16,
    #[serde(default)]
    pub vlans: Option<Vec<u16>>,
}

fn default_access() -> String {
    "access".to_string()
}
fn default_vlan_1() -> u16 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FirewallRule {
    pub chain: String,
    pub action: String,
    #[serde(default)]
    pub src: Option<String>,
    #[serde(default)]
    pub dst: Option<String>,
    #[serde(default)]
    pub proto: Option<String>,
    #[serde(default)]
    pub dport: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NatRule {
    #[serde(default = "default_srcnat")]
    pub chain: String,
    #[serde(default = "default_masquerade")]
    pub action: String,
    #[serde(default)]
    pub out: Option<String>,
    #[serde(default)]
    pub redirect: bool,
    #[serde(default)]
    pub to_addr: Option<String>,
    #[serde(default)]
    pub to_port: Option<String>,
    #[serde(default)]
    pub proto: Option<String>,
    #[serde(default)]
    pub dport: Option<String>,
    #[serde(default)]
    pub in_iface: Option<String>,
    #[serde(default)]
    pub dst: Option<String>,
}

fn default_srcnat() -> String {
    "srcnat".to_string()
}
fn default_masquerade() -> String {
    "masquerade".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Queue {
    pub name: String,
    pub target: String,
    pub up: f64,
    pub down: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct QueueType {
    pub name: String,
    pub rate: f64,
    pub classifier: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct QueueTree {
    pub name: String,
    pub up: f64,
    pub down: f64,
    #[serde(default)]
    pub mark: String,
    #[serde(default)]
    pub queue: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AddressListItem {
    pub list: String,
    pub address: String,
    #[serde(default)]
    pub timeout: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DnsStatic {
    pub name: String,
    pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Pool {
    pub name: String,
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DHCPServer {
    pub name: String,
    pub interface: String,
    pub pool: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DHCPNetwork {
    pub address: String,
    #[serde(default)]
    pub gateway: Option<String>,
    #[serde(default)]
    pub dns: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DHCPLease {
    pub ip: String,
    pub by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DHCPClient {
    pub interface: String,
    #[serde(default)]
    pub ip: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct User {
    pub name: String,
    pub group: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Service {
    pub name: String,
    pub port: u16,
    #[serde(default)]
    pub disabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LogEntry {
    pub ts: u64,
    pub topics: String,
    pub msg: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Device {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub x: f64,
    pub y: f64,

    #[serde(default)]
    pub profile_id: Option<String>,

    #[serde(default)]
    pub ifaces: Vec<Interface>,

    #[serde(default)]
    pub routes: Vec<Route>,

    #[serde(default)]
    pub routes6: Vec<Route6>,

    #[serde(default)]
    pub dyn_routes: Vec<DynamicRoute>,

    #[serde(default)]
    pub stp: Option<String>,

    #[serde(default)]
    pub wlan: Option<WlanConfig>,

    #[serde(default)]
    pub wifi: Option<WlanConfig>,

    #[serde(default)]
    pub ports: Option<HashMap<String, PortConfig>>,

    #[serde(default)]
    pub fw: Option<Vec<FirewallRule>>,

    #[serde(default)]
    pub nat: Option<Vec<NatRule>>,

    #[serde(default)]
    pub queues: Option<Vec<Queue>>,

    #[serde(default)]
    pub qtypes: Option<Vec<QueueType>>,

    #[serde(default)]
    pub qtrees: Option<Vec<QueueTree>>,

    #[serde(default)]
    pub addr_list: Option<Vec<AddressListItem>>,

    #[serde(default)]
    pub dns_static: Option<Vec<DnsStatic>>,

    #[serde(default)]
    pub pools: Option<Vec<Pool>>,

    #[serde(default)]
    pub dhcp: Option<Vec<DHCPServer>>,

    #[serde(default)]
    pub dhcp_nets: Option<Vec<DHCPNetwork>>,

    #[serde(default)]
    pub leases: Option<Vec<DHCPLease>>,

    #[serde(default)]
    pub dhcp_client: Option<Vec<DHCPClient>>,

    #[serde(default)]
    pub rip: Option<Vec<String>>,

    #[serde(default)]
    pub ospf: Option<Vec<String>>,

    #[serde(default)]
    pub users: Option<Vec<User>>,

    #[serde(default)]
    pub services: Option<Vec<Service>>,

    #[serde(default)]
    pub log: Option<Vec<LogEntry>>,

    #[serde(default)]
    pub dns: Option<String>,

    #[serde(default)]
    pub dns_remote: Option<String>,

    #[serde(default)]
    pub dns_cache: Option<Vec<String>>,

    #[serde(default)]
    pub arp_blocked: Option<Vec<String>>,

    #[serde(default)]
    pub clock_date: Option<String>,

    #[serde(default)]
    pub clock_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkEnd {
    pub dev: String,
    #[serde(rename = "if")]
    pub if_: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Link {
    pub a: LinkEnd,
    pub b: LinkEnd,
    #[serde(default = "default_cat6")]
    pub cable: String,
}

fn default_cat6() -> String {
    "cat6".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Network {
    pub devices: HashMap<String, Device>,
    pub links: Vec<Link>,
    #[serde(default)]
    pub notes: HashMap<String, Note>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkStatusInfo {
    pub up: bool,
    pub speed: u32,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainStep {
    pub chain: String,
    pub action: String,
    #[serde(default)]
    pub matched_rule: Option<String>,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HopStep {
    pub hop: u32,
    pub dev_id: String,
    pub dev_name: String,
    pub dev_type: String,
    pub src_ip: String,
    pub dst_ip: String,
    pub chains: Vec<ChainStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowResult {
    pub ok: bool,
    pub final_status: String,
    #[serde(default)]
    pub error: Option<String>,
    pub hops: Vec<HopStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingResult {
    pub ok: bool,
    pub path: Vec<String>,
    pub hops: Vec<String>,
    #[serde(default)]
    pub err: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BandwidthResult {
    pub ok: bool,
    pub path: Vec<String>,
    pub tx: f64,
    pub rx: f64,
    #[serde(default)]
    pub err: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExecResult {
    pub out: Vec<String>,
    #[serde(default)]
    pub clear: bool,
    #[serde(default)]
    pub anim: Option<Vec<String>>,
    #[serde(default)]
    pub ok: Option<bool>,
    #[serde(default)]
    pub hops: Option<Vec<String>>,
}
