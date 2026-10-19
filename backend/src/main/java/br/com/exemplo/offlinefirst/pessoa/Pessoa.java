package br.com.exemplo.offlinefirst.pessoa;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "pessoas")
public class Pessoa {

    @Id
    private String id;

    private String email;
    private String senha;

    public Pessoa() {
    }

    public Pessoa(String id, String email, String senha) {
        this.id = id;
        this.email = email;
        this.senha = senha;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getSenha() {
        return senha;
    }

    public void setSenha(String senha) {
        this.senha = senha;
    }
}
