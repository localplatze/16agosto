require('dotenv').config();
const express = require('express');
const cors = require('cors');
// [NOVO] Importamos também o "Payment" para consultar os detalhes do pagamento
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do cliente do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);

// Credenciais do Telegram (pode colocar no .env também, se preferir)
const TELEGRAM_BOT_TOKEN = '7790968479:AAFWGQcuxa2sy95191i0IjNAFAZNDspDLXI';
const TELEGRAM_CHANNEL_ID = '-1002378516159';

// Função para enviar mensagem para o Telegram
async function sendToTelegram(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHANNEL_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        console.log('Notificação enviada para o Telegram.');
    } catch (error) {
        console.error('Erro ao enviar notificação para o Telegram:', error);
    }
}

// ROTA PARA CRIAR A PREFERÊNCIA DE PAGAMENTO (CHECKOUT PRO)
app.post('/create-preference', async (req, res) => {
    try {
        const { title, unit_price, metadata } = req.body;

        const body = {
            items: [{
                title: title,
                quantity: 1,
                unit_price: Number(unit_price),
                currency_id: 'BRL',
            }],
            back_urls: {
                success: 'https://www.16deagosto.com.br/obrigado.html',
                failure: 'https://www.16deagosto.com.br/index.html#presentes',
                pending: 'https://www.16deagosto.com.br/index.html#presentes'
            },
            auto_return: 'approved',
            // [NOVO] Passando os metadados do presente para o Mercado Pago
            metadata: metadata,
            // [NOVO] URL que o Mercado Pago vai chamar quando o status do pagamento mudar
            notification_url: 'https://casamento-elian-key-api.onrender.com/webhook-mp'
        };

        const preference = new Preference(client);
        const result = await preference.create({ body });
        
        res.json({ init_point: result.init_point });

    } catch (error) {
        console.error('Erro ao criar preferência:', error);
        res.status(500).json({ error: 'Falha ao criar preferência.' });
    }
});

// [MELHORADO] ROTA DE WEBHOOK PARA RECEBER NOTIFICAÇÕES DO MERCADO PAGO
app.post('/webhook-mp', async (req, res) => {
    const { type, data } = req.body;

    if (type === 'payment') {
        try {
            const paymentId = data.id;
            console.log(`Webhook recebido para o pagamento ID: ${paymentId}`);
            
            // Consulta os detalhes do pagamento usando o ID
            const paymentDetails = await payment.get({ id: paymentId });

            // Verifica se o pagamento foi aprovado
            if (paymentDetails.status === 'approved') {
                const itemTitle = paymentDetails.description;
                const amount = paymentDetails.transaction_amount;
                const paymentMethod = paymentDetails.payment_method_id; // Ex: 'pix', 'visa'
                
                // Pega os dados do presente que salvamos nos metadados
                const giftMetadata = paymentDetails.metadata;
                const giverName = giftMetadata.nome || 'Anônimo';

                // Cria a mensagem para o Telegram
                let message = `<b>🎁 Novo Presente Recebido! 🎁</b>\n\n`;
                message += `<b>De:</b> ${giverName}\n`;
                message += `<b>Presente:</b> ${itemTitle}\n`;
                message += `<b>Valor:</b> R$ ${amount.toFixed(2).replace('.', ',')}\n`;
                message += `<b>Método:</b> ${paymentMethod.toUpperCase()}\n`;
                
                if (giftMetadata.mensagem) {
                    message += `\n<b>Mensagem:</b>\n<i>"${giftMetadata.mensagem}"</i>`;
                }

                // Envia a notificação
                await sendToTelegram(message);
            }

        } catch (error) {
            console.error('Erro ao processar webhook:', error);
        }
    }

    // Responde ao Mercado Pago para confirmar o recebimento do webhook
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});