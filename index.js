require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const xhub = require('express-x-hub');

const app = express();

app.set('port', process.env.PORT || 5000);

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
app.use(bodyParser.json());

const token = process.env.TOKEN;
const accessToken = process.env.ACCESS_TOKEN;
const igBusinessAccountId = process.env.IG_BUSINESS_ACCOUNT_ID;

const received_updates = [];

// Função para enviar mensagem
async function sendMessage(recipientId, messageText) {
  try {
    console.log(`➡️ Enviando mensagem para ${recipientId}: "${messageText}"`);

    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${igBusinessAccountId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: messageText },
        messaging_type: "RESPONSE"
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    console.log('✅ Mensagem enviada com sucesso:', response.data);
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error.response?.data || error.message);
  }
}

// Página principal para visualizar updates
app.get('/', function(req, res) {
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '</pre>');
});

// Verificação do webhook
app.get(['/facebook', '/instagram', '/threads'], function(req, res) {
  console.log('➡️ Verificação de Webhook recebida');
  if (
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === token
  ) {
    console.log('✅ Webhook verificado com sucesso');
    res.send(req.query['hub.challenge']);
  } else {
    console.warn('❌ Webhook falhou na verificação');
    res.sendStatus(400);
  }
});

// Recebimento de mensagens Instagram
app.post('/instagram', async function(req, res) {
  console.log('➡️ Recebido POST /instagram');
  console.log('📦 Payload:', JSON.stringify(req.body, null, 2));

  received_updates.unshift(req.body);

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    let senderId = null;
    let userMessage = null;

    // Payload real
    if (value?.messaging_product === 'instagram' && value?.text) {
      senderId = value.from;
      userMessage = value.text;
      console.log(`✅ Mensagem REAL de ${senderId}: "${userMessage}"`);
    } 
    // Payload de teste
    else if (value?.sender?.id && value?.message?.text) {
      senderId = value.sender.id;
      userMessage = value.message.text;
      console.log(`✅ Mensagem TESTE de ${senderId}: "${userMessage}"`);
    } 
    else {
      console.warn('❓ Payload não corresponde a nenhum formato conhecido');
    }

    if (senderId && userMessage) {
      await sendMessage(senderId, 'Olá! Como posso ajudar?');
    } else {
      console.warn('❌ Não foi possível extrair senderId e userMessage');
    }
  } catch (error) {
    console.error('❌ Erro no processamento do payload:', error);
  }

  res.sendStatus(200);
});

// Recebimento de mensagens Facebook
app.post('/facebook', function(req, res) {
  console.log('➡️ Recebido POST /facebook');
  if (!req.isXHubValid()) {
    console.warn('❌ X-Hub-Signature inválida');
    res.sendStatus(401);
    return;
  }
  console.log('✅ X-Hub-Signature validada');
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

// Recebimento de mensagens Threads
app.post('/threads', function(req, res) {
  console.log('➡️ Recebido POST /threads');
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

// Inicia o servidor
app.listen(app.get('port'), () => {
  console.log(`🚀 Servidor rodando na porta ${app.get('port')}`);
});
