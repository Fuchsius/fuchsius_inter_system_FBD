const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  await prisma.notification.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.user.deleteMany();
  await prisma.event.deleteMany();
  await prisma.department.deleteMany();
  await prisma.position.deleteMany();

  console.log('🗑️  Cleared existing data');

  // Create Departments
  const departments = await Promise.all([
    prisma.department.create({
      data: {
        name: 'Engineering',
        description: 'Software development and technology team'
      }
    }),
    prisma.department.create({
      data: {
        name: 'Human Resources',
        description: 'HR operations and employee management'
      }
    }),
    prisma.department.create({
      data: {
        name: 'Marketing',
        description: 'Marketing and sales operations'
      }
    }),
    prisma.department.create({
      data: {
        name: 'Finance',
        description: 'Financial planning and accounting'
      }
    })
  ]);

  console.log('📁 Created departments');

  // Create Positions
  const positions = await Promise.all([
    prisma.position.create({
      data: {
        name: 'Software Engineer',
        description: 'Full-stack software development'
      }
    }),
    prisma.position.create({
      data: {
        name: 'HR Manager',
        description: 'Human resources management'
      }
    }),
    prisma.position.create({
      data: {
        name: 'Marketing Specialist',
        description: 'Marketing campaigns and strategies'
      }
    }),
    prisma.position.create({
      data: {
        name: 'Project Manager',
        description: 'Project coordination and management'
      }
    }),
    prisma.position.create({
      data: {
        name: 'CEO',
        description: 'Chief Executive Officer'
      }
    })
  ]);

  console.log('💼 Created positions');

  // Helper function to generate referral codes
  const generateReferralCode = (name) => {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `fuchsius-${random}`;
  };

  // Helper function to generate employee IDs
  const generateEmployeeId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `EMP${timestamp}${random}`;
  };

  // Create Users with different roles
  const users = await Promise.all([
    // Admin user
    prisma.user.create({
      data: {
        employeeId: 'EMP001',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@fuchsius.com',
        role: 'admin',
        password: await bcrypt.hash('admin123', 12),
        positionId: positions[4].id, // CEO
        departmentId: departments[0].id, // Engineering
        referralCode: generateReferralCode('admin'),
        status: 'active',
        phone: '+1234567890',
        address: '123 Admin Street, Tech City',
        university: 'Tech University',
        dateOfBirth: new Date('1985-01-15')
      }
    }),
  ]);


  console.log('\n🔑 Login Credentials:');
  console.log('   Admin: admin@fuchsius.com / admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
