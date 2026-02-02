const { PrismaClient } = require('@prisma/client');
const { createProjectAssignmentNotification } = require('./NotificationController');
const { createActivityLog } = require('./ActivityController');

const prisma = new PrismaClient();

const getAllProjects = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, priority, projectManager, search } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (projectManager) where.projectManagerId = projectManager;
        
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } },
                {
                    projectManager: {
                        firstName: { contains: search }
                    }
                },
                {
                    projectManager: {
                        lastName: { contains: search }
                    }
                }
            ];
        }

        const [projects, total] = await Promise.all([
            prisma.project.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    projectManager: {
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
                    tasks: {
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            status: true,
                            priority: true,
                            deadline: true,
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
                        }
                    },
                    _count: {
                        select: {
                            tasks: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.project.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                projects,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all projects error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch projects',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getProjectById = async (req, res) => {
    try {
        const { id } = req.params;

        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                projectManager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        role: true,
                        position: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                tasks: {
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
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        res.json({
            success: true,
            data: project
        });
    } catch (error) {
        console.error('Get project by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch project',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const createProject = async (req, res) => {
    try {
        const { title, description, deadline, priority, projectManagerId } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Project title is required'
            });
        }

        // Check if project manager exists
        if (projectManagerId) {
            const projectManager = await prisma.user.findUnique({
                where: { id: projectManagerId }
            });

            if (!projectManager) {
                return res.status(404).json({
                    success: false,
                    message: 'Project manager not found'
                });
            }
        }

        const project = await prisma.project.create({
            data: {
                title,
                description: description || null,
                deadline: deadline ? new Date(deadline) : null,
                priority: priority || null,
                projectManagerId: projectManagerId || null,
                status: 'active'
            },
            include: {
                projectManager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        role: true,
                        position: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'PROJECT_CREATED',
            'Project',
            project.id,
            `Created project: ${title}`,
            { title, description },
            req
        );

        // Create notification for project manager if assigned
        if (projectManagerId) {
            await createProjectAssignmentNotification(projectManagerId, title, project.id);
        }

        res.status(201).json({
            success: true,
            message: 'Project created successfully',
            data: project
        });
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create project',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, deadline, priority, projectManagerId } = req.body;

        // Check if project exists
        const existingProject = await prisma.project.findUnique({
            where: { id }
        });

        if (!existingProject) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        // Check if project manager exists (if provided)
        if (projectManagerId !== undefined && projectManagerId !== null) {
            const projectManager = await prisma.user.findUnique({
                where: { id: projectManagerId }
            });

            if (!projectManager) {
                return res.status(404).json({
                    success: false,
                    message: 'Project manager not found'
                });
            }
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null;
        if (priority !== undefined) updateData.priority = priority;
        if (projectManagerId !== undefined) updateData.projectManagerId = projectManagerId;

        const updatedProject = await prisma.project.update({
            where: { id },
            data: updateData,
            include: {
                projectManager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        role: true,
                        position: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'PROJECT_UPDATED',
            'Project',
            updatedProject.id,
            null, // description will be generated automatically
            { title, description, deadline, priority, projectManagerId },
            req,
            {
                title: existingProject.title,
                description: existingProject.description,
                deadline: existingProject.deadline,
                priority: existingProject.priority,
                projectManagerId: existingProject.projectManagerId,
                status: existingProject.status
            },
            {
                title: updatedProject.title,
                description: updatedProject.description,
                deadline: updatedProject.deadline,
                priority: updatedProject.priority,
                projectManagerId: updatedProject.projectManagerId,
                status: updatedProject.status
            }
        );

        res.json({
            success: true,
            message: 'Project updated successfully',
            data: updatedProject
        });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update project',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const updateProjectStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        // Check if project exists
        const existingProject = await prisma.project.findUnique({
            where: { id }
        });

        if (!existingProject) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        const updatedProject = await prisma.project.update({
            where: { id },
            data: { status },
            include: {
                projectManager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true
                    }
                }
            }
        });

        res.json({
            success: true,
            message: 'Project status updated successfully',
            data: updatedProject
        });
    } catch (error) {
        console.error('Update project status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update project status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if project exists
        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        tasks: true
                    }
                }
            }
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        // Check if project has tasks
        if (project._count.tasks > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete project with associated tasks. Please remove tasks first.'
            });
        }

        await prisma.project.delete({
            where: { id }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'PROJECT_DELETED',
            'Project',
            id,
            `Deleted project: ${project.title}`,
            { title: project.title },
            req
        );

        res.json({
            success: true,
            message: 'Project deleted successfully'
        });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete project',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getMyProjects = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, priority } = req.query;
        const skip = (page - 1) * limit;
        const userId = req.user.id;

        const where = { projectManagerId: userId };
        if (status) where.status = status;
        if (priority) where.priority = priority;

        const [projects, total] = await Promise.all([
            prisma.project.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    _count: {
                        select: {
                            tasks: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.project.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                projects,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get my projects error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your projects',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getProjectStats = async (req, res) => {
    try {
        const { projectManager } = req.query;
        const where = {};
        if (projectManager) where.projectManagerId = projectManager;

        const [
            totalProjects,
            activeProjects,
            completedProjects,
            projectsByStatus,
            projectsByPriority,
            projectsWithTasks
        ] = await Promise.all([
            prisma.project.count({ where }),
            prisma.project.count({ where: { ...where, status: 'active' } }),
            prisma.project.count({ where: { ...where, status: 'completed' } }),
            prisma.project.groupBy({
                by: ['status'],
                _count: { status: true },
                where
            }),
            prisma.project.groupBy({
                by: ['priority'],
                _count: { priority: true },
                where: { ...where, priority: { not: null } }
            }),
            prisma.project.findMany({
                where,
                include: {
                    _count: {
                        select: {
                            tasks: true
                        }
                    }
                }
            })
        ]);

        const totalTasks = projectsWithTasks.reduce((sum, project) => sum + project._count.tasks, 0);

        res.json({
            success: true,
            data: {
                totalProjects,
                activeProjects,
                completedProjects,
                projectsByStatus: projectsByStatus.map(item => ({
                    status: item.status,
                    count: item._count.status
                })),
                projectsByPriority: projectsByPriority.map(item => ({
                    priority: item.priority,
                    count: item._count.priority
                })),
                totalTasks
            }
        });
    } catch (error) {
        console.error('Get project stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch project statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    updateProjectStatus,
    deleteProject,
    getMyProjects,
    getProjectStats
};