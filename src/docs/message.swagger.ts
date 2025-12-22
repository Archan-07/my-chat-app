/**
 * @swagger
 * components:
 *   schemas:
 *     SenderInfo:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: 550e8400-e29b-41d4-a716-446655440000
 *         username:
 *           type: string
 *           example: archan
 *         avatar:
 *           type: string
 *           format: uri
 *           example: https://cdn.example.com/avatar.jpg
 *
 *     Message:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: 550e8400-e29b-41d4-a716-446655440000
 *         content:
 *           type: string
 *           example: Hello, how are you?
 *         attachmentUrl:
 *           type: string
 *           format: uri
 *           example: https://cdn.example.com/file.pdf
 *         urlPreview:
 *           type: object
 *           description: Link preview metadata if content contains URL
 *         createdAt:
 *           type: string
 *           format: date-time
 *         sender:
 *           $ref: '#/components/schemas/SenderInfo'
 *
 *     MessageHistory:
 *       type: array
 *       items:
 *         $ref: '#/components/schemas/Message'
 *
 *     SendMessageRequest:
 *       type: object
 *       required:
 *         - content
 *       properties:
 *         content:
 *           type: string
 *           example: Hello, this is my message
 *           description: Message text content (required if no attachment)
 *         attachment:
 *           type: string
 *           format: binary
 *           description: Optional file attachment (pdf, image, etc.)
 *
 *     MessageResponse:
 *       type: object
 *       properties:
 *         statusCode:
 *           type: integer
 *           example: 201
 *         data:
 *           $ref: '#/components/schemas/Message'
 *         message:
 *           type: string
 *
 *     MessageHistoryResponse:
 *       type: object
 *       properties:
 *         statusCode:
 *           type: integer
 *           example: 200
 *         data:
 *           $ref: '#/components/schemas/MessageHistory'
 *         message:
 *           type: string
 *           example: Messages fetched
 *
 *     DeleteMessageResponse:
 *       type: object
 *       properties:
 *         statusCode:
 *           type: integer
 *           example: 200
 *         data:
 *           type: object
 *         message:
 *           type: string
 *           example: Message deleted
 *
 *     MarkReadResponse:
 *       type: object
 *       properties:
 *         statusCode:
 *           type: integer
 *           example: 200
 *         data:
 *           type: object
 *           properties:
 *             markedCount:
 *               type: integer
 *               example: 5
 *         message:
 *           type: string
 */

/**
 * @swagger
 * /messages/{roomId}:
 *   get:
 *     summary: Get room messages
 *     description: Retrieve message history for a specific room (last 50 messages, newest first)
 *     tags:
 *       - Messages
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: roomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Room ID to fetch messages from
 *     responses:
 *       200:
 *         description: Messages fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageHistoryResponse'
 *       401:
 *         description: Unauthorized - user not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /messages/send-message/{roomId}:
 *   post:
 *     summary: Send message to room
 *     description: Send a text message and/or file attachment to a room with optional link preview
 *     tags:
 *       - Messages
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: roomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Room ID to send message to
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       400:
 *         description: Message must have content or attachment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - user not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Attachment upload failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /messages/delete-message/{messageId}/{roomId}:
 *   delete:
 *     summary: Delete message
 *     description: Delete a message from a room (only message owner or room admin can delete)
 *     tags:
 *       - Messages
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: messageId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID to delete
 *       - name: roomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Room ID containing the message
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteMessageResponse'
 *       403:
 *         description: Forbidden - only message owner or room admin can delete
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Message or room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - user not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /messages/mark-read/{roomId}:
 *   post:
 *     summary: Mark messages as read
 *     description: Mark all unread messages in a room as read for the current user
 *     tags:
 *       - Messages
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: roomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Messages marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarkReadResponse'
 *       401:
 *         description: Unauthorized - user not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         statusCode:
 *           type: integer
 *           example: 400
 *         message:
 *           type: string
 */

export {};
