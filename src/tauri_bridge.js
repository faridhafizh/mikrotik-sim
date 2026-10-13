// Tauri IPC Bridge
import { invoke } from '@tauri-apps/api/core'

export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function tauriExecCommand(net, devId, line) {
  if (isTauri()) {
    try {
      const [updatedNet, res] = await invoke('exec_command', { net, devId, line })
      return { updatedNet, res }
    } catch (e) {
      console.warn('Tauri IPC exec_command error:', e)
    }
  }
  return null
}

export async function tauriSimulateFlow(net, srcDevId, dstIp, proto = 'icmp', dport = '') {
  if (isTauri()) {
    try {
      return await invoke('simulate_flow', { net, srcDevId, dstIp, proto, dport })
    } catch (e) {
      console.warn('Tauri IPC simulate_flow error:', e)
    }
  }
  return null
}

export async function tauriPingTest(net, srcId, dstIp, proto = 'icmp', dport = '') {
  if (isTauri()) {
    try {
      return await invoke('ping_test', { net, srcId, dstIp, proto, dport })
    } catch (e) {
      console.warn('Tauri IPC ping_test error:', e)
    }
  }
  return null
}

export async function tauriBwTest(net, srcId, dstIp) {
  if (isTauri()) {
    try {
      return await invoke('bw_test', { net, srcId, dstIp })
    } catch (e) {
      console.warn('Tauri IPC bw_test error:', e)
    }
  }
  return null
}

export async function tauriEvaluateLab(net, lab) {
  if (isTauri()) {
    try {
      return await invoke('evaluate_lab', { net, lab })
    } catch (e) {
      console.warn('Tauri IPC evaluate_lab error:', e)
    }
  }
  return null
}
