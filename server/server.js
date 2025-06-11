require('dotenv').config(); // Carrega variáveis de ambiente do arquivo .env
const express = require('express');
const cors = require('cors'); // Pacote para permitir requisições de outros domínios
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();

// Middleware para habilitar o CORS. Essencial para que o GitHub Pages possa chamar seu servidor na Render.
app.use(cors()); 
app.use(express.json()); // Middleware para interpretar o corpo das requisições como JSON

// Pega o seu Access Token do arquivo .env
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// Rota que o seu site vai chamar para criar um pagamento
app.post('/create-preference', async (req, res) => {
    try {
        // Pega o título e o preço do corpo da requisição enviada pelo front-end
        const { title, unit_price } = req.body;

        const body = {
            items: [
                {
                    title: title,
                    quantity: 1,
                    unit_price: Number(unit_price),
                    currency_id: 'BRL',
                }
            ],
            // URLs para onde o usuário será redirecionado após o pagamento
            back_urls: {
                success: 'https://seusite.com/sucesso', // Futuramente, a página de "obrigado"
                failure: 'https://seusite.com/falha',
                pending: 'https://seusite.com/pendente'
            },
            auto_return: 'approved',
        };

        const preference = new Preference(client);
        const result = await preference.create({ body });
        
        res.json({ init_point: result.init_point });

    } catch (error) {
        console.error('Erro ao criar preferência:', error);
        res.status(500).json({ error: 'Falha ao criar preferência de pagamento' });
    }
});

app.post('/webhook-mp', (req, res) => {
    // O Mercado Pago envia o ID do pagamento no query param 'id'
    const paymentId = req.query.id;
    const eventType = req.query.type;

    if (eventType === 'payment') {
        console.log(`Webhook recebido para o pagamento: ${paymentId}`);
        // Aqui você poderia, por exemplo, salvar o ID do pagamento no banco de dados
        // ou enviar um e-mail de confirmação para vocês.
    }

    // Responde ao Mercado Pago para confirmar o recebimento
    res.status(200).send('Webhook recebido com sucesso');
});

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Servidor de teste rodando na porta ${PORT}`);
});