import { linkStatus } from './linkmodel.js'

export const ifaceUp = (links, devId, iface) => links.some(l => (l.a.dev === devId && l.a.if === iface) || (l.b.dev === devId && l.b.if === iface))
export const deviceHasLink = (links, devId) => links.some(l => l.a.dev === devId || l.b.dev === devId)
// Link UP secara medium (medium port A = port B = medium kabel). ifaceUp tetap arti "tercolok".
export const linkUp = (net, link) => linkStatus(net, link).up
