require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const app = express();
app.use(express.json());

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const conversas = new Map();

const SYSTEM_PROMPT = `Você é um assistente inteligente no WhatsApp.
Responda de forma clara e direta.
Use linguagem natural, sem formalidades excessivas.
Se não souber algo, diga que não sabe.
Máximo 3 parágrafos por resposta.`;

async function enviarMensagem(numero, texto) {
  await axios.post(
    `${process.env.EVOLUTION_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
    { number: numero, text: texto },
    { headers: { apikey: process.env.EVOLUTION_KEY } }
  );
}

async function chamarClaude(contato, mensagem) {
  if (!conversas.has(contato)) conversas.set(contato, []);
  const historico = conversas.get(contato);
  historico.push({ role: 'user', content: mensagem });
  if (historico.length > 10) historico.splice(0, 2);

  const resposta = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: historico
  });

  const texto = resposta.content[0].text;
  historico.push({ role: 'assistant', content: texto });
  return texto;
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const { data } = req.body;
    if (!data?.message) return;
    const msg = data.message;
    const texto = msg.conversation || msg.extendedTextMessage?.text;
    const de = data.key?.remoteJid;
    const ehGrupo = de?.includes('@g.us');
    if (data.key?.fromMe || !texto || !de) return;
    if (ehGrupo) {
      const mencionado = texto.toLowerCase().includes('@bot') || texto.startsWith('/ai ');
      if (!mencionado) return;
    }
    const resposta = await chamarClaude(de, texto);
    await enviarMensagem(de, resposta);
  } catch (err) {
    console.error('Erro:', err.message);
  }
});

app.get('/', (_, res) => res.json({ status: 'ok' }));
app.listen(process.env.PORT || 3000, () => console.log('✅ Bot rodando'));
