const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { Message, Conversation, Provider } = require('../models');

let io;

const initializeSocket = (httpServer) => {
    const origins = (process.env.CORS_ORIGINS || '')
        .split(',').map(s => s.trim()).filter(Boolean);

    io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                if (process.env.NODE_ENV !== 'production') return callback(null, true);
                if (origins.length === 0 || origins.includes(origin)) return callback(null, true);
                return callback(new Error('Not allowed by CORS'));
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Middleware de Autenticación
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error: Token required'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            socket.user = decoded; // { userId, role, ... }
            next();
        } catch (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    // Map to track connected users: userId -> Set(socketId)
    const connectedUsers = new Map();

    io.on('connection', (socket) => {
        const userId = socket.user.userId;
        console.log(`User connected: ${userId} (${socket.user.role}) - Socket ID: ${socket.id}`);

        // Track user connection
        if (!connectedUsers.has(userId)) {
            connectedUsers.set(userId, new Set());
            // Broadcast that user came online (only if it's their first connection)
            io.emit('user_connected', { userId });
        }
        connectedUsers.get(userId).add(socket.id);

        // Join user-specific room for notifications
        const userRoom = `user_${userId}`;
        socket.join(userRoom);
        console.log(`User ${userId} joined room ${userRoom}`);

        // Evento: check_user_status
        socket.on('check_user_status', (targetUserId, callback) => {
            const isOnline = connectedUsers.has(targetUserId);
            callback({ isOnline });
        });

        // Evento: join_room
        socket.on('join_room', async (conversationId) => {
            try {
                // Validar que el usuario pertenece a la conversación
                const conversation = await Conversation.findByPk(conversationId);
                if (!conversation) {
                    return socket.emit('error', { message: 'Conversation not found' });
                }

                const userId = socket.user.userId;
                let isParticipant = false;

                if (conversation.clientId === userId) {
                    isParticipant = true;
                } else {
                    // Si es provider, verificar si el providerId corresponde al usuario
                    const provider = await Provider.findByPk(conversation.providerId);
                    if (provider && provider.user_id === userId) {
                        isParticipant = true;
                    }
                }

                if (!isParticipant) {
                    return socket.emit('error', { message: 'Access denied to this conversation' });
                }

                const roomName = `chat_${conversationId}`;
                socket.join(roomName);
                console.log(`User ${userId} joined room ${roomName}`);
                socket.emit('joined_room', { conversationId });
            } catch (error) {
                console.error('Error joining room:', error);
                socket.emit('error', { message: 'Internal server error' });
            }
        });

        // Evento: send_message
        socket.on('send_message', async (payload) => {
            try {
                const { conversationId, content } = payload;
                if (!content || !conversationId) {
                    return socket.emit('error', { message: 'Invalid payload' });
                }

                const conversation = await Conversation.findByPk(conversationId);
                if (!conversation) return socket.emit('error', { message: 'Conversation not found' });

                const userId = socket.user.userId;
                let isParticipant = false;
                let recipientUserId = null;

                if (conversation.clientId === userId) {
                    isParticipant = true;
                    // Recipient is the provider's user
                    const provider = await Provider.findByPk(conversation.providerId);
                    if (provider) recipientUserId = provider.user_id;
                } else {
                    const provider = await Provider.findByPk(conversation.providerId);
                    if (provider && provider.user_id === userId) {
                        isParticipant = true;
                        // Recipient is the client
                        recipientUserId = conversation.clientId;
                    }
                }

                if (!isParticipant) return socket.emit('error', { message: 'Access denied' });

                // 2. Guardar en BD con estado inicial 'sent'
                const message = await Message.create({
                    conversationId,
                    senderId: userId,
                    content,
                    isRead: false,
                    deliveryStatus: 'sent'
                });

                // 3. Verificar si el destinatario está en la sala de chat
                const recipientRoom = `chat_${conversationId}`;
                const recipientSockets = await io.in(recipientRoom).fetchSockets();
                const isRecipientInRoom = recipientSockets.some(s => {
                    return s.user && s.user.userId === recipientUserId;
                });

                // 4. Emitir a la sala de chat
                io.to(`chat_${conversationId}`).emit('receive_message', message);

                // 5. Si el destinatario está en la sala, marcar como 'delivered' después de un pequeño delay
                // para permitir que el cliente procese el mensaje primero
                if (isRecipientInRoom && recipientUserId) {
                    setTimeout(async () => {
                        try {
                            await message.update({ deliveryStatus: 'delivered' });
                            // Notificar al remitente que el mensaje fue entregado
                            io.to(`user_${userId}`).emit('message_status_update', {
                                messageId: message.id,
                                deliveryStatus: 'delivered'
                            });
                        } catch (error) {
                            console.error('Error updating message delivery status:', error);
                        }
                    }, 500);
                }

                // 6. Emitir notificación al destinatario (si no está en la sala de chat activo)
                if (recipientUserId && !isRecipientInRoom) {
                    io.to(`user_${recipientUserId}`).emit('new_message_notification', message);
                }

            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Evento: mark_message_as_delivered
        socket.on('mark_message_as_delivered', async (messageId) => {
            try {
                const message = await Message.findByPk(messageId);
                if (!message) return;

                // Solo el destinatario puede marcar como entregado
                const conversation = await Conversation.findByPk(message.conversationId);
                if (!conversation) return;

                const userId = socket.user.userId;
                let isRecipient = false;

                if (conversation.clientId === userId && message.senderId !== userId) {
                    isRecipient = true;
                } else {
                    const provider = await Provider.findByPk(conversation.providerId);
                    if (provider && provider.user_id === userId && message.senderId !== userId) {
                        isRecipient = true;
                    }
                }

                if (isRecipient && message.deliveryStatus !== 'read') {
                    await message.update({ deliveryStatus: 'delivered' });
                    // Notificar al remitente
                    io.to(`user_${message.senderId}`).emit('message_status_update', {
                        messageId: message.id,
                        deliveryStatus: 'delivered'
                    });
                }
            } catch (error) {
                console.error('Error marking message as delivered:', error);
            }
        });

        // Evento: mark_message_as_read
        socket.on('mark_message_as_read', async (messageId) => {
            try {
                const message = await Message.findByPk(messageId);
                if (!message) return;

                const conversation = await Conversation.findByPk(message.conversationId);
                if (!conversation) return;

                const userId = socket.user.userId;
                let isRecipient = false;

                if (conversation.clientId === userId && message.senderId !== userId) {
                    isRecipient = true;
                } else {
                    const provider = await Provider.findByPk(conversation.providerId);
                    if (provider && provider.user_id === userId && message.senderId !== userId) {
                        isRecipient = true;
                    }
                }

                if (isRecipient) {
                    await message.update({ 
                        deliveryStatus: 'read',
                        isRead: true 
                    });
                    // Notificar al remitente
                    io.to(`user_${message.senderId}`).emit('message_status_update', {
                        messageId: message.id,
                        deliveryStatus: 'read'
                    });
                }
            } catch (error) {
                console.error('Error marking message as read:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);

            // Remove socket from tracking
            if (connectedUsers.has(userId)) {
                const userSockets = connectedUsers.get(userId);
                userSockets.delete(socket.id);

                if (userSockets.size === 0) {
                    connectedUsers.delete(userId);
                    // Broadcast that user went offline
                    io.emit('user_disconnected', { userId });
                }
            }
        });
    });

    return io;
};

module.exports = { initializeSocket, getIo: () => io };
