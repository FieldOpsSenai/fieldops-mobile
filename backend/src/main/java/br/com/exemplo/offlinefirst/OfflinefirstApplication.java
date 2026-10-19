package br.com.exemplo.offlinefirst;

import br.com.exemplo.offlinefirst.pessoa.Pessoa;
import br.com.exemplo.offlinefirst.pessoa.PessoaRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class OfflinefirstApplication {

    public static void main(String[] args) {
        SpringApplication.run(OfflinefirstApplication.class, args);
    }

    @Bean
    public CommandLineRunner carregarDadosIniciais(PessoaRepository repository) {
        return args -> {
            boolean jaExiste = repository.findAll().stream()
                    .anyMatch(p -> "tecnico@fieldops.com".equalsIgnoreCase(p.getEmail()));

            if (!jaExiste) {
                Pessoa base = new Pessoa("user-tecnico-01", "tecnico@fieldops.com", "fieldops123");
                repository.save(base);
                System.out.println(">>> [FieldOps] Usuário base criado com sucesso: tecnico@fieldops.com / fieldops123");
            }
        };
    }
}
