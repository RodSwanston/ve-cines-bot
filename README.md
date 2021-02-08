# VE CINES BOT

Try it -> http://t.me/VECinesBot

## Running The Project

- You will need to create a bot in Telegram and save the token
- You will need to create a .env file based on .env.default

Install the project and run the development server

```bash
yarn install
yarn dev
```

## Deploying

To deploy to now.zh add telegram_bot_key as a secret

```bash
now secrets add telegram_bot_key <secret-value>
```

Affter deploy you will need to create a webhook

```bash
curl -F "url=https://URL_FROM_NOW/" https://api.telegram.org/botYOUR_TELEGRAM_API_TOKEN/setWebhook
```
