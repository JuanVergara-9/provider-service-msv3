const { z } = require('zod');
const { Conversation, Message, Provider, Sequelize } = require('../../models');
const { Op } = Sequelize;
const { getIo } = require('../socket');

// --- Zod Schemas ---

const createConversationSchema = z.object({
    targetId: z.number().int().positive(),
    serviceId: z.number().int().positive().optional(),
});

const sendMessageSchema = z.object({
    content: z.string().min(1, "Content cannot be empty"),
});

const getMessagesSchema = z.object({
    limit: z.coerce.number().int().positive().max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

// --- Controller ---

const ChatController = {
    /**
     * Create or get an existing conversation.
     */
    async createOrGetConversation(req, res, next) {
        try {
            const { targetId, serviceId } = createConversationSchema.parse(req.body);
            const userId = req.user.userId;
            const userRole = req.user.role;

            let clientId, providerId;

            if (userRole === 'provider') {
                const provider = await Provider.findOne({ where: { user_id: userId } });
                if (!provider) {
                    return res.status(403).json({ error: { message: 'You are not a registered provider' } });
                }
                providerId = provider.id;
                clientId = targetId;
            } else {
                clientId = userId;
                providerId = targetId;
            }

            let conversation = await Conversation.findOne({
                where: {
                    client_id: clientId,
                    provider_id: providerId,
                    ...(serviceId ? { service_id: serviceId } : {})
                }
            });

            if (!conversation) {
                conversation = await Conversation.create({
                    clientId,
                    providerId,
                    serviceId
                });
            }

            return res.json(conversation);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: { message: 'Validation error', details: error.errors } });
            }
            next(error);
        }
    },

    /**
     * Get messages for a conversation with pagination.
     */
    async getMessages(req, res, next) {
        try {
            const conversationId = parseInt(req.params.id);
            if (isNaN(conversationId)) return res.status(400).json({ error: { message: 'Invalid conversation ID' } });

            const { limit, offset } = getMessagesSchema.parse(req.query);
            const userId = req.user.userId;

            const conversation = await Conversation.findByPk(conversationId);
            if (!conversation) {
                return res.status(404).json({ error: { message: 'Conversation not found' } });
            }

            let isParticipant = false;
            if (conversation.clientId === userId) {
                isParticipant = true;
            } else {
                const provider = await Provider.findByPk(conversation.providerId);
                if (provider && provider.user_id === userId) {
                    isParticipant = true;
                }
            }

            if (!isParticipant) {
                return res.status(403).json({ error: { message: 'Access denied' } });
            }

            const { count, rows } = await Message.findAndCountAll({
                where: { conversationId },
                limit,
                offset,
                order: [['createdAt', 'DESC']],
            });

            return res.json({
                data: rows,
                meta: {
                    total: count,
                    limit,
                    offset
                }
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: { message: 'Validation error', details: error.errors } });
            }
            next(error);
        }
    },

    /**
     * Send a message to a conversation.
     */
    async sendMessage(req, res, next) {
        try {
            const conversationId = parseInt(req.params.id);
            if (isNaN(conversationId)) return res.status(400).json({ error: { message: 'Invalid conversation ID' } });

            const { content } = sendMessageSchema.parse(req.body);
            const userId = req.user.userId;

            const conversation = await Conversation.findByPk(conversationId);
            if (!conversation) {
                return res.status(404).json({ error: { message: 'Conversation not found' } });
            }

            let isParticipant = false;
            if (conversation.clientId === userId) {
                isParticipant = true;
            } else {
                const provider = await Provider.findByPk(conversation.providerId);
                if (provider && provider.user_id === userId) {
                    isParticipant = true;
                }
            }

            if (!isParticipant) {
                return res.status(403).json({ error: { message: 'Access denied' } });
            }

            const message = await Message.create({
                conversationId,
                senderId: userId,
                content,
                isRead: false,
                deliveryStatus: 'sent' // Inicialmente 'sent', se actualizará cuando el destinatario reciba
            });

            return res.status(201).json(message);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: { message: 'Validation error', details: error.errors } });
            }
            next(error);
        }
    },

    /**
     * Get all conversations for the authenticated user.
     */
    async getConversations(req, res, next) {
        try {
            const userId = req.user.userId;
            const axios = require('axios');

            let conversations;
            let isProvider = false;

            const provider = await Provider.findOne({ where: { user_id: userId } });

            if (provider) {
                isProvider = true;
                conversations = await Conversation.findAll({
                    where: { provider_id: provider.id },
                    include: [
                        {
                            model: Message,
                            as: 'messages',
                            limit: 1,
                            order: [['createdAt', 'DESC']],
                            required: false
                        }
                    ],
                    order: [['updatedAt', 'DESC']]
                });
            } else {
                conversations = await Conversation.findAll({
                    where: { client_id: userId },
                    include: [
                        {
                            model: Message,
                            as: 'messages',
                            limit: 1,
                            order: [['createdAt', 'DESC']],
                            required: false
                        },
                        {
                            model: Provider,
                            as: 'provider',
                            required: false
                        }
                    ],
                    order: [['updatedAt', 'DESC']]
                });
            }

            const formattedConversations = await Promise.all(conversations.map(async (conv) => {
                const convData = conv.toJSON();
                let otherUser = null;

                if (isProvider) {
                    try {
                        const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:4002';
                        const response = await axios.get(`${userServiceUrl}/api/v1/users/${convData.clientId}/public`, {
                            headers: {
                                'Authorization': req.headers.authorization
                            }
                        });
                        const userData = response.data;
                        otherUser = {
                            id: userData.id,
                            firstName: userData.first_name || 'Usuario',
                            lastName: userData.last_name || '',
                            avatarUrl: userData.avatar_url || null
                        };
                    } catch (error) {
                        console.error('Error fetching user data:', error.message);
                        otherUser = {
                            id: convData.clientId,
                            firstName: 'Usuario',
                            lastName: '',
                            avatarUrl: null
                        };
                    }
                } else {
                    if (convData.provider) {
                        otherUser = {
                            id: convData.provider.user_id, // Use user_id for socket compatibility
                            firstName: convData.provider.first_name || 'Proveedor',
                            lastName: convData.provider.last_name || '',
                            avatarUrl: convData.provider.avatar_url || null
                        };
                    }
                }

                // Count unread messages (messages not sent by current user and marked as unread)
                const unreadCount = await Message.count({
                    where: {
                        conversationId: convData.id,
                        senderId: { [Op.ne]: userId },
                        isRead: false
                    }
                });

                return {
                    id: convData.id,
                    providerId: convData.providerId,
                    userId: convData.clientId,
                    createdAt: convData.createdAt,
                    updatedAt: convData.updatedAt,
                    lastMessage: convData.messages && convData.messages[0] ? {
                        content: convData.messages[0].content,
                        createdAt: convData.messages[0].createdAt,
                        senderId: convData.messages[0].senderId
                    } : null,
                    otherUser,
                    unreadCount
                };
            }));

            return res.json(formattedConversations);
        } catch (error) {
            next(error);
        }
    },

    async getUnreadCount(req, res, next) {
        try {
            const userId = req.user.userId;

            const provider = await Provider.findOne({ where: { user_id: userId } });
            const providerId = provider ? provider.id : null;

            const conversationWhere = {
                [Op.or]: [
                    { clientId: userId },
                    ...(providerId ? [{ providerId: providerId }] : [])
                ]
            };

            const conversations = await Conversation.findAll({
                where: conversationWhere,
                attributes: ['id']
            });

            const conversationIds = conversations.map(conv => conv.id);

            if (conversationIds.length === 0) {
                return res.json({ count: 0 });
            }

            const count = await Message.count({
                where: {
                    conversationId: { [Op.in]: conversationIds },
                    senderId: { [Op.ne]: userId },
                    isRead: false
                }
            });

            return res.json({ count });
        } catch (error) {
            console.error('Error in getUnreadCount:', error);
            next(error);
        }
    },

    /**
     * Mark all messages in a conversation as read.
     */
    async markAsRead(req, res, next) {
        try {
            const conversationId = parseInt(req.params.id);
            if (isNaN(conversationId)) return res.status(400).json({ error: { message: 'Invalid conversation ID' } });

            const userId = req.user.userId;

            const conversation = await Conversation.findByPk(conversationId);
            if (!conversation) {
                return res.status(404).json({ error: { message: 'Conversation not found' } });
            }

            let isParticipant = false;
            if (conversation.clientId === userId) {
                isParticipant = true;
            } else {
                const provider = await Provider.findByPk(conversation.providerId);
                if (provider && provider.user_id === userId) {
                    isParticipant = true;
                }
            }

            if (!isParticipant) {
                return res.status(403).json({ error: { message: 'Access denied' } });
            }

            // Mark all messages not sent by current user as read
            const result = await Message.update(
                { 
                    isRead: true,
                    deliveryStatus: 'read' // Actualizar estado de entrega a 'read'
                },
                {
                    where: {
                        conversationId: conversationId,
                        senderId: { [Op.ne]: userId },
                        isRead: false
                    }
                }
            );

            // If any messages were updated, notify participants
            if (result[0] > 0) {
                const io = getIo();
                if (io) {
                    // Get all messages from this conversation to find unique senders
                    const messages = await Message.findAll({
                        where: { 
                            conversationId,
                            senderId: { [Op.ne]: userId }
                        },
                        attributes: ['senderId'],
                        group: ['senderId']
                    });

                    // Notify each sender that their messages were read
                    messages.forEach(msg => {
                        io.to(`user_${msg.senderId}`).emit('message_status_update', {
                            conversationId,
                            status: 'read'
                        });
                    });
                }
            }

            return res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = ChatController;
