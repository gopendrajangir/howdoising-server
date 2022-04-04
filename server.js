const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
// const socketIO = require('socket.io');
const io = require('socket.io-client');

const app = require('./app');

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace(
  '<password>',
  process.env.DATABASE_PASSWORD
);
// const DB = process.env.DATABASE_LOCAL;

const connect = async () => {
  await mongoose.connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  });

  console.log('DB connection successfull!');

  const server = http.Server(app);

  const port = process.env.PORT || 3000;

  await server.listen(port);
  console.log(`App running on port ${port}...`);

  let socket;

  if (process.env.NODE_ENV.trim() === 'production') {
    socket = io('https://howdoising-socket.herokuapp.com', {
      transports: ['websocket'],
    });
  } else {
    socket = io('http://localhost:8080');
  }

  global.socket = socket;
  // const io = socketIO(server);

  // io.on('connection', (socket) => {
  // console.log('Client Connected');

  // socket.on('join', ({ id }) => {
  //   socket.join(id, () => {
  //     console.log('Joined Room');
  //   });
  // });
  // });

  global.io = io;

  process.on('unhandledRejection', (err) => {
    console.log('UNHANDLED REJECTION! Shutting down...');
    console.log(err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });
};

connect();
