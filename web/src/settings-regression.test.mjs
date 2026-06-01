import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const i18n = readFileSync(new URL('./i18n.ts', import.meta.url), 'utf8')

const testConnection = app.match(/async function testConnection[\s\S]*?async function refreshSessions/)
assert.ok(testConnection, 'testConnection function should be present')
assert.equal(testConnection[0].includes('setView("sessions")'), false, 'Test Connection must not navigate away from settings')
assert.equal(testConnection[0].includes('setConfig(configToTest)'), false, 'Test Connection must not save/apply draft settings')
assert.equal(testConnection[0].includes('localStorage.setItem(STORAGE_KEY'), false, 'Test Connection must not persist draft settings')

const saveConfig = app.match(/function saveConfig[\s\S]*?async function testConnection/)
assert.ok(saveConfig, 'saveConfig function should be present')
assert.equal(saveConfig[0].includes('setView("sessions")'), false, 'Save must leave success notice visible on settings page')
assert.equal(app.includes("t('settings.openSessions')"), false, 'Settings page must not show an unrelated Open Sessions action')
assert.ok(app.includes("t('settings.draftHint')"), 'Settings page should explain that edits are drafts until Save')
assert.equal(i18n.includes("'settings.openSessions'"), false, 'Open Sessions label should not be translated when the action is removed')
assert.ok(i18n.includes("'settings.testedNotSaved'"), 'Test success should explicitly say it did not save')

console.log('settings regression tests passed')
