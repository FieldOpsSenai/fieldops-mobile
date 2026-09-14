# FieldOps Mobile

Aplicativo mobile da plataforma **FieldOps — Plataforma de Inspeção em Campo**.

## Sobre o projeto

O `fieldops-mobile` é o aplicativo utilizado pelos técnicos em campo para realizar as atividades de inspeção da plataforma FieldOps.

O aplicativo se comunica com o `fieldops-api` através de uma API REST e não possui acesso direto ao banco de dados.

## Objetivo

O aplicativo tem como objetivo fornecer aos técnicos uma interface para execução das atividades de campo, permitindo:

* autenticação do técnico;
* início e encerramento de sessões;
* realização de inspeções;
* preenchimento de informações durante as inspeções;
* registro dos dados coletados em campo;
* sincronização das informações com a API.

As funcionalidades serão implementadas conforme os PBIs definidos no backlog do projeto.

## Arquitetura

O aplicativo Mobile utiliza a API como intermediária para comunicação com os serviços e dados da plataforma.

```text
┌─────────────────────┐
│   fieldops-mobile   │
│    Expo + TypeScript│
└──────────┬──────────┘
           │
           │ REST API
           ▼
┌─────────────────────┐
│    fieldops-api     │
│    Spring Boot      │
└──────────┬──────────┘
           │
           │
           ▼
┌─────────────────────┐
│     PostgreSQL      │
└─────────────────────┘
```

O aplicativo **não acessa diretamente o banco de dados**.

Toda comunicação com os dados e regras de negócio deve ocorrer através do `fieldops-api`.

## Tecnologias

* Expo
* React Native
* TypeScript
* Tailwind CSS

> As versões das tecnologias serão definidas durante a configuração do projeto.

## Estrutura do projeto

A estrutura interna será definida conforme a implementação do aplicativo.

A organização deverá seguir uma estrutura modular, mantendo as funcionalidades separadas e facilitando a manutenção e evolução do projeto.

## Configuração do ambiente

As configurações específicas do ambiente devem ser mantidas fora do código-fonte.

Informações sensíveis, como tokens, credenciais e chaves de acesso, **não devem ser versionadas no Git**.

As variáveis necessárias para execução do aplicativo deverão ser documentadas através de um arquivo `.env.example` ou mecanismo equivalente.

A URL da API utilizada pelo aplicativo deverá ser configurada conforme o ambiente de desenvolvimento.

## Execução

As instruções de instalação, configuração e execução serão adicionadas após a criação da estrutura inicial do projeto Expo.

De forma geral, o projeto deverá utilizar o fluxo padrão de desenvolvimento do Expo.

## Testes

Os testes automatizados devem ser executados antes da abertura de um Pull Request.

As instruções específicas para execução dos testes serão documentadas conforme a implementação do projeto.

## Desenvolvimento

O desenvolvimento deve seguir as convenções definidas pelo projeto FieldOps.

As regras de branches, commits, Pull Requests e proteção da `main` estão documentadas em:

`docs/CONTRIBUTING.md`

Exemplo de branch:

```text
feature/PBI-008-iniciar-sessao-tecnico
```

Exemplo de commit:

```text
feat(PBI-008): inicia sessão do técnico
```

## Documentação

A documentação específica do repositório está disponível no diretório `docs/`.

Para consultar as regras de contribuição e desenvolvimento:

`docs/CONTRIBUTING.md`

Documentações relacionadas ao desenvolvimento e às convenções gerais do projeto devem seguir os padrões definidos pelo FieldOps.

## Status

Em desenvolvimento.
