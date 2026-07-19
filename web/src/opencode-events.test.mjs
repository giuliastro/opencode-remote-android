import assert from 'node:assert/strict'
import {
  createOpenCodeEventSubscription,
  parseOpenCodeEvent,
  streamURL
} from './opencode-events.ts'

// Captured from OpenCode 1.17.17 GET /event. No `event:` line was present,
// so browser EventSource dispatches these frames through onmessage.
const serverConnected = '{"id":"evt_f7b696456001nNtrSlcthY9fp2","type":"server.connected","properties":{}}'
const sessionCreated = '{"id":"evt_f7b697d14001eRcElcwwtqJe5M","type":"session.created","properties":{"sessionID":"ses_0849682ecffebuK36ytRJ4yFbK","info":{"id":"ses_0849682ecffebuK36ytRJ4yFbK","title":"SSE prototype probe"}}}'
const serverHeartbeat = '{"id":"evt_f7b698b6f001csz0LF7XTKPuPw","type":"server.heartbeat","properties":{}}'
const globalSessionCreated = JSON.stringify({
  directory: '/home/giulio/Software/opencode-remote-android',
  payload: JSON.parse(sessionCreated)
})

assert.deepEqual(parseOpenCodeEvent(sessionCreated), {
  ok: true, name: 'message', raw: sessionCreated, data: JSON.parse(sessionCreated)
})
assert.deepEqual(parseOpenCodeEvent(globalSessionCreated), {
  ok: true, name: 'message', raw: globalSessionCreated, data: JSON.parse(globalSessionCreated)
})
assert.deepEqual(parseOpenCodeEvent(JSON.stringify(['future', 'event']), 'future.event'), {
  ok: true, name: 'future.event', raw: JSON.stringify(['future', 'event']), data: ['future', 'event']
})
const malformed = parseOpenCodeEvent('not json')
assert.equal(malformed.ok, false)
assert.equal(malformed.raw, 'not json')
assert.equal(malformed.name, 'message')

assert.equal(streamURL('http://127.0.0.1:4097', 'project'), 'http://127.0.0.1:4097/event')
assert.equal(streamURL('http://127.0.0.1:4097/', 'project', '/repo with spaces'), 'http://127.0.0.1:4097/event?directory=%2Frepo+with+spaces')
assert.equal(streamURL('https://server.example', 'global'), 'https://server.example/global/event')

const sources = []
const delays = []
const events = []
const statuses = []
const logs = []
const timers = []
let nextTimerID = 1

const subscription = createOpenCodeEventSubscription({
  url: 'http://127.0.0.1:4097/event',
  reconnect: { initialDelayMs: 100, maxDelayMs: 400 },
  createEventSource(url) {
    const source = { url, closeCalls: 0, close() { this.closeCalls += 1 } }
    sources.push(source)
    return source
  },
  schedule(callback, delay) {
    delays.push(delay)
    const timer = { id: nextTimerID++, callback, cancelled: false }
    timers.push(timer)
    return timer.id
  },
  cancel(timerID) {
    const timer = timers.find((item) => item.id === timerID)
    if (timer) timer.cancelled = true
  },
  onEvent(event) { events.push(event) },
  onStatus(status) { statuses.push(status) },
  logger(message) { logs.push(message) }
})

assert.equal(sources.length, 1)
sources[0].onopen?.()
assert.deepEqual(statuses.at(-1), { type: 'connected' })
sources[0].onmessage?.({ data: serverConnected })
sources[0].onmessage?.({ data: sessionCreated })
sources[0].onmessage?.({ data: serverHeartbeat })
assert.equal(events.length, 3)
assert.deepEqual(events[1].data, JSON.parse(sessionCreated))
sources[0].onmessage?.({ data: 'malformed' })
assert.equal(events.length, 3)
assert.deepEqual(statuses.at(-1), { type: 'parse-error', data: 'malformed' })
assert.ok(logs.some((message) => message.includes('unparseable message event')))

sources[0].onerror?.()
assert.equal(sources[0].closeCalls, 1)
assert.deepEqual(delays, [100])
timers[0].callback()
assert.equal(sources.length, 2)
sources[1].onopen?.()
sources[0].onerror?.()
assert.equal(sources[1].closeCalls, 0, 'stale source must not close the current source')
assert.deepEqual(delays, [100], 'stale source must not schedule a reconnect')

sources[1].onerror?.()
assert.deepEqual(delays, [100, 100], 'open resets retry delay')
timers[1].callback()
assert.equal(sources.length, 3)
sources[2].onerror?.()
assert.deepEqual(delays, [100, 100, 200])
timers[2].callback()
assert.equal(sources.length, 4)
sources[3].onerror?.()
assert.deepEqual(delays, [100, 100, 200, 400])
timers[3].callback()
assert.equal(sources.length, 5)
sources[4].onerror?.()
assert.deepEqual(delays, [100, 100, 200, 400, 400])
subscription.close()
assert.equal(sources[4].closeCalls, 1)
assert.equal(timers[4].cancelled, true)
assert.deepEqual(statuses.at(-1), { type: 'closed' })
sources[4].onmessage?.({ data: sessionCreated })
assert.equal(events.length, 3)
subscription.close()
assert.equal(sources[4].closeCalls, 1, 'close must be idempotent')

const invalidDelays = []
const invalidSubscription = createOpenCodeEventSubscription({
  url: 'http://127.0.0.1:4097/event',
  reconnect: { initialDelayMs: 0, maxDelayMs: -1 },
  createEventSource() { throw new Error('factory unavailable') },
  schedule(_callback, delay) { invalidDelays.push(delay); return 1 },
  cancel() {},
  onEvent() {},
  onStatus() {},
  logger() {}
})
assert.deepEqual(invalidDelays, [1_000], 'invalid retry delays should fall back safely')
invalidSubscription.close()

console.log('OpenCode event subscription tests passed')
