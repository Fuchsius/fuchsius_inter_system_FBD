const { PrismaClient } = require('@prisma/client');
const { createActivityLog } = require('./ActivityController');
const socketService = require('../services/socketService');

const prisma = new PrismaClient();

const STATUS_NOTIFICATION_CONFIG = {
    completed: {
        title: 'Task Completed',
        type: 'success',
        label: 'completed'
    },
    in_progress: {
        title: 'Task In Progress',
        type: 'info',
        label: 'in progress'
    },
    pending: {
        title: 'Task Pending',
        type: 'warning',
        label: 'pending'
    }
};

const GENERAL_UPDATE_CONFIG = {
    title: 'Task Updated',
    type: 'info',
    label: 'updated'
};

const notifyTaskStakeholders = async (task, status, actor) => {
    if (!task) return;

    const config = STATUS_NOTIFICATION_CONFIG[status] || GENERAL_UPDATE_CONFIG;

    try {
        const [adminAndPmUsers] = await Promise.all([
            prisma.user.findMany({
                where: {
                    role: { in: ['admin', 'pm'] },
                    status: 'active'
                },
                select: { id: true }
            })
        ]);

        const recipientIds = new Set();
        adminAndPmUsers?.forEach(user => {
            if (user?.id) recipientIds.add(user.id);
        });

        const projectManagerId = task.project?.projectManagerId || task.project?.projectManager?.id;
        if (projectManagerId) {
            recipientIds.add(projectManagerId);
        }

        if (actor?.id) {
            recipientIds.delete(actor.id);
        }

        if (!recipientIds.size) return;

        const actorNameParts = [actor?.firstName, actor?.lastName].filter(Boolean);
        const actorName = actorNameParts.length ? actorNameParts.join(' ') : (actor?.email || 'A team member');
        const taskTitle = task.title || 'Task';

        let message;
        if (STATUS_NOTIFICATION_CONFIG[status]) {
            message = `${actorName} marked task "${taskTitle}" as ${config.label}.`;
        } else {
            message = `${actorName} updated task "${taskTitle}".`;
        }

        await Promise.all(Array.from(recipientIds).map(async (userId) => {
            const notification = await prisma.notification.create({
                data: {
                    title: config.title,
                    message,
                    type: config.type,
                    userId,
                    read: false,
                    description: `Task ID: ${task.id}`
                }
            });

            socketService.emitToUser(userId, 'new_notification', notification);
        }));
    } catch (error) {
        console.error('Failed to notify task stakeholders:', error.message || error);
    }
};

