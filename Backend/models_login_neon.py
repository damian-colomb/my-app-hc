from sqlalchemy import Column, Integer, String
from database import Base

class LoginNeon(Base):
    __tablename__ = "login"
    
    Id_clave = Column(Integer, primary_key=True, index=True)
    clave = Column(String, nullable=False)
