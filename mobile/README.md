# Mobile — Expo Offline First

A aplicação da aula deve funcionar em:

- Web;
- Expo Go em celular físico.

## Requisitos

- Node.js 22.13 ou superior;
- navegador atualizado;
- Expo Go instalado no celular.

## Instalar

```bash
cd mobile
npm install
```

Conferir dependências:

```bash
npx expo install --check
```

Se necessário:

```bash
npx expo install --fix
```

## Configurar a API

Crie `mobile/.env` a partir de `.env.example`.

### Web

Como o navegador e o Spring estão no computador:

```env
EXPO_PUBLIC_API_URL_WEB=http://localhost:8080
```

### Expo Go

Descubra o IPv4 do computador:

```powershell
ipconfig
```

Exemplo:

```env
EXPO_PUBLIC_API_URL_MOBILE=http://192.168.0.15:8080
```

O celular e o computador precisam estar acessíveis na mesma rede.

## Executar

```bash
npx expo start
```

No terminal do Expo:

- pressione `w` para abrir a Web;
- leia o QR Code com Expo Go para abrir no celular.

Também é possível iniciar diretamente a Web:

```bash
npm run web
```

## SQLite na Web

O `expo-sqlite` utiliza WebAssembly no navegador.

Por isso este projeto possui `metro.config.js` com:

- suporte a arquivos `.wasm`;
- cabeçalhos COEP/COOP necessários ao `SharedArrayBuffer`.

O suporte Web do `expo-sqlite` ainda é classificado pelo Expo como alpha.

## Banco local

```text
pessoas
├── id
├── nome
├── email
├── telefone
└── sincronizado
```

Estados:

```text
0 = pendente
1 = sincronizado
```
