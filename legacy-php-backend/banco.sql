-- ============================================
--  IGREJA DO REINO — BANCO DE DADOS
--  Execute este script no phpMyAdmin do InfinityFree
--  Menu: SQL → cole e clique em Executar
-- ============================================

SET NAMES utf8mb4;

-- Produtos
CREATE TABLE IF NOT EXISTS `produtos` (
  `id`      INT AUTO_INCREMENT PRIMARY KEY,
  `nome`    VARCHAR(255) NOT NULL,
  `desc`    TEXT,
  `preco`   DECIMAL(10,2) NOT NULL DEFAULT 0,
  `estoque` INT NOT NULL DEFAULT 0,
  `imagem`  TEXT,
  `emoji`   VARCHAR(10) DEFAULT '🍨',
  `ordem`   INT DEFAULT 0,
  `criado`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dados iniciais
INSERT INTO `produtos` (`nome`, `desc`, `preco`, `estoque`, `emoji`) VALUES
('DinDin Ninho com Nutella', 'Super cremoso, feito com leite Ninho verdadeiro e muita Nutella.', 4.50, 10, '🍫'),
('DinDin Morango Sensação', 'Aquele sabor de morango cremoso com casquinha de chocolate crocante.', 4.00, 8, '🍓'),
('DinDin Paçoca Cremosa', 'Feito com amendoim selecionado, sabor marcante e delicioso.', 3.50, 5, '🥜'),
('Bolo de Pote Cenoura', 'Massa fofinha de cenoura com cobertura generosa de brigadeiro.', 8.00, 4, '🍰'),
('Bolo de Pote Prestígio', 'Bolo de chocolate molhadinho com recheio cremoso de coco.', 8.00, 3, '🥥'),
('Bolo de Pote Red Velvet', 'Massa vermelha aveludada com recheio de cream cheese doce.', 10.00, 0, '🧁');

-- Configurações gerais (pix, contato, logo, carrossel)
CREATE TABLE IF NOT EXISTS `config` (
  `chave` VARCHAR(100) PRIMARY KEY,
  `valor` LONGTEXT,
  `atualizado` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `config` (`chave`, `valor`) VALUES
('pix',      '{"tipo":"Telefone","chave":"(61) 99279-6430","nome":"ReinoGourmet"}'),
('contato',  '{"tipo":"whatsapp","whatsapp":"5561992796430","msgWpp":"Olá! Quero fazer um pedido.","iframe":"","email":"yanpietro0101@gmail.com","assunto":"Pedido DinDin"}'),
('logo_header',''),
('logo_sobre', ''),
('carrossel','{"ativo":false,"eyebrow":"Destaques","titulo":"Em Destaque","slides":[]}');

-- Pedidos
CREATE TABLE IF NOT EXISTS `pedidos` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `nome`         VARCHAR(255) NOT NULL,
  `contato`      VARCHAR(255),
  `contato_tipo` VARCHAR(50),
  `itens`        JSON,
  `total`        DECIMAL(10,2),
  `status`       ENUM('pendente','confirmado','entregue','cancelado') DEFAULT 'pendente',
  `criado`       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Slides do carrossel (tabela dedicada para facilitar gerenciamento)
CREATE TABLE IF NOT EXISTS `slides` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `titulo` VARCHAR(255) NOT NULL,
  `desc`   TEXT,
  `preco`  DECIMAL(10,2),
  `imagem` TEXT,
  `emoji`  VARCHAR(10),
  `ordem`  INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
