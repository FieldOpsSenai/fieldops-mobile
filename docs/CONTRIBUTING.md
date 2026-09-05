# Contribuindo com o FieldOps Mobile

Este documento define as convenções para desenvolvimento e contribuição no repositório `fieldops-mobile`.

## Branch principal

A branch principal do projeto é:

`main`

A `main` deve permanecer estável e protegida.

Alterações diretas na `main` não são permitidas.

## Branches

As branches devem seguir os padrões:

```
feature/PBI-XXX-descricao
fix/PBI-XXX-descricao
hotfix/PBI-XXX-descricao
```

### Feature

Para desenvolvimento de novas funcionalidades:

```
feature/PBI-XXX-descricao
```

Exemplo:

```
feature/PBI-008-iniciar-sessao-tecnico
```

### Fix

Para correções de problemas:

```
fix/PBI-XXX-descricao
```

### Hotfix

Para correções urgentes:

```
hotfix/PBI-XXX-descricao
```

## Commits

Os commits devem seguir o padrão:

```
tipo(PBI-ID): descrição
```

Exemplos:

```
feat(PBI-008): inicia sessão do técnico
fix(PBI-010): corrige sincronização offline
refactor(PBI-011): reorganiza componente de checklist
docs(PBI-001): atualiza documentação
```

Tipos mais utilizados:

* `feat` — nova funcionalidade
* `fix` — correção
* `refactor` — refatoração
* `docs` — documentação
* `test` — testes
* `chore` — manutenção/configuração

## Pull Requests

Toda alteração destinada à `main` deve passar por Pull Request.

O fluxo padrão é:

```
criar branch
    ↓
desenvolver
    ↓
commit
    ↓
push
    ↓
abrir Pull Request
    ↓
code review
    ↓
aprovação
    ↓
squash merge
    ↓
main
```

### Regras da Pull Request

A Pull Request deve:

* Estar relacionada a um PBI quando aplicável.
* Possuir descrição clara das alterações.
* Informar o que foi implementado ou corrigido.
* Passar por pelo menos 1 aprovação.
* Ter todas as conversas resolvidas.
* Utilizar **Squash and merge**.
* Não permitir merge enquanto os requisitos de proteção da `main` não forem atendidos.

## Proteção da main

A branch `main` possui regras de proteção configuradas no GitHub.

Atualmente:

* Pull Request obrigatório.
* 1 aprovação obrigatória.
* Aprovação mais recente obrigatória após novos commits.
* Aprovações anteriores podem ser invalidadas quando novos commits são enviados.
* Conversas devem estar resolvidas.
* Force push bloqueado.
* Exclusão da branch bloqueada.
* Apenas Squash merge permitido.

Checks automáticos de CI ainda não são obrigatórios neste momento, pois o pipeline será configurado posteriormente.

## Boas práticas

* Manter branches pequenas e focadas.
* Evitar commits sem relação com o PBI.
* Não fazer alterações diretamente na `main`.
* Não utilizar `force push` em branches compartilhadas.
* Manter mensagens de commit claras.
* Atualizar a documentação quando necessário.
* Evitar incluir arquivos de ambiente ou credenciais no repositório.

## Relação com PBIs

Sempre que possível, a branch, os commits e a Pull Request devem permitir identificar o PBI relacionado.

Exemplo:

```
PBI-008
  ↓
feature/PBI-008-iniciar-sessao-tecnico
  ↓
feat(PBI-008): cria tela de login
  ↓
Pull Request
  ↓
main
```
