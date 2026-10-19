package br.com.exemplo.offlinefirst.pessoa;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class PessoaController {

    private final PessoaService service;

    public PessoaController(PessoaService service) {
        this.service = service;
    }

    @GetMapping("/")
    public ResponseEntity<?> status() {
        return ResponseEntity.ok(Map.of(
            "status", "online",
            "mensagem", "FieldOps API em execução com sucesso",
            "endpoints", List.of("/usuarios", "/pessoas", "/h2-console")
        ));
    }

    @PostMapping({"/usuarios", "/pessoas"})
    public ResponseEntity<?> salvar(@RequestBody Pessoa pessoa) {
        try {
            Pessoa salva = service.salvar(pessoa);
            return ResponseEntity.ok(salva);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping({"/usuarios", "/pessoas"})
    public List<Pessoa> listar() {
        return service.listar();
    }
}
