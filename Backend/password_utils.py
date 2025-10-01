"""
Utilidades para el manejo seguro de contraseñas
"""
import bcrypt

def hash_password(password: str) -> str:
    """
    Encripta una contraseña usando bcrypt
    
    Args:
        password: Contraseña en texto plano
        
    Returns:
        Contraseña encriptada como string
    """
    # Generar salt y hash la contraseña
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verifica si una contraseña coincide con su hash
    
    Args:
        password: Contraseña en texto plano
        hashed_password: Contraseña encriptada
        
    Returns:
        True si la contraseña es correcta, False en caso contrario
    """
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def is_hashed(password: str) -> bool:
    """
    Verifica si una contraseña ya está encriptada
    
    Args:
        password: String a verificar
        
    Returns:
        True si parece ser un hash bcrypt, False en caso contrario
    """
    # bcrypt hashes empiezan con $2b$ y tienen una longitud específica
    return password.startswith('$2b$') and len(password) == 60
