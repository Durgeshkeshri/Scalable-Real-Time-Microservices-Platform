const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { addTaskToQueue, getTaskStatus } = require('../queue/producer');

// Validation middleware
const validateTask = [
  body('type').isIn(['email', 'report', 'dataProcessing', 'imageProcessing']).withMessage('Invalid task type'),
  body('data').isObject().withMessage('Data must be an object'),
  body('priority').optional().isInt({ min: 1, max: 10 }).withMessage('Priority must be between 1 and 10')
];

// POST /api/tasks - Create a new task
router.post('/', validateTask, async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, data, priority = 5 } = req.body;

    // Add task to queue
    const job = await addTaskToQueue({
      type,
      data,
      priority,
      userId: req.body.userId || 'anonymous',
      createdAt: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Task created and queued successfully',
      task: {
        id: job.id,
        type,
        status: 'queued',
        priority,
        queuedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create task',
      message: error.message 
    });
  }
});

// GET /api/tasks/:id - Get task status
router.get('/:id', [
  param('id').notEmpty().withMessage('Task ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const taskId = req.params.id;
    const taskStatus = await getTaskStatus(taskId);

    if (!taskStatus) {
      return res.status(404).json({ 
        success: false,
        error: 'Task not found' 
      });
    }

    res.json({
      success: true,
      task: taskStatus
    });

  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch task status',
      message: error.message 
    });
  }
});

// GET /api/tasks - Get all tasks (with pagination)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    // This is a simplified version - in production, you'd fetch from queue or database
    res.json({
      success: true,
      message: 'Tasks list endpoint',
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      },
      note: 'Task history can be fetched from completed jobs in Redis or stored in MongoDB'
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch tasks',
      message: error.message 
    });
  }
});

module.exports = router;
