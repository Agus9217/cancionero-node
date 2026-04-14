import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { dbConnect, PORT } from './src/config';
import { letrasRouter } from './src/routes/letras.routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan('dev'));
dbConnect();

app.use('/api/letras', letrasRouter);

app.use((_req, res, _next) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(
    `Server is running on: http://localhost:${PORT}`,
  );
  console.log(
    `Endpoint disponible en POST http://localhost:${PORT}/api/letras`,
  );
});
