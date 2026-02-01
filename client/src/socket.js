import { io } from 'socket.io-client';

// If we are in production, 'undefined' tells Socket.io to use the current domain.
// If we are in development, we force it to look at port 3001.
const URL = import.meta.env.PROD ? undefined : 'http://localhost:3001';

export const socket = io(URL, {
    autoConnect: false
});