
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const Pino = require('pino')
const qrcode = require('qrcode-terminal')

const BOT_NAME = '𝕵𝖔𝖍𝖓𝖆 𝖙𝖍𝖊 𝕯𝖆𝖗𝖐𝖞'
const OWNER_NAME = '𝕵𝖔𝖍𝖆𝖓𝖝𝖆 𝕷𝖆 𝖁𝖊𝖓𝖊𝖓𝖚'
const OWNER_NUMBER = '256763566813'
const OWNER_JID = OWNER_NUMBER + '@s.whatsapp.net'

const antiLink = {}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./session')
  const sock = makeWASocket({
    logger: Pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', (u) => {
    if (u.qr) qrcode.generate(u.qr, { small: true })
    if (u.connection === 'open') console.log(BOT_NAME + ' connected')
  })

  sock.ev.on('group-participants.update', async (update) => {
    if (update.action === 'add') {
      await sock.sendMessage(update.id, {
        text: `👋 Welcome to the group!\n📜 Type .rules to see rules`
      })
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const from = msg.key.remoteJid
    const isGroup = from.endsWith('@g.us')
    const sender = msg.key.participant || msg.key.remoteJid
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
    const isOwner = sender === OWNER_JID

    if (isGroup && antiLink[from] && text.includes('http')) {
      await sock.sendMessage(from, { text: '🚫 Links are not allowed!' })
      return sock.groupParticipantsUpdate(from, [sender], 'remove')
    }

    switch (text.split(' ')[0]) {
      case '.menu':
        return sock.sendMessage(from, {
          text:
`🤖 ${BOT_NAME}
👑 ${OWNER_NAME}

Group:
.rules
.tagall
.kick @user
.promote @user
.antilink on/off

General:
.ping
.owner

Owner:
.broadcast
.shutdown`
        })

      case '.rules':
        return sock.sendMessage(from, { text: '📜 Be respectful | No spam | No links' })

      case '.tagall':
        if (!isGroup) return
        const meta = await sock.groupMetadata(from)
        return sock.sendMessage(from, {
          text: '📣 Attention',
          mentions: meta.participants.map(p => p.id)
        })

      case '.kick':
        if (!isGroup) return
        const k = msg.message.extendedTextMessage?.contextInfo?.mentionedJid
        if (k) await sock.groupParticipantsUpdate(from, k, 'remove')
        break

      case '.promote':
        if (!isGroup) return
        const p = msg.message.extendedTextMessage?.contextInfo?.mentionedJid
        if (p) await sock.groupParticipantsUpdate(from, p, 'promote')
        break

      case '.antilink':
        if (!isGroup) return
        antiLink[from] = text.endsWith('on')
        await sock.sendMessage(from, { text: '🔗 Anti-link ' + (antiLink[from] ? 'enabled' : 'disabled') })
        break

      case '.broadcast':
        if (!isOwner) return
        const chats = await sock.groupFetchAllParticipating()
        for (const id in chats) {
          await sock.sendMessage(id, { text: text.replace('.broadcast ', '') })
        }
        break

      case '.owner':
        return sock.sendMessage(from, { text: OWNER_NAME + '\n' + OWNER_NUMBER })

      case '.ping':
        return sock.sendMessage(from, { text: '🏓 Pong' })

      case '.shutdown':
        if (isOwner) process.exit(0)
    }
  })
}

startBot()