const getAllTasks = async (req, res) => {
    try {
        const { page = 1, limit = 10, projectId, userId, status, priority, search } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (projectId) where.projectId = projectId;
        if (userId) where.userId = userId;
        if (status) where.status = status;
        if (priority) where.priority = priority;

        if (search) {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } },
                {
                    user: {
                        firstName: { contains: search }
                    }
                },
                {
                    user: {
                        lastName: { contains: search }
                    }
                },
                {
                    project: {
                        title: { contains: search }
                    }
                }
            ];
        }

        const [tasks, total] = await Promise.all([
            prisma.task.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            employeeId: true,
                            avatar: true,
                            role: true,
                            position: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    },
                    project: {
                        select: {
                            id: true,
                            title: true,
                            status: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.task.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                tasks,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all tasks error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tasks',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getTaskById = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await prisma.task.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        role: true,
                        avatar: true,
                        position: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                project: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        status: true,
                        projectManager: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                employeeId: true,
                                avatar: true
                            }
                        }
                    }
                }
            }
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        res.json({
            success: true,
            data: task
        });
    } catch (error) {
        console.error('Get task by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch task',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const createTask = async (req, res) => {
    try {
        const { projectId, userId, title, description, deadline, priority } = req.body;

        if (!projectId || !userId || !title) {
            return res.status(400).json({
                success: false,
                message: 'Project ID, user ID, and title are required'
            });
        }

        // Check if project exists
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const task = await prisma.task.create({
            data: {
                projectId,
                userId,
                title,
                description: description || null,
                deadline: deadline ? new Date(deadline) : null,
                priority: priority || null,
                status: 'pending'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        avatar: true,
                        role: true,
                        position: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                project: {
                    select: {
                        id: true,
                        title: true,
                        status: true
                    }
                }
            }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'TASK_CREATED',
            'Task',
            task.id,
            `Created task: ${title}`,
            { title, projectId, userId },
            req
        );

        res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: task
        });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create task',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { projectId, userId, title, description, deadline, priority, status } = req.body;

        // Check if task exists
        const existingTask = await prisma.task.findUnique({
            where: { id }
        });

        if (!existingTask) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Validate project exists (if provided)
        if (projectId !== undefined) {
            const project = await prisma.project.findUnique({
                where: { id: projectId }
            });

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }
        }

        // Validate user exists (if provided)
        if (userId !== undefined) {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
        }

        const updateData = {};
        if (projectId !== undefined) updateData.projectId = projectId;
        if (userId !== undefined) updateData.userId = userId;
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null;
        if (priority !== undefined) updateData.priority = priority;
        if (status !== undefined) updateData.status = status;

        // Check if there's anything to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        const updatedTask = await prisma.task.update({
            where: { id },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        avatar: true,
                        role: true,
                        position: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                project: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        projectManagerId: true,
                        projectManager: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'TASK_UPDATED',
            'Task',
            updatedTask.id,
            null, // description will be generated automatically
            { projectId, userId, title, description, deadline, priority, status },
            req,
            {
                projectId: existingTask.projectId,
                userId: existingTask.userId,
                title: existingTask.title,
                description: existingTask.description,
                deadline: existingTask.deadline,
                priority: existingTask.priority,
                status: existingTask.status
            },
            {
                projectId: updatedTask.projectId,
                userId: updatedTask.userId,
                title: updatedTask.title,
                description: updatedTask.description,
                deadline: updatedTask.deadline,
                priority: updatedTask.priority,
                status: updatedTask.status
            }
        );

        notifyTaskStakeholders(updatedTask, updatedTask.status, req.user);

        res.json({
            success: true,
            message: 'Task updated successfully',
            data: updatedTask
        });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update task',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const updateTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        // Check if task exists
        const existingTask = await prisma.task.findUnique({
            where: { id }
        });

        if (!existingTask) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Set completedAt when status changes to 'completed', clear it otherwise
        let updateData = { status };
        if (status === 'completed' && !existingTask.completedAt) {
            updateData.completedAt = new Date();
        } else if (status !== 'completed') {
            updateData.completedAt = null;
        }

        const updatedTask = await prisma.task.update({
            where: { id },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        avatar: true,
                        role: true,
                        position: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                project: {
                    select: {
                        id: true,
                        title: true,
                        status: true
                    }
                }
            }
        });

        // Log activity for status update
        createActivityLog(
            req.user.id,
            'TASK_STATUS_UPDATED',
            'Task',
            updatedTask.id,
            `Updated task status: ${existingTask.title} - ${existingTask.status} → ${status}`,
            { taskId: updatedTask.id, oldStatus: existingTask.status, newStatus: status },
            req
        );

        notifyTaskStakeholders(updatedTask, status, req.user);

        res.json({
            success: true,
            message: 'Task status updated successfully',
            data: updatedTask
        });
    } catch (error) {
        console.error('Update task status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update task status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if task exists
        const task = await prisma.task.findUnique({
            where: { id }
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Try to delete the task
        await prisma.task.delete({
            where: { id }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'TASK_DELETED',
            'Task',
            id,
            `Deleted task: ${task.title}`,
            { title: task.title },
            req
        );

        res.json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        console.error('Delete task error:', error);

        // Handle specific database errors
        if (error.code === 'P2003') {
            // Foreign key constraint violation
            return res.status(400).json({
                success: false,
                message: 'Cannot delete task. Task may be referenced by other records.'
            });
        }

        if (error.code === 'P2025') {
            // Record to delete not found
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete task',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getMyTasks = async (req, res) => {
    try {
        const { page = 1, limit = 10, projectId, status, priority } = req.query;
        const skip = (page - 1) * limit;
        const userId = req.user.id;

        const where = { userId };
        if (projectId) where.projectId = projectId;
        if (status) where.status = status;
        if (priority) where.priority = priority;

        const [tasks, total] = await Promise.all([
            prisma.task.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    project: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            deadline: true
                        }
                    },
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            employeeId: true,
                            avatar: true,
                            role: true,
                            position: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.task.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                tasks,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get my tasks error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your tasks',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getTaskStats = async (req, res) => {
    try {
        const { projectId, userId } = req.query;
        const where = {};
        if (projectId) where.projectId = projectId;
        if (userId) where.userId = userId;

        const [
            totalTasks,
            pendingTasks,
            completedTasks,
            tasksByStatus,
            tasksByPriority,
            overdueTasks
        ] = await Promise.all([
            prisma.task.count({ where }),
            prisma.task.count({ where: { ...where, status: 'pending' } }),
            prisma.task.count({ where: { ...where, status: 'completed' } }),
            prisma.task.groupBy({
                by: ['status'],
                _count: { status: true },
                where
            }),
            prisma.task.groupBy({
                by: ['priority'],
                _count: { priority: true },
                where: { ...where, priority: { not: null } }
            }),
            prisma.task.count({
                where: {
                    ...where,
                    deadline: { lt: new Date() },
                    status: { not: 'completed' }
                }
            })
        ]);

        res.json({
            success: true,
            data: {
                totalTasks,
                pendingTasks,
                completedTasks,
                overdueTasks,
                tasksByStatus: tasksByStatus.map(item => ({
                    status: item.status,
                    count: item._count.status
                })),
                tasksByPriority: tasksByPriority.map(item => ({
                    priority: item.priority,
                    count: item._count.priority
                }))
            }
        });
    } catch (error) {
        console.error('Get task stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch task statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getAllTasks,
    getTaskById,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    getMyTasks,
    getTaskStats
};