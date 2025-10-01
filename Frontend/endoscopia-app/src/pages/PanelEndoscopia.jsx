import React, { useState } from "react";

const HistoriaClinicaDemo = () => {
  const [antecedentes, setAntecedentes] = useState({
    medicos: "Diabetes tipo 2",
    quirurgicos: "Colecistectomía en 2015",
    alergicos: "Penicilina",
    toxicos: "Tabaco (ex fumador)",
    familiares: "Padre con HTA"
  });

  const [motivos, setMotivos] = useState([
    {
      id: 1,
      fecha: "2025-05-10",
      descripcion: "Dolor abdominal",
      estado: "Activo",
      evoluciones: [
        { fecha: "2025-05-11", nota: "Dolor en hipogastrio, sin fiebre." },
        { fecha: "2025-05-15", nota: "Mejoría parcial, se indica ecografía." }
      ]
    }
  ]);

  const [estudios, setEstudios] = useState([
    { fecha: "2025-05-16", tipo: "Laboratorio", descripcion: "Hemograma completo" },
    { fecha: "2025-05-18", tipo: "Imagen", descripcion: "Ecografía abdominal" }
  ]);

  const [preqx, setPreqx] = useState({
    fecha: "2025-05-20",
    checklist: ["ECG", "Laboratorio", "Evaluación anestésica"],
    apto: true
  });

  return (
    <div className="p-4 space-y-6 text-white bg-gray-900 min-h-screen">
      <div className="border rounded p-4 bg-gray-800">
        <h2 className="text-xl font-bold mb-2">Antecedentes</h2>
        {Object.entries(antecedentes).map(([key, value]) => (
          <div key={key}>
            <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {value}
          </div>
        ))}
      </div>

      <div className="border rounded p-4 bg-gray-800">
        <h2 className="text-xl font-bold mb-2">Motivos de Consulta</h2>
        {motivos.map((motivo) => (
          <div key={motivo.id} className="border p-2 rounded mb-2 bg-gray-700">
            <div className="font-semibold">{motivo.fecha} - {motivo.descripcion} ({motivo.estado})</div>
            <ul className="list-disc ml-5">
              {motivo.evoluciones.map((evo, i) => (
                <li key={i}><strong>{evo.fecha}:</strong> {evo.nota}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border rounded p-4 bg-gray-800">
        <h2 className="text-xl font-bold mb-2">Estudios Complementarios</h2>
        <ul className="list-disc ml-5">
          {estudios.map((est, i) => (
            <li key={i}><strong>{est.fecha} ({est.tipo}):</strong> {est.descripcion}</li>
          ))}
        </ul>
      </div>

      <div className="border rounded p-4 bg-gray-800">
        <h2 className="text-xl font-bold mb-2">Prequirúrgico</h2>
        <div><strong>Fecha:</strong> {preqx.fecha}</div>
        <div><strong>Checklist:</strong>
          <ul className="list-disc ml-5">
            {preqx.checklist.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div><strong>Apto:</strong> {preqx.apto ? "Sí" : "No"}</div>
      </div>
    </div>
  );
};

export default HistoriaClinicaDemo;