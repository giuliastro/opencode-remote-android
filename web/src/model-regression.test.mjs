import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')
const i18n = readFileSync(new URL('./i18n.ts', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

assert.ok(api.includes('listModels(config: ServerConfig'), 'API should expose configured OpenCode models')
assert.ok(api.includes('withDirectory("/config/providers"'), 'model list should use official /config/providers with directory scoping')
assert.ok(api.includes('`/session/${sessionID}/prompt_async`'), 'chat prompts should use OpenCode async prompt endpoint')
assert.ok(api.includes('return request<boolean>(config, withDirectory(`/session/${sessionID}/prompt_async`, directory)'), 'async prompt should return after 204 instead of waiting for assistant output')
assert.ok(api.includes('model: toModelBody(model)'), 'prompt requests should send selected model object')
assert.ok(api.includes('variant: model?.variant || undefined'), 'prompt requests should preserve selected model variant')
assert.ok(api.includes('toCreateSessionModel'), 'new sessions should be creatable with the selected model')
assert.ok(app.includes('MODEL_STORAGE_KEY'), 'selected AI model should persist locally')
assert.ok(app.includes('session-context-strip'), 'detail UX should expose compact mobile context chips')
assert.ok(app.includes('activeDetailSheet === "ai"'), 'model picker should open in the bottom sheet')
assert.ok(app.includes("t('detail.modelHint')"), 'model picker should explain when the change applies')
assert.ok(app.includes('disabled={isWorking}'), 'model picker should be disabled while a session is running')
assert.ok(app.includes('api.createSession(config, "Mobile session", activeModel, directory)'), 'new sessions should inherit the selected model')
assert.ok(app.includes('api.sendPrompt(config, selectedSession.id, text, selectedSession.directory, activeModel)'), 'chat prompts should use selected model')
assert.ok(app.includes('showFilesChip = diffFiles.length > 0'), 'file diff chip should be hidden for dialogue-only sessions')
assert.ok(i18n.includes("'detail.contextStripLabel'"), 'context chip strings should be translated')
assert.ok(i18n.includes("'detail.modelToolsYes'"), 'model capability text should be translated')
assert.ok(/\.context-chip[\s\S]*?overflow/.test(styles), 'context chips should have compact mobile styling')
assert.ok(/\.bottom-sheet[\s\S]*?max-height/.test(styles), 'model/details should use a mobile bottom sheet')

console.log('model picker regression tests passed')
