-- Migração versão 1: Tabelas do domínio de agendamento (MetaSass)
-- Referência: Activity 10 - ISW055

-- Tabela: categorias (ex.: categorias de serviço/no SaaS)
CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    criado_por INT,
    FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);

-- Tabela: agendamentos (ex.: caronas agendadas)
CREATE TABLE IF NOT EXISTS agendamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    categoria_id INT NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_horario DATETIME NOT NULL,
    status ENUM('agendado', 'confirmado', 'cancelado', 'concluido') DEFAULT 'agendado',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
    UNIQUE KEY idx_agendamento_usuario_horario (usuario_id, data_horario)
);

-- Tabela: participacoes (ex.: motorista/passenger em caronas)
CREATE TABLE IF NOT EXISTS participacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agendamento_id INT NOT NULL,
    usuario_id INT NOT NULL,
    papel ENUM('motorista', 'passageiro') NOT NULL,
    confirmado BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    UNIQUE KEY idx_participacao_agendamento_usuario (agendamento_id, usuario_id, papel)
);

-- Índices adicionais para performance
CREATE INDEX idx_agendamentos_status ON agendamentos(status);
CREATE INDEX idx_agendamentos_data ON agendamentos(data_horario);
CREATE INDEX idx_participacoes_usuario ON participacoes(usuario_id);

-- Dados de seed (exemplos iniciais)
INSERT INTO categorias (nome, descricao, criado_por) VALUES 
('carona', 'Viagem compartilhada entre usuários', 1),
('servico', 'Serviço agendado entre usuários', 1);

INSERT INTO agendamentos (usuario_id, categoria_id, titulo, descricao, data_horario, status, criado_por) VALUES 
(1, 1, 'Carona para a Fatec', 'Saindo de casa rumo à Fatec', '2026-11-10 08:00:00', 'agendado', 1),
(1, 2, 'Consulta médica', 'Consulta de rotina', '2026-11-12 14:30:00', 'agendado', 1);

INSERT INTO participacoes (agendamento_id, usuario_id, papel, confirmado) VALUES 
(1, 1, 'motorista', TRUE),
(1, 2, 'passageiro', FALSE);
