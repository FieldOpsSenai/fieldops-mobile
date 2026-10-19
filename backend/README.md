# Backend — Spring Boot + H2

## Requisitos

- Java 21;
- Maven 3.6.3 ou superior.

## Executar

```bash
cd backend
mvn spring-boot:run
```

A API inicia em:

```text
http://localhost:8080
```

## Endpoints

### Criar pessoa

```http
POST /pessoas
Content-Type: application/json
```

Exemplo:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "nome": "João Silva",
  "email": "joao@email.com",
  "telefone": "15999999999"
}
```

### Listar pessoas

```http
GET /pessoas
```

## H2 Console

Abra:

```text
http://localhost:8080/h2-console
```

Use:

```text
JDBC URL: jdbc:h2:mem:offlinefirst
User Name: sa
Password:
```

Consulta:

```sql
SELECT * FROM PESSOAS;
```

## Observação

O banco desta aula está em memória.

Ao reiniciar o backend, os registros do H2 são recriados/limpos.

Isso é proposital para manter o laboratório simples.
