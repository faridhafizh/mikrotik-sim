import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNet } from '../src/stores/net.js'
import { simulatePacketFlow } from '../src/engine.js'

describe('New Features - Firewall Scan, Mission Builder, Bandwidth Test', () => {
  let net

  beforeAll(() => {
    if (typeof global.localStorage === 'undefined') {
      const store = {}
      global.localStorage = {
        getItem: k => store[k] || null,
        setItem: (k, v) => { store[k] = String(v) },
        removeItem: k => { delete store[k] },
        clear: () => { Object.keys(store).forEach(k => delete store[k]) }
      }
    }
    if (typeof global.window === 'undefined') {
      global.window = { matchMedia: () => ({ matches: false }) }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    net = useNet()
    net.add('router', 100, 100, 'R1')
    net.add('router', 300, 100, 'R2')
    const keys = Object.keys(net.devices)
    const id1 = keys[0]
    const id2 = keys[1]
    net.devices[id1].ifaces[0].addr = '10.0.0.1/24'
    net.devices[id2].ifaces[0].addr = '10.0.0.2/24'
    net.connect(id1, 'ether1', id2, 'ether1', 'cat6')
  })

  it('simulates packet flow through firewall chains', () => {
    const keys = Object.keys(net.devices)
    const id1 = keys[0]
    const id2 = keys[1]

    // Add firewall drop rule on R2
    net.devices[id2].fw = [
      { chain: 'input', action: 'drop', src: '10.0.0.1', dst: '10.0.0.2', proto: 'icmp', dport: '' }
    ]

    const scan = simulatePacketFlow(net, {
      srcDevId: id1,
      dstIp: '10.0.0.2',
      proto: 'icmp',
      dport: ''
    })

    expect(scan.ok).toBe(false)
    expect(scan.finalStatus).toContain('DROPPED')
    expect(scan.hops.length).toBeGreaterThan(0)
  })

  it('creates and checks custom lab objectives', async () => {
    const customLab = {
      id: 'test-lab-1',
      title: 'Test Lab',
      custom: true,
      objectives: [
        { type: 'ifaceIp', target: 'R1:10.0.0.1/24', label: 'R1 IP Check' },
        { type: 'ping', target: '10.0.0.2', label: 'Ping Reachability' }
      ]
    }

    net.addCustomLab(customLab)
    expect(net.labs.some(l => l.id === 'test-lab-1')).toBe(true)

    const passed = await net.checkLab('test-lab-1')
    expect(passed).toBe(true)
    expect(net.results['test-lab-1']).toHaveLength(2)
    expect(net.results['test-lab-1'].every(r => r.ok)).toBe(true)
  })

  it('runs bandwidth test CLI command', async () => {
    const id1 = Object.keys(net.devices)[0]
    net.selected = id1
    await net.run('tool bandwidth-test address=10.0.0.2 protocol=tcp direction=both duration=5s')

    const termLogs = net.term[id1]
    expect(termLogs.some(l => l.includes('running bandwidth test to 10.0.0.2'))).toBe(true)
    expect(termLogs.some(l => l.includes('tx-current'))).toBe(true)
  })
})
