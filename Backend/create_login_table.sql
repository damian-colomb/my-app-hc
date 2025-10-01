-- Crear tabla de login para autenticación
CREATE TABLE IF NOT EXISTS login_credentials (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar credencial inicial
INSERT INTO login_credentials (username, password_hash) 
VALUES ('admin', 'hospital2024') 
ON CONFLICT (username) DO NOTHING;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_login_username ON login_credentials(username);
CREATE INDEX IF NOT EXISTS idx_login_active ON login_credentials(is_active);
