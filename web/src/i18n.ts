export type LanguageCode = 'en' | 'it' | 'zh-TW'

type TranslationKey =
  | 'app.title'
  | 'nav.settings'
  | 'nav.sessions'
  | 'nav.detail'
  | 'nav.help'
  | 'menu.title'
  | 'menu.settingsDescription'
  | 'menu.sessionsDescription'
  | 'menu.detailDescription'
  | 'menu.helpDescription'
  | 'settings.title'
  | 'settings.host'
  | 'settings.hostPlaceholder'
  | 'settings.port'
  | 'settings.username'
  | 'settings.password'
  | 'settings.passwordPlaceholder'
  | 'settings.save'
  | 'settings.saving'
  | 'settings.test'
  | 'settings.testing'
  | 'settings.testingConnection'
  | 'settings.saved'
  | 'settings.connectedSaved'
  | 'settings.connectionFailed'
  | 'settings.connectedTo'
  | 'settings.language'
  | 'sessions.title'
  | 'sessions.summary'
  | 'sessions.new'
  | 'sessions.creating'
  | 'sessions.refresh'
  | 'sessions.searchPlaceholder'
  | 'sessions.emptyTitle'
  | 'sessions.emptyHint'
  | 'sessions.noFileChanges'
  | 'sessions.updated'
  | 'sessions.open'
  | 'sessions.delete'
  | 'detail.backToSessions'
  | 'detail.selectSession'
  | 'detail.loading'
  | 'detail.emptyTitle'
  | 'detail.emptyHint'
  | 'detail.composerPlaceholder'
  | 'detail.waiting'
  | 'detail.send'
  | 'detail.you'
  | 'detail.opencode'
  | 'todo.title'
  | 'todo.hide'
  | 'todo.show'
  | 'session.deleteTitle'
  | 'session.deleteBodyPrefix'
  | 'session.cancel'
  | 'session.deleteConfirm'
  | 'help.title'
  | 'help.overview'
  | 'help.server'
  | 'help.network'
  | 'help.troubleshooting'
  | 'help.commands'

