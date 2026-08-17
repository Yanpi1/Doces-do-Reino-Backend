package com.docesdoreino.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * IGREJA DO REINO — API PRINCIPAL (reescrita em Java/Spring Boot)
 * Serve também os arquivos estáticos do front-end (src/main/resources/static),
 * então o site inteiro sobe junto com este único processo.
 */
@SpringBootApplication
public class DocesDoReinoApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(DocesDoReinoApiApplication.class, args);
    }
}
