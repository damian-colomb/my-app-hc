from database import SessionLocal
from models import Derivador

db = SessionLocal()
derivadores = db.query(Derivador).all()
for d in derivadores:
    print(d.id_derivador, d.nombre_derivador)