const translations: Record<LanguageCode, Record<TranslationKey, string>> = {
  en: {
    'app.title': 'OpenCode Remote',
    'nav.settings': 'Settings',
    'nav.sessions': 'Sessions',
    'nav.detail': 'Detail',
    'nav.help': 'Help',
    'menu.title': 'Menu',
    'menu.settingsDescription': 'Configure server connection',
    'menu.sessionsDescription': 'Manage your sessions',
    'menu.detailDescription': 'Chat with OpenCode',
    'menu.helpDescription': 'Documentation & support',
    'settings.title': 'Server Configuration',
    'settings.host': 'Host Address',
    'settings.hostPlaceholder': '192.168.1.100 or localhost',
    'settings.port': 'Port',
    'settings.username': 'Username',
    'settings.password': 'Password',
    'settings.passwordPlaceholder': 'Optional; leave blank for unsecured local server',
    'settings.save': 'Save Configuration',
    'settings.saving': 'Saving...',
    'settings.test': 'Test Connection',
    'settings.testing': 'Testing...',
    'settings.testingConnection': 'Testing connection...',
    'settings.saved': 'Configuration saved. Press Test to validate connectivity.',
    'settings.connectedSaved': 'Connected to OpenCode {version}. Configuration saved.',
    'settings.connectionFailed': 'Connection failed: {message}',
    'settings.connectedTo': 'Connected to OpenCode {version}',
    'settings.language': 'Language',
    'sessions.title': 'Sessions',
    'sessions.summary': '{total} total · {active} active · {changed} changed',
    'sessions.new': 'New Session',
    'sessions.creating': 'Creating...',
    'sessions.refresh': 'Refresh',
    'sessions.searchPlaceholder': 'Search sessions by title or directory...',
    'sessions.emptyTitle': 'No sessions found',
    'sessions.emptyHint': 'Create a new session to get started',
    'sessions.noFileChanges': 'No file changes',
    'sessions.updated': 'Updated {time}',
    'sessions.open': 'Open',
    'sessions.delete': 'Delete',
    'detail.backToSessions': '← Sessions',
    'detail.selectSession': 'Select a session',
    'detail.loading': 'Loading session...',
    'detail.emptyTitle': 'No messages yet',
    'detail.emptyHint': 'Start a conversation below',
    'detail.composerPlaceholder': 'Type a prompt or command (start with / for slash commands)...',
    'detail.waiting': 'Waiting...',
    'detail.send': 'Send',
    'detail.you': '👤 You',
    'detail.opencode': '🤖 OpenCode',
    'todo.title': 'Todo Items',
    'todo.hide': 'Hide',
    'todo.show': 'Show',
    'session.deleteTitle': 'Delete session?',
    'session.deleteBodyPrefix': 'This will permanently delete',
    'session.cancel': 'Cancel',
    'session.deleteConfirm': 'Delete session',
    'help.title': 'Help & Documentation',
    'help.overview': 'Overview',
    'help.server': 'Server',
    'help.network': 'Network',
    'help.troubleshooting': 'Troubleshooting',
    'help.commands': 'Commands'
  },
  it: {
    'app.title': 'OpenCode Remote',
    'nav.settings': 'Impostazioni',
    'nav.sessions': 'Sessioni',
    'nav.detail': 'Dettaglio',
    'nav.help': 'Aiuto',
    'menu.title': 'Menu',
    'menu.settingsDescription': 'Configura connessione server',
    'menu.sessionsDescription': 'Gestisci le sessioni',
    'menu.detailDescription': 'Chatta con OpenCode',
    'menu.helpDescription': 'Documentazione e supporto',
    'settings.title': 'Configurazione server',
    'settings.host': 'Indirizzo host',
    'settings.hostPlaceholder': '192.168.1.100 o localhost',
    'settings.port': 'Porta',
    'settings.username': 'Username',
    'settings.password': 'Password',
    'settings.passwordPlaceholder': 'Opzionale; lascia vuoto per server locale non protetto',
    'settings.save': 'Salva configurazione',
    'settings.saving': 'Salvataggio...',
    'settings.test': 'Test connessione',
    'settings.testing': 'Test...',
    'settings.testingConnection': 'Test connessione...',
    'settings.saved': 'Configurazione salvata. Premi Test per validare la connessione.',
    'settings.connectedSaved': 'Connesso a OpenCode {version}. Configurazione salvata.',
    'settings.connectionFailed': 'Connessione fallita: {message}',
    'settings.connectedTo': 'Connesso a OpenCode {version}',
    'settings.language': 'Lingua',
    'sessions.title': 'Sessioni',
    'sessions.summary': '{total} totali · {active} attive · {changed} con modifiche',
    'sessions.new': 'Nuova sessione',
    'sessions.creating': 'Creazione...',
    'sessions.refresh': 'Aggiorna',
    'sessions.searchPlaceholder': 'Cerca sessioni per titolo o directory...',
    'sessions.emptyTitle': 'Nessuna sessione trovata',
    'sessions.emptyHint': 'Crea una nuova sessione per iniziare',
    'sessions.noFileChanges': 'Nessuna modifica ai file',
    'sessions.updated': 'Aggiornata {time}',
    'sessions.open': 'Apri',
    'sessions.delete': 'Elimina',
    'detail.backToSessions': '← Sessioni',
    'detail.selectSession': 'Seleziona una sessione',
    'detail.loading': 'Caricamento sessione...',
    'detail.emptyTitle': 'Ancora nessun messaggio',
    'detail.emptyHint': 'Inizia una conversazione qui sotto',
    'detail.composerPlaceholder': 'Scrivi un prompt o comando (inizia con / per gli slash command)...',
    'detail.waiting': 'Attesa...',
    'detail.send': 'Invia',
    'detail.you': '👤 Tu',
    'detail.opencode': '🤖 OpenCode',
    'todo.title': 'Todo',
    'todo.hide': 'Nascondi',
    'todo.show': 'Mostra',
    'session.deleteTitle': 'Eliminare la sessione?',
    'session.deleteBodyPrefix': 'Questo eliminerà definitivamente',
    'session.cancel': 'Annulla',
    'session.deleteConfirm': 'Elimina sessione',
    'help.title': 'Aiuto e documentazione',
    'help.overview': 'Panoramica',
    'help.server': 'Server',
    'help.network': 'Rete',
    'help.troubleshooting': 'Risoluzione problemi',
    'help.commands': 'Comandi'
  },
  'zh-TW': {
    'app.title': 'OpenCode 遠端',
    'nav.settings': '設定',
    'nav.sessions': '工作階段',
    'nav.detail': '詳情',
    'nav.help': '說明',
    'menu.title': '選單',
    'menu.settingsDescription': '設定伺服器連線',
    'menu.sessionsDescription': '管理工作階段',
    'menu.detailDescription': '與 OpenCode 對話',
    'menu.helpDescription': '文件與支援',
    'settings.title': '伺服器設定',
    'settings.host': '主機位址',
    'settings.hostPlaceholder': '192.168.1.100 或 localhost',
    'settings.port': '連接埠',
    'settings.username': '使用者名稱',
    'settings.password': '密碼',
    'settings.passwordPlaceholder': '選填；未受保護的本機伺服器可留空',
    'settings.save': '儲存設定',
    'settings.saving': '儲存中...',
    'settings.test': '測試連線',
    'settings.testing': '測試中...',
    'settings.testingConnection': '正在測試連線...',
    'settings.saved': '設定已儲存。請按「測試」驗證連線。',
    'settings.connectedSaved': '已連線至 OpenCode {version}。設定已儲存。',
    'settings.connectionFailed': '連線失敗：{message}',
    'settings.connectedTo': '已連線至 OpenCode {version}',
    'settings.language': '語言',
    'sessions.title': '工作階段',
    'sessions.summary': '{total} 總數 · {active} 進行中 · {changed} 有變更',
    'sessions.new': '新增工作階段',
    'sessions.creating': '建立中...',
    'sessions.refresh': '重新整理',
    'sessions.searchPlaceholder': '依標題或目錄搜尋工作階段...',
    'sessions.emptyTitle': '找不到工作階段',
    'sessions.emptyHint': '建立新的工作階段以開始',
    'sessions.noFileChanges': '沒有檔案變更',
    'sessions.updated': '更新於 {time}',
    'sessions.open': '開啟',
    'sessions.delete': '刪除',
    'detail.backToSessions': '← 工作階段',
    'detail.selectSession': '選擇工作階段',
    'detail.loading': '載入工作階段...',
    'detail.emptyTitle': '尚無訊息',
    'detail.emptyHint': '在下方開始對話',
    'detail.composerPlaceholder': '輸入提示或命令（以 / 開頭使用斜線命令）...',
    'detail.waiting': '等待中...',
    'detail.send': '傳送',
    'detail.you': '👤 你',
    'detail.opencode': '🤖 OpenCode',
    'todo.title': '待辦事項',
    'todo.hide': '隱藏',
    'todo.show': '顯示',
    'session.deleteTitle': '刪除工作階段？',
    'session.deleteBodyPrefix': '這會永久刪除',
    'session.cancel': '取消',
    'session.deleteConfirm': '刪除工作階段',
    'help.title': '說明與文件',
    'help.overview': '總覽',
    'help.server': '伺服器',
    'help.network': '網路',
    'help.troubleshooting': '疑難排解',
    'help.commands': '命令'
  }
}

export const languageOptions: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'zh-TW', label: '繁體中文' }
]

export function normalizeLanguage(value: string | null | undefined): LanguageCode {
  if (value === 'it' || value?.toLowerCase().startsWith('it')) return 'it'
  if (value === 'zh-TW' || value?.toLowerCase().startsWith('zh')) return 'zh-TW'
  return 'en'
}

export function createTranslator(language: LanguageCode) {
  return (key: string, params: Record<string, string | number> = {}) => {
    const template = translations[language][key as TranslationKey] ?? translations.en[key as TranslationKey] ?? key
    return Object.entries(params).reduce(
      (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
      template
    )
  }
}
