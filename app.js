const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const morgan = require('morgan');

const userRouter = require('./routes/userRoutes');
const recordingRouter = require('./routes/recordingRoutes');
const staticRouter = require('./routes/staticRoutes');
const questionRouter = require('./routes/questionRoutes');
const messagingRouter = require('./routes/messagingRoutes');
const globalErrorHandler = require('./controllers/errorController');
const AppError = require('./utils/appError');

const app = express();

app.use(morgan('dev'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: 'https://gopendrajangir.github.io',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  })
);

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/v1/users', userRouter);
app.use('/api/v1/recordings', recordingRouter);
app.use('/api/v1/static', staticRouter);
app.use('/api/v1/questions', questionRouter);
app.use('/api/v1/messaging', messagingRouter);

// app.get('*', (req, res) => {
//   res.sendFile(path.resolve(__dirname, 'public/index.html'));
// });

app.all('*', (req, res, next) => {
  next(
    new AppError(`Can't find route ${req.originalUrl} on this server!`, 404)
  );
});

app.use(globalErrorHandler);

module.exports = app;
