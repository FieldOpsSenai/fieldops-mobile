package br.com.exemplo.offlinefirst.pessoa;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PessoaService {

    private final PessoaRepository repository;

    public PessoaService(PessoaRepository repository) {
        this.repository = repository;
    }

    public Pessoa salvar(Pessoa pessoa) {
        if (pessoa.getEmail() == null || pessoa.getEmail().isBlank()) {
            throw new IllegalArgumentException("O e-mail corporativo é obrigatório.");
        }
        if (pessoa.getSenha() == null || pessoa.getSenha().isBlank()) {
            throw new IllegalArgumentException("A senha é obrigatória.");
        }

        return repository.findById(pessoa.getId())
                .orElseGet(() -> repository.save(pessoa));
    }

    public List<Pessoa> listar() {
        return repository.findAll();
    }
}
