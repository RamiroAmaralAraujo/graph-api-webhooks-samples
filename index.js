require('dotenv').config();
var bodyParser = require('body-parser');
var express = require('express');
var axios = require('axios');
var app = express();
var xhub = require('express-x-hub');

app.set('port', (process.env.PORT || 5000));

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
app.use(bodyParser.json());

var token = process.env.TOKEN || 'token';
var accessToken = process.env.ACCESS_TOKEN;
var igBusinessAccountId = process.env.IG_BUSINESS_ACCOUNT_ID;

var received_updates = [];

// Função para enviar mensagem automática
async function sendMessage(recipientId, messageText) {
  try {
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

    console.log('Mensagem enviada:', response.data);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error.response?.data || error.message);
  }
}

// Página principal
app.get('/', function(req, res) {
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '</pre>');
});

// Verificação do webhook
app.get(['/facebook', '/instagram', '/threads'], function(req, res) {
  if (
    req.query['hub.mode'] == 'subscribe' &&
    req.query['hub.verify_token'] == token
  ) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// Recebe evento do Instagram
app.post('/instagram', async function(req, res) {
  console.log('Instagram request body:', JSON.stringify(req.body, null, 2));
  received_updates.unshift(req.body);

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Apenas processa mensagens diretas
    if (value?.messaging_product === 'instagram' && value?.messages) {
      const message = value.messages[0];
      const senderId = value.from;

      console.log(`Mensagem de ${senderId}: ${message.text}`);

      // Aqui responde automaticamente
      await sendMessage(senderId, 'Olá! Como posso ajudar?');
    }
  } catch (error) {
    console.error('Erro no processamento da mensagem:', error);
  }

  res.sendStatus(200);
});

app.post('/facebook', function(req, res) {
  console.log('Facebook request body:', JSON.stringify(req.body, null, 2));
  if (!req.isXHubValid()) {
    console.log('Warning - request header X-Hub-Signature not present or invalid');
    res.sendStatus(401);
    return;
  }
  console.log('request header X-Hub-Signature validated');
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

app.post('/threads', function(req, res) {
  console.log('Threads request body:', JSON.stringify(req.body, null, 2));
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

app.listen(app.get('port'), () => {
  console.log(`Servidor rodando na porta ${app.get('port')}`);
});
